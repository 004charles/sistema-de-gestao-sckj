"""Rule Engine centralizado e versionado (Fase 3→4, §30, §31, §27).

- Expressões (`condicao`/`formula`) avaliadas com AST whitelist — sem builtins,
  sem atributos, sem `__*__`, só variáveis do contexto e funções seguras.
- Executa apenas regras ACTIVAS e VALIDADAS (decisão 2: regras nascem
  POR_VALIDAR e não geram alertas oficiais até validação).
- Toda a ocorrência grava evidência obrigatória:
  {fontes, valores, calculo, diferenca, referencia_legal}.
- Idempotente: re-executar actualiza a ocorrência do período, não duplica.
"""
import ast
import logging
import operator
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .models import (
    Contabilidade, DeclaracaoAGT, DocumentoUpload, Ocorrencia, Reconciliacao,
    Regra,
)

logger = logging.getLogger('reconciliacao')

MAX_DIGITS_VALOR = Decimal('9999999999999999.99')
MIN_DIGITS_VALOR = Decimal('-9999999999999999.99')

_FUNCOES = {'abs': abs, 'min': min, 'max': max, 'round': round}
_OPERADORES_BIN = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Mod: operator.mod,
}
_OPERADORES_UN = {ast.USub: operator.neg, ast.UAdd: operator.pos}
_OPERADORES_CMP = {
    ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt,
    ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge,
}
_NOS_PERMITIDOS = (
    ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not,
    ast.BinOp, ast.Compare, ast.Name, ast.Load, ast.Constant, ast.Call,
    ast.Subscript, ast.List, ast.Tuple,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.USub, ast.UAdd,
)


class ExpressaoInvalida(ValueError):
    """Expressão fora da whitelist — nunca executada."""


def nomes_usados(expressao):
    """Nomes referenciados numa expressão (para a evidência)."""
    try:
        arvore = ast.parse(expressao or '', mode='eval')
    except SyntaxError:
        return set()
    return {
        no.id for no in ast.walk(arvore)
        if isinstance(no, ast.Name)
    }


def avaliar(expressao, contexto):
    """Avalia `expressao` seguramente. Só variáveis do contexto + funções seguras."""
    if not (expressao or '').strip():
        return 0
    try:
        arvore = ast.parse(expressao, mode='eval')
    except SyntaxError as exc:
        raise ExpressaoInvalida(f'Sintaxe inválida: {exc}') from exc

    for no in ast.walk(arvore):
        if not isinstance(no, _NOS_PERMITIDOS):
            raise ExpressaoInvalida(f'Construto não permitido: {type(no).__name__}')
        if isinstance(no, ast.Call):
            if not isinstance(no.func, ast.Name) or no.func.id not in _FUNCOES:
                raise ExpressaoInvalida('Só são permitidas funções seguras.')
            if no.keywords:
                raise ExpressaoInvalida('Argumentos nomeados não permitidos.')
        elif isinstance(no, ast.Name):
            if no.id in _FUNCOES:
                continue
            if no.id not in contexto:
                raise ExpressaoInvalida(f'Variável não permitida: {no.id}')

    resultado = eval(  # noqa: S307 — AST whitelist garante a segurança
        compile(arvore, '<regra>', 'eval'),
        {'__builtins__': {}, **_FUNCOES},
        contexto,
    )
    return resultado


def avaliar_numerico(expressao, contexto):
    resultado = avaliar(expressao, contexto)
    if isinstance(resultado, bool):
        return Decimal('1.00' if resultado else '0.00')
    try:
        val = Decimal(str(resultado)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if val > MAX_DIGITS_VALOR:
            return MAX_DIGITS_VALOR
        if val < MIN_DIGITS_VALOR:
            return MIN_DIGITS_VALOR
        return val
    except (InvalidOperation, ValueError, Exception):
        return Decimal('0.00')


def _serializar(valor):
    if isinstance(valor, Decimal):
        return f'{valor:.2f}'
    if isinstance(valor, (list, tuple)):
        return [_serializar(v) for v in valor]
    return valor


def construir_contexto(empresa, ano, mes):
    """Variáveis whitelisted do período + lista de fontes (evidência)."""
    linhas = Contabilidade.objects.filter(empresa=empresa, ano=ano, mes=mes)
    tem_balancete = 1 if linhas.exists() else 0
    soma_devedor = sum(
        (l.valor_debito for l in linhas), Decimal('0')
    )
    soma_credor = sum(
        (l.valor_credito for l in linhas), Decimal('0')
    )

    declaracao = DeclaracaoAGT.objects.filter(
        empresa=empresa, ano=ano, mes=mes
    ).order_by('-updated_at').first()
    tem_modelo7 = 1 if declaracao else 0
    iva_liquidado = declaracao.iva_liquidado if declaracao else Decimal('0')
    iva_dedutivel = declaracao.iva_dedutivel if declaracao else Decimal('0')
    iva_apurado = declaracao.iva_apurado if declaracao else Decimal('0')
    iva_pagar = declaracao.iva_pagar if declaracao else Decimal('0')
    iva_recuperar = declaracao.iva_recuperar if declaracao else Decimal('0')

    reconciliacao = Reconciliacao.objects.filter(
        empresa=empresa, ano=ano, mes=mes
    ).order_by('-data_reconciliacao').first()
    tem_reconciliacao = 1 if reconciliacao else 0
    reconciliacao_divergencias = (
        reconciliacao.total_campos_divergencia if reconciliacao else 0
    )

    documentos = list(
        DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, mes=mes,
            estado__in=('VALIDADO', 'UTILIZADO'),
        )
    )
    tem_doc_balancete = any(d.tipo == 'BALANCETE' for d in documentos)
    tem_doc_modelo7 = any(d.tipo == 'MODELO7' for d in documentos)

    iva_coerente = 1 if abs(
        (iva_liquidado - iva_dedutivel) - iva_apurado
    ) <= Decimal('0.01') else 0

    # Extração das contas da contabilidade (PGC Angolano)
    caixa_saldo_credor = Decimal('0')
    irt_contabilizado = Decimal('0')
    inss_contabilizado = Decimal('0')
    retencao_prestadores_contab = Decimal('0')
    retencoes_clientes_contab = Decimal('0')
    remuneracoes_total = Decimal('0')
    encargos_patronais = Decimal('0')
    honorarios_prestadores = Decimal('0')
    iva_suportado_contab = Decimal('0')
    iva_custo_contab = Decimal('0')
    volume_negocios_contab = Decimal('0')
    bancos_saldo = Decimal('0')
    fornec_saldo_devedor = Decimal('0')
    clientes_saldo_credor = Decimal('0')
    fornecimentos_terceiros = Decimal('0')
    multas_encargos_contab = Decimal('0')

    for l in linhas:
        codigo = l.conta_codigo.replace('.', '').strip()
        debito = l.valor_debito
        credito = l.valor_credito
        saldo = l.saldo

        if codigo.startswith('45'):
            if credito > debito:
                caixa_saldo_credor += (credito - debito)
            elif saldo < Decimal('0'):
                caixa_saldo_credor += abs(saldo)
        elif codigo.startswith('43'):
            bancos_saldo += (debito - credito)
        elif codigo.startswith('321'):
            if debito > credito:
                fornec_saldo_devedor += (debito - credito)
        elif codigo.startswith('311'):
            if credito > debito:
                clientes_saldo_credor += (credito - debito)
        elif codigo.startswith('343'):
            irt_contabilizado += credito
        elif codigo.startswith('3492'):
            inss_contabilizado += credito
        elif codigo.startswith('3493'):
            retencao_prestadores_contab += credito
        elif codigo.startswith('3413'):
            retencoes_clientes_contab += debito
        elif codigo.startswith(('722', '721', '723', '724')):
            remuneracoes_total += debito
        elif codigo.startswith('725'):
            encargos_patronais += debito
        elif codigo.startswith('75234'):
            honorarios_prestadores += debito
        elif codigo.startswith('752'):
            fornecimentos_terceiros += debito
        elif codigo.startswith(('756', '757')):
            multas_encargos_contab += debito
        elif codigo.startswith('3451'):
            iva_suportado_contab += debito
        elif codigo.startswith(('75312', '7531')):
            iva_custo_contab += debito
        elif codigo.startswith(('61', '62')):
            volume_negocios_contab += credito

    # Se não temos linhas no banco mas temos Balancete em PDF/documento, tentar ler texto extraído
    doc_balancete = next((d for d in documentos if d.tipo == 'BALANCETE'), None)
    if not linhas.exists() and doc_balancete and doc_balancete.texto_extraido:
        from . import pdf_service
        dados_bal = pdf_service.extrair_dados_balancete(doc_balancete.texto_extraido)
        volume_negocios_contab = dados_bal['vendas']
        caixa_saldo_credor = dados_bal['caixa_saldo_credor']
        irt_contabilizado = dados_bal['irt_retido']
        inss_contabilizado = dados_bal['inss_retido']
        retencao_prestadores_contab = dados_bal['retencao_prestadores']
        retencoes_clientes_contab = dados_bal['retencao_clientes']
        honorarios_prestadores = dados_bal['honorarios_prestadores']
        remuneracoes_total = dados_bal['remuneracoes']
        iva_suportado_contab = dados_bal['iva_suportado']
        iva_custo_contab = dados_bal['iva_custo']

    # Se não temos DeclaracaoAGT no banco mas temos MODELO7 nos documentos
    volume_negocios_declarado = iva_liquidado / Decimal('0.14') if iva_liquidado > 0 else Decimal('0')
    doc_m7 = next((d for d in documentos if d.tipo == 'MODELO7'), None)
    if not declaracao and doc_m7 and doc_m7.texto_extraido:
        from . import pdf_service
        dados_m7 = pdf_service.extrair_dados_modelo7(doc_m7.texto_extraido)
        if dados_m7['iva_liquidado'] > Decimal('0'):
            iva_liquidado = dados_m7['iva_liquidado']
            iva_apurado = dados_m7['iva_liquidado']
        if dados_m7['iva_dedutivel'] > Decimal('0'):
            iva_dedutivel = dados_m7['iva_dedutivel']
        if dados_m7['iva_pagar'] > Decimal('0'):
            iva_pagar = dados_m7['iva_pagar']
        if dados_m7['base_tributavel'] > Decimal('0'):
            volume_negocios_declarado = dados_m7['base_tributavel']

    # Presença de documentos específicos
    tem_doc_folha = 1 if any(d.tipo == 'FOLHA_SALARIAL' for d in documentos) else 0
    tem_doc_extracto = 1 if any(d.tipo == 'EXTRACTO_BANCARIO' for d in documentos) else 0
    tem_doc_factura_venda = 1 if any(d.tipo == 'FACTURA_VENDA' for d in documentos) else 0
    tem_doc_factura_compra = 1 if any(d.tipo == 'FACTURA_COMPRA' for d in documentos) else 0
    tem_doc_retencoes = 1 if any(d.tipo == 'RETENCOES' for d in documentos) else 0
    tem_doc_comprovativos = 1 if any(d.tipo == 'COMPROVATIVOS' for d in documentos) else 0
    tem_doc_declaracao_irt = 1 if any(d.tipo == 'DECLARACAO_IRT' for d in documentos) else 0
    tem_doc_folha_ss = 1 if any(d.tipo == 'FOLHA_SS' for d in documentos) else 0
    tem_doc_imposto_industrial = 1 if any(d.tipo == 'IMPOSTO_INDUSTRIAL' for d in documentos) else 0

    caixa_credor_anormal = 1 if caixa_saldo_credor > Decimal('0.01') else 0
    honorarios_sem_retencao = 1 if (honorarios_prestadores > Decimal('0') and retencao_prestadores_contab == Decimal('0')) else 0
    retencao_devida_estimada = (honorarios_prestadores * Decimal('0.065')).quantize(Decimal('0.01'))
    diferenca_retencao_honorarios = abs(retencao_devida_estimada - retencao_prestadores_contab) if honorarios_prestadores > 0 else Decimal('0')

    diferenca_iva_suportado_agt = abs(iva_suportado_contab - iva_dedutivel) if iva_suportado_contab > Decimal('0') else Decimal('0')
    divergencia_suportado_dedutivel = 1 if (iva_suportado_contab > Decimal('0') and iva_dedutivel == Decimal('0')) else 0
    divergencia_volume_negocios = 1 if (volume_negocios_contab > Decimal('0') and volume_negocios_declarado > Decimal('0') and abs(volume_negocios_contab - volume_negocios_declarado) > Decimal('1.00')) else 0

    encargos_esperados_ss = (remuneracoes_total * Decimal('0.08')).quantize(Decimal('0.01'))
    desvio_encargos_ss = abs(encargos_patronais - encargos_esperados_ss) if (remuneracoes_total > 0 and encargos_patronais > 0) else Decimal('0')
    desvio_encargos_anormal = 1 if desvio_encargos_ss > Decimal('1000.00') else 0

    exposicao_total_potencial = (
        diferenca_retencao_honorarios +
        diferenca_iva_suportado_agt +
        (caixa_saldo_credor if caixa_credor_anormal else Decimal('0'))
    )

    contexto = {
        # Balancete/Modelo 7 vêm do balancete estruturado OU dos documentos
        'tem_balancete': 1 if (tem_balancete or tem_doc_balancete) else 0,
        'tem_modelo7': 1 if (tem_modelo7 or tem_doc_modelo7) else 0,
        'tem_reconciliacao': tem_reconciliacao,
        'tem_documento': 1 if documentos else 0,
        'n_documentos': len(documentos),
        'soma_devedor': soma_devedor,
        'soma_credor': soma_credor,
        'iva_liquidado': iva_liquidado,
        'iva_dedutivel': iva_dedutivel,
        'iva_apurado': iva_apurado,
        'iva_pagar': iva_pagar,
        'iva_recuperar': iva_recuperar,
        'iva_coerente': iva_coerente,
        'reconciliacao_divergencias': reconciliacao_divergencias,
        'diferenca_devedor_credor': abs(soma_devedor - soma_credor),

        # Campos PGC e cruzamentos fiscais
        'caixa_saldo_credor': caixa_saldo_credor,
        'caixa_credor_anormal': caixa_credor_anormal,
        'bancos_saldo': bancos_saldo,
        'fornec_saldo_devedor': fornec_saldo_devedor,
        'clientes_saldo_credor': clientes_saldo_credor,
        'fornecimentos_terceiros': fornecimentos_terceiros,
        'multas_encargos_contab': multas_encargos_contab,
        'irt_contabilizado': irt_contabilizado,
        'inss_contabilizado': inss_contabilizado,
        'retencao_prestadores_contab': retencao_prestadores_contab,
        'retencoes_clientes_contab': retencoes_clientes_contab,
        'remuneracoes_total': remuneracoes_total,
        'encargos_patronais': encargos_patronais,
        'encargos_esperados_ss': encargos_esperados_ss,
        'desvio_encargos_ss': desvio_encargos_ss,
        'desvio_encargos_anormal': desvio_encargos_anormal,
        'honorarios_prestadores': honorarios_prestadores,
        'iva_suportado_contab': iva_suportado_contab,
        'iva_custo_contab': iva_custo_contab,
        'volume_negocios_contab': volume_negocios_contab,
        'volume_negocios_declarado': volume_negocios_declarado,

        'honorarios_sem_retencao': honorarios_sem_retencao,
        'retencao_devida_estimada': retencao_devida_estimada,
        'diferenca_retencao_honorarios': diferenca_retencao_honorarios,
        'diferenca_iva_suportado_agt': diferenca_iva_suportado_agt,
        'divergencia_suportado_dedutivel': divergencia_suportado_dedutivel,
        'divergencia_volume_negocios': divergencia_volume_negocios,
        'exposicao_total_potencial': exposicao_total_potencial,

        # Presença de documentos
        'tem_doc_folha': tem_doc_folha,
        'tem_doc_extracto': tem_doc_extracto,
        'tem_doc_factura_venda': tem_doc_factura_venda,
        'tem_doc_factura_compra': tem_doc_factura_compra,
        'tem_doc_retencoes': tem_doc_retencoes,
        'tem_doc_comprovativos': tem_doc_comprovativos,
        'tem_doc_declaracao_irt': tem_doc_declaracao_irt,
        'tem_doc_folha_ss': tem_doc_folha_ss,
        'tem_doc_imposto_industrial': tem_doc_imposto_industrial,
    }

    fontes = []
    for doc in documentos:
        fontes.append({
            'tipo': 'DOCUMENTO', 'id': doc.id,
            'nome': doc.nome_arquivo, 'documento_tipo': doc.tipo,
            'estado': doc.estado,
        })
    if declaracao:
        fontes.append({
            'tipo': 'DECLARACAO_AGT', 'id': declaracao.id,
            'nome': f'Modelo 7 {mes:02d}/{ano}',
        })
    if reconciliacao:
        fontes.append({
            'tipo': 'RECONCILIACAO', 'id': reconciliacao.id,
            'nome': f'Reconciliação {mes:02d}/{ano}',
        })
    if not fontes:
        fontes.append({
            'tipo': 'SEM_FONTE_DOCUMENTAL', 'nome':
            f'Nenhum documento/declaração registado para {mes:02d}/{ano}',
        })

    return contexto, fontes


def _vigencia_cobre(base_legal, ano, mes):
    inicio_periodo = date(ano, mes, 1)
    ultimo_dia = date(ano + (mes // 12), (mes % 12) + 1, 1)
    fim_periodo = date.fromordinal(ultimo_dia.toordinal() - 1)
    if base_legal.vigencia_inicio and base_legal.vigencia_inicio > fim_periodo:
        return False
    if base_legal.vigencia_fim and base_legal.vigencia_fim < inicio_periodo:
        return False
    return True


def executar(empresa, ano, mes):
    """Executa todas as regras validadas sobre o período. Devolve resumo."""
    regras = Regra.objects.filter(
        activa=True, estado_validacao='VALIDADA'
    ).select_related('base_legal', 'motor')
    contexto, fontes = construir_contexto(empresa, ano, mes)

    criadas = 0
    actualizadas = 0
    avaliadas = 0
    erros = []
    REGRAS_IGNORAR_FALTA_DOC = {
        'BANCO-001', 'FAC-001', 'FAC-002', 'HIST-001', 'HIST-002',
        'II-001', 'IRT-002', 'IRT-003', 'PRAZO-002', 'REL-001',
        'REL-002', 'RET-002', 'SEL-001', 'SS-001', 'IVA-005'
    }

    for regra in regras:
        if regra.codigo in REGRAS_IGNORAR_FALTA_DOC:
            continue
        base = regra.base_legal
        if not _vigencia_cobre(base, ano, mes):
            continue
        avaliadas += 1
        try:
            condicao = avaliar(regra.condicao, contexto)
            valor = (
                avaliar_numerico(regra.formula, contexto)
                if regra.formula.strip() else Decimal('0')
            )
        except ExpressaoInvalida as exc:
            logger.warning('Regra %s inválida: %s', regra.codigo, exc)
            erros.append({'regra': regra.codigo, 'erro': str(exc)})
            continue
        except Exception as exc:  # nunca rebentar a execução do período
            logger.exception('Erro ao executar regra %s', regra.codigo)
            erros.append({'regra': regra.codigo, 'erro': str(exc)})
            continue

        if not bool(condicao):
            continue

        usados = (nomes_usados(regra.condicao) | nomes_usados(regra.formula))
        valores = {
            nome: _serializar(contexto[nome])
            for nome in sorted(usados) if nome in contexto
        }
        referencia = f'{base.legislacao} — {base.artigo}'
        if not base.validado_juridicamente:
            referencia += ' (requer validação jurídica)'

        evidencia = {
            'fontes': fontes,
            'valores': valores,
            'calculo': (
                f'{regra.formula} = {valor:.2f}'
                if regra.formula.strip() else 'Sem fórmula (valor envolvido: 0.00)'
            ),
            'diferenca': f'{valor:.2f}',
            'referencia_legal': referencia,
            'condicao': regra.condicao,
            'versao_regra': regra.versao,
            'requer_validacao_juridica': not base.validado_juridicamente,
        }

        _, created = Ocorrencia.objects.update_or_create(
            empresa=empresa, ano=ano, mes=mes, regra=regra,
            defaults={
                'severidade': regra.severidade,
                'valor_envolvido': valor,
                'evidencia': evidencia,
                'recomendacao': regra.recomendacao,
                'versao_regra': regra.versao,
            },
        )
        if created:
            criadas += 1
        else:
            actualizadas += 1

    return {
        'regras_validadas': regras.count(),
        'regras_avaliadas': avaliadas,
        'ocorrencias_criadas': criadas,
        'ocorrencias_actualizadas': actualizadas,
        'erros': erros,
    }
