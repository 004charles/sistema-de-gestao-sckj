"""Leitura do Balancete de Verificação (PGC Angolano).

Até aqui, o processamento de um dossiê não lia o balancete: fabricava **nove
contas sintéticas** a partir de valores soltos (`pdf_service.extrair_dados_
balancete`) e gravava-as como se fossem a contabilidade do período. Essas nove
contas nunca equilibram por construção, pelo que a regra CONT-002 ("o débito
tem de igualar o crédito") acusava milhões de diferença em empresas cujo
balancete real está perfeitamente equilibrado.

Aqui lê-se o documento como ele é: uma linha por conta, no formato

    <código> <descrição> <mov.débito> <mov.crédito> <saldo.débito> <saldo.crédito>

O cuidado essencial é a **hierarquia**. O balancete repete os mesmos valores em
cada nível (31 → 311 → 3112 → 31121), por isso somar todas as linhas conta o
mesmo movimento quatro vezes. Somam-se apenas as contas de raiz — aquelas que
não são o prolongamento de nenhuma outra presente no documento.
"""
import re
from decimal import Decimal, InvalidOperation

# "31 CLIENTES 11 366 705,64 11 366 705,64 0,00 0,00" — o separador de
# milhares tanto pode ser espaço (Cegid) como ponto.
_LINHA = re.compile(
    r'^\s*(\d{2,12})\s+(.+?)\s+'
    r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s+'
    r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s+'
    r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s+'
    r'(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*$'
)

# Linhas de subtotal do próprio relatório — não são contas.
_TOTAIS = ('soma líquida', 'soma liquida', 'soma saldos', 'total')


def _valor(texto):
    if texto is None:
        return Decimal('0.00')
    limpo = str(texto).replace(' ', '').replace(' ', '').strip()
    if ',' in limpo and '.' in limpo:
        if limpo.rfind(',') > limpo.rfind('.'):
            limpo = limpo.replace('.', '').replace(',', '.')
        else:
            limpo = limpo.replace(',', '')
    elif ',' in limpo:
        limpo = limpo.replace(',', '.')
    try:
        return Decimal(limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _e_total(linha):
    inicio = linha.strip().lower()
    return any(inicio.startswith(t) for t in _TOTAIS)


def extrair_linhas(texto):
    """Todas as contas do balancete, na ordem em que aparecem."""
    linhas = []
    for bruta in (texto or '').split('\n'):
        if _e_total(bruta):
            continue
        achado = _LINHA.match(bruta)
        if achado:
            codigo, descricao, mov_d, mov_c, saldo_d, saldo_c = achado.groups()
            linhas.append({
                'codigo': codigo,
                'descricao': descricao.strip(),
                'mov_debito': _valor(mov_d),
                'mov_credito': _valor(mov_c),
                'saldo_debito': _valor(saldo_d),
                'saldo_credito': _valor(saldo_c),
            })
            continue

        # Suporte para linhas tabuladas por pipe "|" (típicas de folhas Excel .xlsx ou CSV)
        if '|' in bruta:
            partes = [p.strip() for p in bruta.split('|') if p.strip()]
            if len(partes) >= 6 and re.match(r'^\d{2,12}$', partes[0]):
                codigo = partes[0]
                descricao = partes[1]
                mov_d = partes[2]
                mov_c = partes[3]
                saldo_d = partes[4]
                saldo_c = partes[5]
                linhas.append({
                    'codigo': codigo,
                    'descricao': descricao,
                    'mov_debito': _valor(mov_d),
                    'mov_credito': _valor(mov_c),
                    'saldo_debito': _valor(saldo_d),
                    'saldo_credito': _valor(saldo_c),
                })
    return linhas


def contas_raiz(linhas):
    """Contas que não são o prolongamento de nenhuma outra do documento.

    O balancete repete os valores por nível hierárquico. Só as raízes podem
    ser somadas sem contar o mesmo movimento várias vezes.
    """
    codigos = sorted({l['codigo'] for l in linhas}, key=len)
    raizes = set()
    for codigo in codigos:
        if not any(codigo != r and codigo.startswith(r) for r in raizes):
            raizes.add(codigo)
    vistas = set()
    resultado = []
    for linha in linhas:
        if linha['codigo'] in raizes and linha['codigo'] not in vistas:
            vistas.add(linha['codigo'])
            resultado.append(linha)
    return resultado


def contas_folha(linhas):
    """Contas sem desdobramento — o maior detalhe disponível."""
    codigos = {l['codigo'] for l in linhas}
    return [
        l for l in linhas
        if not any(outro != l['codigo'] and outro.startswith(l['codigo'])
                   for outro in codigos)
    ]


def parse(texto):
    """Lê o balancete. `completo=False` quando não há contas suficientes
    para afirmar o que quer que seja sobre o equilíbrio."""
    linhas = extrair_linhas(texto)
    raizes = contas_raiz(linhas)

    total_debito = sum((l['mov_debito'] for l in raizes), Decimal('0.00'))
    total_credito = sum((l['mov_credito'] for l in raizes), Decimal('0.00'))
    diferenca = total_debito - total_credito

    # Sem contas de raiz não se pode dizer que "está desequilibrado": pode
    # apenas não ter sido possível ler o documento.
    completo = len(raizes) >= 2 and total_debito > 0

    return {
        'linhas': linhas,
        'raizes': raizes,
        'folhas': contas_folha(linhas),
        'total_debito': total_debito,
        'total_credito': total_credito,
        'diferenca': abs(diferenca),
        'equilibrado': abs(diferenca) <= Decimal('0.01'),
        'completo': completo,
        'periodo': periodo(texto),
    }


_MESES = {
    'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'março': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9,
    'outubro': 10, 'novembro': 11, 'dezembro': 12,
}


def periodo(texto):
    """Ano e mês do cabeçalho: "Balancete Geral (Julho) - 2026".

    Lê-se o título e não a `Data Contab.`, que é a data de impressão e pode
    ser de outro mês — foi o que fez um balancete de Julho ser arquivado
    como sendo de Agosto.
    """
    achado = re.search(
        r'Balancete\s+Geral\s*\(\s*([A-Za-zçÇãÃéÉ]+)\s*\)\s*-?\s*(\d{4})',
        texto or '', re.IGNORECASE,
    )
    if achado:
        mes = _MESES.get(achado.group(1).strip().lower())
        return (int(achado.group(2)), mes) if mes else (int(achado.group(2)), None)

    m_data = re.search(r'(?:per[ií]odo|m[eê]s)[:\s]+(\d{1,2})[/\-](\d{4})', texto or '', re.IGNORECASE)
    if m_data:
        m, a = int(m_data.group(1)), int(m_data.group(2))
        if 1 <= m <= 12 and 2000 <= a <= 2100:
            return (a, m)

    m_ano = re.search(r'\b(202\d)\b', texto or '')
    if m_ano:
        for nome_m, num_m in _MESES.items():
            if re.search(rf'\b{nome_m}\b', texto or '', re.IGNORECASE):
                return (int(m_ano.group(1)), num_m)
        return (int(m_ano.group(1)), None)

    return None, None
