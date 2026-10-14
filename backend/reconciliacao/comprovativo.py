"""Leitura de guias e comprovativos de pagamento de impostos.

Fecha a segunda metade da pergunta "declarei, mas paguei?". Sem isto, o
calendário fiscal só sabia que *existia* um ficheiro no período e usava a data
de upload como data de cumprimento — pelo que uma empresa que pagou tudo a
tempo, mas carregou os documentos em Outubro, recebia quatro avisos de
incumprimento. A data que conta é a do comprovativo, não a do carregamento.

Dois formatos:

- **Guia de pagamento** (INSS, AGT): referência, valor, vencimento e mês de
  referência. É a dívida.
- **Comprovativo digital** (Multicaixa Express, bancos): data-hora, montante e
  a mesma referência. É o pagamento.

A referência liga os dois sem ambiguidade. Quando não há guia, resta a
correspondência pelo valor, que é assinalada como tal — nunca se apresenta um
palpite como se fosse prova.
"""
import re
from datetime import date
from decimal import Decimal, InvalidOperation

# Entidades de cobrança conhecidas (primeiro grupo da referência).
ENTIDADES = {
    '60300': 'INSS',
    '60001': 'AGT',
}

_VALOR = r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})'

_RE_DATA_HORA = re.compile(r'(\d{4})-(\d{2})-(\d{2})[\s]+\d{2}:\d{2}:\d{2}')
_RE_MONTANTE = re.compile(r'Montante\s+' + _VALOR, re.IGNORECASE)
_RE_REFERENCIA = re.compile(r'Refer[êe]ncia\s*(?:do\s*pagamento)?\s*[:\s]\s*(\d[\d\s]{14,30}\d)', re.IGNORECASE)
_RE_GUIA_VALOR = re.compile(r'VALOR\s*\n?\s*(?:Kz\s*)?' + _VALOR, re.IGNORECASE)
_RE_KZ = re.compile(r'Kz\s*' + _VALOR)
_RE_VENCIMENTO = re.compile(r'VENCIMENTO\s*\n?\s*\S*\s*(\d{2})/(\d{2})/(\d{4})', re.IGNORECASE)
# O "07/2026" cai na linha seguinte ao cabeçalho, depois da data de emissão.
# O lookbehind `(?<!/)` evita apanhar o "08/2026" de dentro de "10/08/2026".
_RE_MES_REF = re.compile(r'(?<!/)(?<!\d)(\d{2})/(\d{4})(?!\d)')


def _valor(texto):
    limpo = str(texto).replace(' ', '').replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return Decimal(limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _normalizar_referencia(texto):
    return re.sub(r'\D', '', texto or '')


def entidade_da_referencia(referencia):
    """INSS, AGT ou None. Os cinco primeiros dígitos identificam a entidade."""
    digitos = _normalizar_referencia(referencia)
    return ENTIDADES.get(digitos[:5])


def extrair_pagamentos(texto):
    """Pagamentos efectivamente realizados, com a data real da operação."""
    pagamentos = []
    # Cada comprovativo digital é um bloco; processa-se linha a linha e
    # fecha-se um pagamento quando já tem data e montante.
    actual = {}
    for linha in (texto or '').split('\n'):
        achado_data = _RE_DATA_HORA.search(linha)
        if achado_data:
            ano, mes, dia = (int(g) for g in achado_data.groups())
            try:
                actual['data'] = date(ano, mes, dia)
            except ValueError:
                pass

        achado_montante = _RE_MONTANTE.search(linha)
        if achado_montante:
            actual['valor'] = _valor(achado_montante.group(1))

        achado_ref = _RE_REFERENCIA.search(linha)
        if achado_ref:
            actual['referencia'] = _normalizar_referencia(achado_ref.group(1))

        if 'data' in actual and 'valor' in actual:
            actual.setdefault('referencia', None)
            actual['entidade'] = entidade_da_referencia(actual.get('referencia'))
            pagamentos.append(actual)
            actual = {}

    return pagamentos


def extrair_guias(texto):
    """Guias de pagamento: o que a entidade diz que há a pagar, e até quando."""
    guias = []
    for bloco in re.split(r'GUIA DE PAGAMENTO', texto or '', flags=re.IGNORECASE)[1:]:
        guia = {}

        achado_ref = re.search(r'(\d{5}\s+\d{5}\s+\d{5}\s+\d{5})', bloco)
        if achado_ref:
            guia['referencia'] = _normalizar_referencia(achado_ref.group(1))
            guia['entidade'] = entidade_da_referencia(guia['referencia'])

        achado_valor = _RE_KZ.search(bloco) or _RE_GUIA_VALOR.search(bloco)
        if achado_valor:
            guia['valor'] = _valor(achado_valor.group(1))

        achado_venc = _RE_VENCIMENTO.search(bloco)
        if achado_venc:
            dia, mes, ano = (int(g) for g in achado_venc.groups())
            try:
                guia['vencimento'] = date(ano, mes, dia)
            except ValueError:
                pass

        # O período é o MÊS DE REFERÊNCIA e nunca a data de emissão: uma guia
        # de Julho é emitida e vence em Agosto, e confundi-los arquivava o
        # documento no mês errado.
        if re.search(r'M[ÊE]S\s+DE\s+REFER[ÊE]NCIA', bloco, re.IGNORECASE):
            achado_mes = _RE_MES_REF.search(bloco)
            if achado_mes and 1 <= int(achado_mes.group(1)) <= 12:
                guia['mes'] = int(achado_mes.group(1))
                guia['ano'] = int(achado_mes.group(2))

        if guia.get('referencia') or guia.get('valor'):
            guias.append(guia)

    # Blocos repetidos (a guia traz "Via - Contribuinte" e "Via - Entidade").
    unicas, vistas = [], set()
    for guia in guias:
        chave = (guia.get('referencia'), guia.get('valor'))
        if chave not in vistas:
            vistas.add(chave)
            unicas.append(guia)
    return unicas


def conciliar(guias, pagamentos, imposto, valor_esperado=None):
    """Encontra o pagamento que liquida este imposto.

    Devolve `(pagamento, confianca)`, onde a confiança diz ao utilizador em
    que é que o sistema se baseou:
      - `referencia`: a referência do pagamento é a da guia. É prova.
      - `valor`: só o montante coincide. É indício, e é apresentado como tal.
    """
    entidade = 'INSS' if imposto == 'INSS' else 'AGT'

    refs_do_imposto = {
        g['referencia'] for g in guias
        if g.get('referencia') and (
            g.get('entidade') == entidade or g.get('entidade') is None
        )
    }
    for pagamento in pagamentos:
        if pagamento.get('referencia') and pagamento['referencia'] in refs_do_imposto:
            return pagamento, 'referencia'

    if valor_esperado is not None:
        for pagamento in pagamentos:
            if pagamento.get('entidade') not in (None, entidade):
                continue
            # Tolerância de 1 Kz: as guias são frequentemente arredondadas
            # ao kwanza (240.289,32 contabilizado, 240.290,00 pago).
            if abs(pagamento['valor'] - Decimal(valor_esperado)) <= Decimal('1.00'):
                return pagamento, 'valor'

    return None, None
