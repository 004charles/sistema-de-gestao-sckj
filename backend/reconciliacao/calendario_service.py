"""Calendário fiscal angolano — prazos declarativos e de pagamento (§22).

Até aqui o sistema só olhava para trás: comentava documentos já carregados.
Evitar problemas, porém, é sobretudo **cumprir prazos**. Este serviço gera as
obrigações de cada período com a respectiva data-limite e diz, a qualquer
momento, o que falta entregar e quanto tempo resta.

Regra de Ouro aplicada: cada prazo traz a sua base legal e nasce com
`validado_juridicamente=False`. O sistema mostra o prazo e a norma que o
fundamenta, mas assinala que carece de confirmação até o utilizador validar —
exactamente como já acontece com as regras do Rule Engine.
"""
import calendar
import logging
import re
from datetime import date
from decimal import Decimal

from . import comprovativo
from . import taxas
from .models import BaseLegal, DocumentoUpload, ObrigacaoFiscal

logger = logging.getLogger('reconciliacao')

# Dias antes do limite a partir dos quais a obrigação passa a 'A_VENCER'.
JANELA_AVISO_DIAS = 10

# (imposto, tipo, regra de dia-limite, legislação, artigo, texto)
#   'ULTIMO_DIA'  -> último dia do mês seguinte ao período
#   int           -> esse dia do mês seguinte ao período
CALENDARIO = [
    (
        'IVA', 'DECLARACAO', 'ULTIMO_DIA',
        'Código do IVA — Lei n.º 7/19, alterada pela Lei n.º 42/20',
        'Art. 26.º — Entrega da declaração periódica (Modelo 7)',
        'A declaração periódica deve ser apresentada até ao último dia do mês '
        'seguinte àquele a que respeitam as operações.',
    ),
    (
        'IVA', 'PAGAMENTO', 'ULTIMO_DIA',
        'Código do IVA — Lei n.º 7/19, alterada pela Lei n.º 42/20',
        'Art. 26.º — Pagamento do imposto apurado',
        'O imposto apurado a favor do Estado é pago no mesmo prazo da entrega '
        'da declaração periódica.',
    ),
    (
        'IRT', 'PAGAMENTO', 'ULTIMO_DIA',
        'Código do IRT — Lei n.º 18/14, alterada pela Lei n.º 28/20',
        'Art. 20.º — Entrega do imposto retido na fonte',
        'O imposto retido sobre as remunerações é entregue à Repartição Fiscal '
        'competente, acompanhado do respectivo mapa.',
    ),
    (
        'INSS', 'PAGAMENTO', 10,
        'Lei da Protecção Social — Lei n.º 07/04 e Decreto Presidencial n.º 227/18',
        'Art. 14.º — Entrega das contribuições para a Segurança Social',
        'As contribuições (8% patronal + 3% do trabalhador) são entregues ao '
        'INSS até ao dia 10 do mês seguinte ao do pagamento das remunerações.',
    ),
    (
        'II_PROVISORIO', 'PAGAMENTO', 'AGOSTO_ULTIMO_DIA_UTIL',
        'Código do Imposto Industrial — Lei n.º 19/14, alterada pela Lei n.º 26/20',
        'Liquidação e pagamento provisório do Imposto Industrial',
        'Os contribuintes do regime geral procedem à autoliquidação e pagamento '
        'provisório de 2% sobre o volume total de vendas do primeiro semestre, '
        'até ao último dia útil do mês de Agosto.',
    ),
    (
        'RETENCOES', 'PAGAMENTO', 'ULTIMO_DIA',
        'Código do Imposto Industrial — Lei n.º 19/14, alterada pela Lei n.º 26/20',
        'Art. 67.º e 68.º — Entrega da retenção na fonte sobre serviços',
        'A retenção de 6,5% sobre prestações de serviços é entregue nos cofres '
        'do Estado no mês seguinte ao do pagamento ou colocação à disposição.',
    ),
]

# Documentos que provam o cumprimento de cada obrigação.
PROVA_DOCUMENTAL = {
    ('IVA', 'DECLARACAO'): ('MODELO7',),
    ('IVA', 'PAGAMENTO'): ('COMPROVATIVOS',),
    ('IRT', 'PAGAMENTO'): ('DECLARACAO_IRT', 'COMPROVATIVOS'),
    ('INSS', 'PAGAMENTO'): ('FOLHA_SS', 'COMPROVATIVOS'),
    ('RETENCOES', 'PAGAMENTO'): ('RETENCOES', 'COMPROVATIVOS'),
}

ESTADOS_DOC_VALIDOS = ('VALIDADO', 'UTILIZADO')


def _recuar_para_dia_util(momento):
    """Último dia útil igual ou anterior a `momento` (sábado/domingo recuam)."""
    from datetime import timedelta
    while momento.weekday() >= 5:  # 5 = sábado, 6 = domingo
        momento -= timedelta(days=1)
    return momento


def data_limite(ano, mes, regra_dia):
    """Data-limite de um período. O prazo corre no mês *seguinte* ao período."""
    ano_seguinte, mes_seguinte = (ano + 1, 1) if mes == 12 else (ano, mes + 1)
    ultimo = calendar.monthrange(ano_seguinte, mes_seguinte)[1]
    if regra_dia == 'AGOSTO_ULTIMO_DIA_UTIL':
        # Liquidação provisória do Imposto Industrial: vence no último dia
        # útil de Agosto do próprio ano, e não no mês seguinte ao período.
        ultimo_agosto = calendar.monthrange(ano, 8)[1]
        return _recuar_para_dia_util(date(ano, 8, ultimo_agosto))
    if regra_dia == 'ULTIMO_DIA_UTIL':
        return _recuar_para_dia_util(date(ano_seguinte, mes_seguinte, ultimo))
    dia = ultimo if regra_dia == 'ULTIMO_DIA' else min(int(regra_dia), ultimo)
    return date(ano_seguinte, mes_seguinte, dia)



# Obrigações que não são mensais nem universais.
SEMESTRAIS = {'II_PROVISORIO': 6}  # imposto -> mês que fecha o período


def _aplicavel(imposto, empresa, mes):
    """Se esta obrigação existe para esta empresa neste mês.

    O provisório do Imposto Industrial é semestral e só vincula o regime
    geral; o IVA não existe para quem está no regime de exclusão. Gerar
    obrigações que a empresa não tem seria dizer-lhe que falhou prazos
    inexistentes.
    """
    mes_de_fecho = SEMESTRAIS.get(imposto)
    if mes_de_fecho is not None and mes != mes_de_fecho:
        return False
    if imposto == 'II_PROVISORIO':
        return empresa.regime_iva == taxas.REGIME_GERAL
    if imposto == 'IVA':
        return empresa.tem_obrigacoes_iva
    return True


def _base_legal(legislacao, artigo, texto):
    """Base legal do prazo. Nasce por validar — nunca se afirma sem prova."""
    base, _ = BaseLegal.objects.get_or_create(
        legislacao=legislacao,
        artigo=artigo,
        defaults={'texto': texto, 'validado_juridicamente': False},
    )
    return base


def _estado(obrigacao, hoje):
    """Estado derivado da data-limite e da prova de cumprimento."""
    if obrigacao.data_cumprimento:
        return (
            'CUMPRIDA' if obrigacao.data_cumprimento <= obrigacao.data_limite
            else 'CUMPRIDA_FORA_PRAZO'
        )
    dias = (obrigacao.data_limite - hoje).days
    if dias < 0:
        return 'VENCIDA'
    if dias <= JANELA_AVISO_DIAS:
        return 'A_VENCER'
    return 'PENDENTE'


def gerar(empresa, ano, mes, hoje=None):
    """Cria/actualiza as obrigações do período e devolve-as ordenadas por prazo.

    Idempotente: correr de novo actualiza estados, não duplica obrigações.
    """
    hoje = hoje or date.today()
    documentos = list(
        DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, mes=mes,
            estado__in=ESTADOS_DOC_VALIDOS,
        )
    )
    # Guias e comprovativos de todo o período, lidos uma só vez: qualquer
    # documento pode conter a prova de pagamento de qualquer imposto.
    texto_periodo = '\n'.join(d.texto_extraido or '' for d in documentos)
    guias = comprovativo.extrair_guias(texto_periodo)
    pagamentos = comprovativo.extrair_pagamentos(texto_periodo)

    obrigacoes = []

    for imposto, tipo, regra_dia, legislacao, artigo, texto in CALENDARIO:
        if not _aplicavel(imposto, empresa, mes):
            continue
        limite = data_limite(ano, mes, regra_dia)
        base = _base_legal(legislacao, artigo, texto)

        tipos_prova = PROVA_DOCUMENTAL.get((imposto, tipo), ())
        prova = next(
            (d for d in documentos if d.tipo in tipos_prova), None
        )

        obrigacao, _ = ObrigacaoFiscal.objects.get_or_create(
            empresa=empresa, imposto=imposto, tipo=tipo, ano=ano, mes=mes,
            defaults={'data_limite': limite, 'base_legal': base},
        )
        obrigacao.data_limite = limite
        obrigacao.base_legal = base

        if prova is not None:
            obrigacao.documento = prova

        if obrigacao.tipo == 'PAGAMENTO':
            obrigacao.valor_declarado = _valor_declarado(
                imposto, documentos, empresa, ano, mes
            )
            # A data que conta é a da operação bancária, não a do upload.
            # Usar o carimbo do upload dizia a uma empresa que pagou a 10 de
            # Agosto, mas carregou os papéis em Outubro, que falhou o prazo.
            pagamento, confianca = comprovativo.conciliar(
                guias, pagamentos, imposto, obrigacao.valor_declarado
            )
            if pagamento:
                obrigacao.valor_pago = pagamento['valor']
                obrigacao.data_cumprimento = pagamento['data']
                obrigacao.observacoes = (
                    f"Pagamento conciliado pela {confianca}"
                    + (f" {pagamento['referencia']}" if pagamento.get('referencia') else '')
                )
            else:
                obrigacao.valor_pago = None
                obrigacao.data_cumprimento = None
        elif prova is not None and obrigacao.data_cumprimento is None:
            # Entrega de declaração: a data vem do comprovativo da AGT.
            obrigacao.data_cumprimento = _data_entrega(prova)

        obrigacao.estado = _estado(obrigacao, hoje)
        obrigacao.save()
        obrigacoes.append(obrigacao)

    return sorted(obrigacoes, key=lambda o: o.data_limite)


def _valor_declarado(imposto, documentos, empresa, ano, mes):
    """Quanto é que este imposto diz que há a pagar no período.

    Responde à metade esquerda da pergunta "declarei, mas paguei?". O IVA sai
    do campo 37 do Modelo 7 (a fonte oficial); os restantes impostos saem dos
    saldos credores que a própria contabilidade apurou. Devolve `None` quando
    não há base para afirmar nada — nunca zero por omissão, que se leria como
    "não há nada a pagar".
    """
    from .models import Contabilidade

    if imposto == 'IVA':
        documento = next((d for d in documentos if d.tipo == 'MODELO7'), None)
        if documento and documento.texto_extraido:
            from . import agt_modelo7
            try:
                return agt_modelo7.parse(documento.texto_extraido)['iva_pagar']
            except Exception:
                logger.exception('Falha a ler o campo 37 do Modelo 7 %s', documento.id)
        return None

    if imposto == 'II_PROVISORIO':
        # 2% sobre o volume de vendas do primeiro semestre. Sem os seis meses
        # carregados não se arrisca um valor: devolve-se None, que a interface
        # mostra como "—" em vez de um zero que se leria como "nada a pagar".
        vendas = _vendas_primeiro_semestre(empresa, ano)
        if vendas is None:
            return None
        return (vendas * taxas.TAXA_II_PROVISORIO).quantize(Decimal('0.01'))

    # IRT e retenções: a liquidação da AGT é a fonte oficial e prevalece
    # sobre o saldo contabilístico. É precisamente onde as duas divergem que
    # está o achado — a SCKJ liquidou 45.500,00 à AGT e contabilizou 45.000,00.
    liquidado = _liquidacao_agt(imposto, documentos)
    if liquidado is not None:
        return liquidado

    # Contas do PGC onde cada imposto fica a aguardar liquidação.
    contas = {'IRT': ('343',), 'INSS': ('3492',), 'RETENCOES': ('3493',)}.get(imposto)
    if not contas:
        return None

    linhas = Contabilidade.objects.filter(empresa=empresa, ano=ano, mes=mes)
    total = Decimal('0.00')
    encontrou = False
    for linha in linhas:
        codigo = linha.conta_codigo.replace('.', '').strip()
        if codigo.startswith(contas):
            total += linha.valor_credito - linha.valor_debito
            encontrou = True
    return max(total, Decimal('0.00')) if encontrou else None



# "Imposto a Pagar ao Estado 45.500,00" nos comprovativos de liquidação da AGT.
_RE_LIQUIDACAO = re.compile(
    r'(?:Imposto\s+a\s+Pagar\s+ao\s+Estado|Valor\s+a\s+Pagar)\s+(\d{1,3}(?:[.\s]\d{3})*,\d{2})',
    re.IGNORECASE,
)
# O Grupo B do IRT é a retenção de 6,5% sobre prestadores de serviço; o
# Grupo A é o imposto dos trabalhadores por conta de outrem.
_RE_GRUPO_B = re.compile(r'GRUPO\s*B', re.IGNORECASE)
# Referência do documento de liquidação, com ou sem o prefixo do ano.
_RE_REF_DOC = re.compile(r'(?:20\d{2}\.)?(\d{15})(?!\d)')



def _vendas_primeiro_semestre(empresa, ano):
    """Volume de vendas de Janeiro a Junho, somado da contabilidade.

    Devolve `None` se faltar algum mês: um semestre incompleto daria uma
    base demasiado baixa e um imposto provisório subestimado.
    """
    from .models import Contabilidade

    linhas = Contabilidade.objects.filter(
        empresa=empresa, ano=ano, mes__gte=1, mes__lte=6,
    )
    meses_com_dados = set(linhas.values_list('mes', flat=True))
    if len(meses_com_dados) < 6:
        return None

    total = Decimal('0.00')
    for linha in linhas:
        codigo = linha.conta_codigo.replace('.', '').strip()
        if codigo.startswith(('61', '62')):
            total += linha.valor_credito - linha.valor_debito
    return max(total, Decimal('0.00'))


def _liquidacao_agt(imposto, documentos):
    """Valor liquidado à AGT, lido dos comprovativos de liquidação.

    Um mesmo imposto espalha-se por várias folhas — comprovativo, nota de
    liquidação e recibo — e nem todas repetem o grupo de incidência. O que as
    liga é o número de referência do documento, por isso os blocos são
    agrupados por referência antes de se decidir a que imposto pertencem.
    """
    if imposto not in ('IRT', 'RETENCOES'):
        return None
    from .comprovativo import _valor

    liquidacoes = {}
    for documento in documentos:
        texto = documento.texto_extraido or ''
        if not texto:
            continue
        blocos = re.split(
            r'(?=COMPROVATIVO DE LIQUIDA|NOTA DE LIQUIDA|RECIBO DE PAGAMENTO)',
            texto,
        )
        for bloco in blocos:
            achado_ref = _RE_REF_DOC.search(bloco)
            if not achado_ref:
                continue
            ref = achado_ref.group(1)
            entrada = liquidacoes.setdefault(ref, {'valor': None, 'grupo_b': False})
            if _RE_GRUPO_B.search(bloco):
                entrada['grupo_b'] = True
            achado_valor = _RE_LIQUIDACAO.search(bloco)
            if achado_valor and entrada['valor'] is None:
                entrada['valor'] = _valor(achado_valor.group(1))

    quer_grupo_b = imposto == 'RETENCOES'
    for entrada in liquidacoes.values():
        if entrada['valor'] is not None and entrada['grupo_b'] == quer_grupo_b:
            return entrada['valor']
    return None

def _data_entrega(documento):
    """Data de entrega real: a `DATA RECEPÇÃO` da AGT, se o documento a tiver."""
    if documento.tipo == 'MODELO7' and documento.texto_extraido:
        from . import agt_modelo7
        try:
            lido = agt_modelo7.parse(documento.texto_extraido)
            if lido.get('data_recepcao'):
                return lido['data_recepcao']
        except Exception:
            logger.exception('Falha a ler a data de recepção do Modelo 7 %s', documento.id)
    return documento.created_at.date() if documento.created_at else None


def resumo(empresa, ano, mes, hoje=None):
    """Panorama dos prazos para o cabeçalho da auditoria."""
    hoje = hoje or date.today()
    obrigacoes = gerar(empresa, ano, mes, hoje=hoje)

    vencidas = [o for o in obrigacoes if o.estado == 'VENCIDA']
    a_vencer = [o for o in obrigacoes if o.estado == 'A_VENCER']
    fora_prazo = [o for o in obrigacoes if o.estado == 'CUMPRIDA_FORA_PRAZO']
    cumpridas = [o for o in obrigacoes if o.estado == 'CUMPRIDA']

    proxima = next(
        (o for o in obrigacoes if o.estado in ('A_VENCER', 'PENDENTE')), None
    )

    return {
        'total': len(obrigacoes),
        'cumpridas': len(cumpridas),
        'cumpridas_fora_prazo': len(fora_prazo),
        'vencidas': len(vencidas),
        'a_vencer': len(a_vencer),
        'proxima': _serializar(proxima, hoje) if proxima else None,
        'obrigacoes': [_serializar(o, hoje) for o in obrigacoes],
        'valor_por_liquidar': str(
            sum((o.em_falta for o in obrigacoes), Decimal('0.00'))
        ),
    }


def _serializar(obrigacao, hoje):
    dias = (obrigacao.data_limite - hoje).days
    return {
        'id': obrigacao.id,
        'imposto': obrigacao.imposto,
        'tipo': obrigacao.tipo,
        'ano': obrigacao.ano,
        'mes': obrigacao.mes,
        'data_limite': obrigacao.data_limite.isoformat(),
        'data_cumprimento': (
            obrigacao.data_cumprimento.isoformat()
            if obrigacao.data_cumprimento else None
        ),
        'dias': dias,
        'estado': obrigacao.estado,
        'valor_declarado': (
            str(obrigacao.valor_declarado)
            if obrigacao.valor_declarado is not None else None
        ),
        'valor_pago': (
            str(obrigacao.valor_pago) if obrigacao.valor_pago is not None else None
        ),
        'em_falta': str(obrigacao.em_falta),
        'base_legal': f'{obrigacao.base_legal.legislacao} — {obrigacao.base_legal.artigo}',
        'requer_validacao_juridica': not obrigacao.base_legal.validado_juridicamente,
    }
