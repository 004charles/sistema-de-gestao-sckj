"""Rasto técnico da auditoria — o que o sistema fez, passo a passo.

Destinatário: o contabilista. Ao contrário do resumo em números, que responde
a "quanto está em risco", este rasto responde a **"de onde é que isso veio"**:
que documento, que página, que conta do PGC, que valor, que fórmula, que
norma. É o que alimenta a animação de análise e o que sustenta o parecer
perante uma inspecção.

Cada passo é um facto verificável produzido pelo Rule Engine determinístico.
A IA comenta-os depois (`ai_auditoria`), mas não os produz nem os altera: se
a IA falhar, o rasto fica igual.
"""
import logging
from decimal import Decimal

from . import cobertura_service, regra_engine, taxas
from .models import Contabilidade, DocumentoUpload, Ocorrencia

logger = logging.getLogger('reconciliacao')

# Contas do PGC Angolano que o motor lê, com o que cada uma representa.
# Serve para o rasto dizer "conta 3493 — Retenção na fonte" e não só "3493".
CONTAS_PGC = {
    '31': 'Clientes',
    '311': 'Clientes correntes',
    '321': 'Fornecedores correntes',
    '34': 'Estado',
    '341': 'Imposto sobre lucros',
    '3413': 'Retenção na fonte de clientes',
    '343': 'Imposto sobre o Rendimento do Trabalho',
    '345': 'Imposto sobre o Valor Acrescentado',
    '3451': 'IVA suportado',
    '3453': 'IVA liquidado',
    '3455': 'IVA apuramento',
    '3456': 'IVA a pagar',
    '3492': 'Segurança Social',
    '3493': 'Retenção na fonte de prestadores',
    '36': 'Pessoal',
    '43': 'Depósitos à ordem',
    '45': 'Caixa',
    '61': 'Vendas',
    '62': 'Prestações de serviço',
    '72': 'Custos com pessoal',
    '722': 'Remunerações do pessoal',
    '725': 'Encargos sobre remunerações',
    '752': 'Fornecimentos e serviços de terceiros',
    '75213': 'Combustíveis',
    '75234': 'Honorários e avenças',
    '75312': 'IVA lançado a custo',
    '756': 'Multas e penalidades',
}

FASES = [
    ('LEITURA', 'Leitura documental'),
    ('ESCRITURACAO', 'Escrituração — PGC Angolano'),
    ('DECLARACAO', 'Confronto com a AGT'),
    ('REGRAS', 'Execução do Rule Engine'),
    ('PRAZOS', 'Obrigações e prazos'),
    ('RISCO', 'Apuramento da exposição'),
]


def _kz(valor):
    try:
        return f'{Decimal(str(valor)):,.2f}'.replace(',', ' ').replace('.', ',').replace(' ', '.')
    except Exception:
        return str(valor)


def _passo(fase, codigo, texto, valor=None, fonte=None, norma=None, estado='OK'):
    """Um facto do rasto. `estado` ∈ {OK, ALERTA, INFO, FALHA}."""
    return {
        'fase': fase,
        'codigo': codigo,
        'texto': texto,
        'valor': _kz(valor) if valor is not None else None,
        'fonte': fonte,
        'norma': norma,
        'estado': estado,
    }


def _fase_leitura(empresa, ano, mes):
    passos = []
    documentos = list(
        DocumentoUpload.objects.filter(empresa=empresa, ano=ano, mes=mes)
        .order_by('tipo', 'id')
    )
    if not documentos:
        passos.append(_passo(
            'LEITURA', 'DOC-000',
            f'Nenhum documento carregado para {mes:02d}/{ano}.',
            estado='FALHA',
        ))
        return passos

    for documento in documentos:
        caracteres = len(documento.texto_extraido or '')
        passos.append(_passo(
            'LEITURA', f'DOC-{documento.id:03d}',
            f'{documento.get_tipo_display()} — {caracteres} caracteres extraídos',
            fonte=documento.nome_arquivo,
            estado='OK' if caracteres else 'FALHA',
        ))

        if documento.tipo == 'MODELO7' and documento.texto_extraido:
            passos.extend(_passos_modelo7(documento))
    return passos


def _passos_modelo7(documento):
    """Metadados e campos do Modelo 7 — a prova de que a declaração foi lida."""
    from . import agt_modelo7

    passos = []
    try:
        lido = agt_modelo7.parse(documento.texto_extraido)
    except Exception:
        logger.exception('Falha a ler o Modelo 7 %s', documento.id)
        return [_passo('LEITURA', 'M7-ERRO',
                       'Não foi possível interpretar a declaração.',
                       fonte=documento.nome_arquivo, estado='FALHA')]

    if lido.get('numero_declaracao'):
        passos.append(_passo(
            'LEITURA', 'M7-NUM',
            f"Declaração n.º {lido['numero_declaracao']}, recepcionada em "
            f"{lido['data_recepcao'] or '—'}",
            fonte=documento.nome_arquivo,
        ))
    if lido.get('substituicao'):
        passos.append(_passo(
            'LEITURA', 'M7-SUB',
            'Declaração de SUBSTITUIÇÃO — substitui uma entrega anterior.',
            fonte=documento.nome_arquivo, estado='ALERTA',
        ))
    if lido.get('fora_prazo'):
        passos.append(_passo(
            'LEITURA', 'M7-PRZ',
            'Quadro 02 assinalado FORA DO PRAZO.',
            fonte=documento.nome_arquivo, estado='ALERTA',
            norma='Art. 26.º do CIVA',
        ))

    for numero in ('31', '32', '33', '37'):
        if numero in lido.get('campos', {}):
            _, descricao = agt_modelo7.CAMPOS_QUADRO9.get(numero, ('', numero))
            passos.append(_passo(
                'DECLARACAO', f'M7-C{numero}',
                f'Campo {numero} — {descricao}',
                valor=lido['campos'][numero],
                fonte=documento.nome_arquivo,
            ))

    incoerencias = agt_modelo7.coerencia(lido)
    for problema in incoerencias:
        passos.append(_passo(
            'DECLARACAO', f"M7-INC{problema['campo']}",
            f"Campo {problema['campo']} incoerente: declarado "
            f"{_kz(problema['declarado'])}, esperado {_kz(problema['esperado'])}. "
            f"{problema['explicacao']}.",
            valor=abs(problema['declarado'] - problema['esperado']),
            fonte=documento.nome_arquivo, estado='ALERTA',
        ))
    if not incoerencias and lido.get('campos'):
        passos.append(_passo(
            'DECLARACAO', 'M7-COER',
            'Somas do quadro 09 internamente coerentes (31, 32, 33, 35, 37).',
            fonte=documento.nome_arquivo,
        ))
    return passos


def _fase_escrituracao(empresa, ano, mes, contexto):
    """As contas do PGC que o motor leu e o que extraiu de cada uma."""
    passos = []
    linhas = Contabilidade.objects.filter(empresa=empresa, ano=ano, mes=mes)
    total = linhas.count()
    if not total:
        passos.append(_passo(
            'ESCRITURACAO', 'PGC-000',
            'Sem escrituração carregada para o período.', estado='FALHA',
        ))
        return passos

    passos.append(_passo(
        'ESCRITURACAO', 'PGC-LER',
        f'{total} contas lidas do balancete.',
    ))

    # Variáveis que o Rule Engine extrai, com a conta de origem.
    extraidas = [
        ('45', 'caixa_saldo_credor', 'Saldo credor de caixa'),
        ('43', 'bancos_saldo', 'Saldo de depósitos à ordem'),
        ('62', 'volume_negocios_contab', 'Volume de negócios escriturado'),
        ('3451', 'iva_suportado_contab', 'IVA suportado'),
        ('343', 'irt_contabilizado', 'IRT retido'),
        ('3492', 'inss_contabilizado', 'Contribuições à Segurança Social'),
        ('3493', 'retencao_prestadores_contab', 'Retenção na fonte de prestadores'),
        ('3413', 'retencoes_clientes_contab', 'Retenções sofridas de clientes'),
        ('722', 'remuneracoes_total', 'Massa salarial'),
        ('725', 'encargos_patronais', 'Encargos patronais'),
        ('75234', 'honorarios_prestadores', 'Honorários a independentes'),
        ('75312', 'iva_custo_contab', 'IVA lançado a custo'),
    ]
    for conta, variavel, descricao in extraidas:
        valor = contexto.get(variavel)
        if valor is None or Decimal(str(valor)) == 0:
            continue
        passos.append(_passo(
            'ESCRITURACAO', f'PGC-{conta}',
            f'Conta {conta} — {CONTAS_PGC.get(conta, descricao)}: {descricao}',
            valor=valor,
        ))

    # Balanceamento: só se afirma quando há um balancete completo.
    if contexto.get('balancete_completo'):
        equilibrado = not contexto.get('balancete_desequilibrado')
        passos.append(_passo(
            'ESCRITURACAO', 'PGC-BAL',
            'Somatório das contas de raiz: débito {} / crédito {}'.format(
                _kz(contexto.get('total_debito_raiz', 0)),
                _kz(contexto.get('total_credito_raiz', 0)),
            ),
            valor=contexto.get('diferenca_balanceamento'),
            estado='OK' if equilibrado else 'ALERTA',
            norma='PGC — Decreto n.º 82/01',
        ))
    return passos


def _fase_declaracao(empresa, contexto):
    """Cruzamentos entre escrituração e declaração, com as fórmulas à vista."""
    passos = []

    base = contexto.get('base_para_taxa') or Decimal('0')
    if base > 0 and contexto.get('iva_liquidado'):
        taxa = taxas.taxa_implicita(base, contexto['iva_liquidado'])
        classificada = taxas.classificar_taxa(taxa)
        passos.append(_passo(
            'DECLARACAO', 'TAXA-IVA',
            'Taxa implícita = IVA liquidado / base tributável = {} / {} = {:.2%}'
            .format(_kz(contexto['iva_liquidado']), _kz(base), taxa),
            estado='OK' if classificada else 'ALERTA',
            norma=(classificada or {}).get('base_legal', 'Art. 27.º do CIVA'),
        ))
        if classificada:
            passos.append(_passo(
                'DECLARACAO', 'TAXA-CLS',
                f"Taxa reconhecida: {classificada['descricao']}.",
                norma=classificada['base_legal'],
            ))

    caracteristicas = taxas.CARACTERISTICAS_REGIME.get(empresa.regime_iva, {})
    passos.append(_passo(
        'DECLARACAO', 'REGIME',
        f"Enquadramento: {caracteristicas.get('nome', empresa.regime_iva)} — "
        f"{caracteristicas.get('resumo', '')}",
        norma='Código do IVA — regimes de tributação',
        estado='ALERTA' if contexto.get('regime_divergente') else 'OK',
    ))

    # Retenção sobre honorários: a fórmula escrita por extenso.
    honorarios = contexto.get('honorarios_prestadores') or Decimal('0')
    if honorarios > 0:
        devida = contexto.get('retencao_devida_estimada')
        contabilizada = contexto.get('retencao_prestadores_contab')
        diferenca = contexto.get('diferenca_retencao_honorarios') or Decimal('0')
        passos.append(_passo(
            'REGRAS', 'RET-CALC',
            'Conta 75234 {} x 6,5% = {} devido; conta 3493 regista {}'.format(
                _kz(honorarios), _kz(devida), _kz(contabilizada),
            ),
            valor=diferenca,
            estado='ALERTA' if diferenca > Decimal('10') else 'OK',
            norma='Art. 67.º do Código do Imposto Industrial',
        ))

    # Segurança Social: a coerência 8% + 3%.
    if contexto.get('encargos_patronais'):
        passos.append(_passo(
            'REGRAS', 'INSS-CALC',
            'Base implícita = conta 725 / 8% = {}; 11% dessa base = {}; '
            'conta 3492 regista {}'.format(
                _kz(contexto.get('base_inss_implicita')),
                _kz(contexto.get('inss_esperado_total')),
                _kz(contexto.get('inss_contabilizado')),
            ),
            valor=contexto.get('desvio_inss_total'),
            estado='OK' if contexto.get('inss_coerente') else 'ALERTA',
            norma='Lei n.º 07/04 e Decreto Presidencial n.º 227/18',
        ))
    return passos


def _fase_regras(empresa, ano, mes):
    """Que regras correram, quais dispararam e com que fundamento."""
    passos = []
    avaliadas = regra_engine.contar_avaliaveis(empresa, ano, mes)
    silenciadas = len(regra_engine.REGRAS_SILENCIADAS)
    passos.append(_passo(
        'REGRAS', 'RE-EXEC',
        f'{avaliadas} regras validadas executadas sobre o período '
        f'({silenciadas} silenciadas por dependerem só de documentos em falta).',
    ))

    ocorrencias = (
        Ocorrencia.objects.filter(empresa=empresa, ano=ano, mes=mes)
        .select_related('regra', 'regra__base_legal', 'regra__motor')
        .order_by('-severidade')
    )
    for ocorrencia in ocorrencias:
        evidencia = ocorrencia.evidencia or {}
        passos.append(_passo(
            'REGRAS', ocorrencia.regra.codigo,
            '{} — {} [{}]'.format(
                ocorrencia.regra.motor.codigo,
                ocorrencia.regra.nome,
                evidencia.get('calculo', 'sem fórmula'),
            ),
            valor=ocorrencia.valor_envolvido,
            norma=evidencia.get('referencia_legal'),
            estado='ALERTA' if ocorrencia.severidade in ('ALTO', 'MEDIO') else 'INFO',
        ))
    if not ocorrencias:
        passos.append(_passo(
            'REGRAS', 'RE-LIMPO',
            'Nenhuma regra disparou sobre os dados do período.',
        ))
    return passos


def _fase_prazos(prazos):
    passos = []
    for obrigacao in prazos.get('obrigacoes', []):
        estado = obrigacao['estado']
        texto = '{} ({}) — limite {}'.format(
            obrigacao['imposto'], obrigacao['tipo'].lower(), obrigacao['data_limite'],
        )
        if obrigacao.get('valor_declarado'):
            texto += ' · devido {}'.format(_kz(obrigacao['valor_declarado']))
        if obrigacao.get('valor_pago'):
            texto += ' · pago {}'.format(_kz(obrigacao['valor_pago']))
        passos.append(_passo(
            'PRAZOS', f"PRZ-{obrigacao['imposto']}",
            texto,
            valor=obrigacao.get('em_falta'),
            norma=obrigacao.get('base_legal'),
            estado='ALERTA' if estado in ('VENCIDA', 'CUMPRIDA_FORA_PRAZO') else 'OK',
        ))
    return passos


def _fase_risco(empresa, ano, mes, contexto, numeros):
    passos = []
    cobertura = cobertura_service.calcular(empresa, ano, mes)
    passos.append(_passo(
        'RISCO', 'COB',
        'Cobertura documental {}% — nível {}'.format(
            cobertura['cobertura_geral'], cobertura['nivel'],
        ),
        estado='OK' if (cobertura['cobertura_geral'] or 0) >= 75 else 'ALERTA',
    ))
    for documento in cobertura['documentos_em_falta']:
        passos.append(_passo(
            'RISCO', 'COB-FALTA',
            '{} em falta — {}'.format(documento['tipo'], documento['desbloqueia']),
            estado='ALERTA',
        ))

    exposicao = contexto.get('exposicao_total_potencial') or Decimal('0')
    if exposicao > 0:
        passos.append(_passo(
            'RISCO', 'EXP',
            'Exposição potencial agregada (retenções + IVA + caixa).',
            valor=exposicao, estado='ALERTA',
        ))
    passos.append(_passo(
        'RISCO', 'TOTAL',
        '{} erros, {} verificações conformes, {} documentos em falta.'.format(
            numeros['contadores']['erros'],
            numeros['contadores']['ok'],
            numeros['contadores']['faltam'],
        ),
        valor=numeros['em_risco'],
        estado='ALERTA' if numeros['contadores']['erros'] else 'OK',
    ))
    return passos


def gerar(empresa, ano, mes, numeros):
    """Rasto completo da auditoria do período.

    `numeros` é o resultado de `numeros_service.calcular`, para não repetir
    o trabalho nem arriscar que as duas vistas discordem uma da outra.
    """
    contexto, _fontes = regra_engine.construir_contexto(empresa, ano, mes)

    passos = []
    passos += _fase_leitura(empresa, ano, mes)
    passos += _fase_escrituracao(empresa, ano, mes, contexto)
    passos += _fase_declaracao(empresa, contexto)
    passos += _fase_regras(empresa, ano, mes)
    passos += _fase_prazos(numeros.get('prazos', {}))
    passos += _fase_risco(empresa, ano, mes, contexto, numeros)

    return {
        'empresa': empresa.nome,
        'nif': empresa.nif,
        'periodo': f'{mes:02d}/{ano}',
        'fases': [{'codigo': c, 'nome': n} for c, n in FASES],
        'passos': passos,
        'total': len(passos),
        'alertas': sum(1 for p in passos if p['estado'] == 'ALERTA'),
        'falhas': sum(1 for p in passos if p['estado'] == 'FALHA'),
    }
