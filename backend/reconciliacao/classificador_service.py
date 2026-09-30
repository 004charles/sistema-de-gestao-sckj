"""Classificador determinístico de tipo de documento (Fase 2).

Regras por palavras-chave no nome e no conteúdo extraído — sem IA.
Se nada corresponder, devolve OUTRO (score 0). A IA só entra como
desempate na Fase 9 e nunca é decisiva por aqui.
"""
import re
import unicodedata

# Palavras-chave por tipo (comparadas sem acentos, com correspondência
# por início de palavra — 'compra' casa 'compras', 'irt' não casa 'direito').
PALAVRAS_CHAVE = {
    'BALANCETE': [
        'balancete', 'devedor', 'crededor', 'saldos da contabilidade',
        'conta contabil', 'rubrica', 'sintetica', 'sintetico',
    ],
    'MODELO7': [
        'modelo 7', 'modelo7', 'declaracao recapitulativa',
        'iva a entregar', 'iva a favor', 'liquidacao do iva', 'autoliquidacao',
    ],
    'FACTURA_VENDA': [
        'factura', 'fatura', 'cliente', 'venda', 'prestacao de servicos',
    ],
    'FACTURA_COMPRA': [
        'compra', 'fornecedor', 'despesa', 'nota de debito',
    ],
    'FOLHA_SALARIAL': [
        'salario', 'remuneracao', 'vencimento', 'funcionario',
        'recibo de pagamento',
    ],
    'EXTRACTO_BANCARIO': [
        'extracto bancario', 'extracto da conta', 'saldo bancario', 'banco',
    ],
    'RETENCOES': [
        'retencao', 'retencao na fonte', 'imposto retido',
    ],
    'COMPROVATIVOS': [
        'comprovativo', 'comprovativo de pagamento', 'recibo de pagamento',
    ],
    'IMPOSTO_INDUSTRIAL': [
        'imposto industrial', 'lucro tributavel', 'balanco fiscal',
        'declaracao do imposto industrial',
    ],
    'DECLARACAO_IRT': [
        'declaracao de irt', 'irt', 'imposto sobre o rendimento do trabalho',
    ],
    'FOLHA_SS': [
        'seguranca social', 'inss', 'contribuicoes sociais',
        'folha de contribuicoes',
    ],
}

# Ordem de desempate: em pontuações iguais, o tipo que aparece primeiro ganha.
ORDEM_DESEMPATE = [
    'MODELO7',
    'IMPOSTO_INDUSTRIAL',
    'DECLARACAO_IRT',
    'RETENCOES',
    'FOLHA_SS',
    'FOLHA_SALARIAL',
    'EXTRACTO_BANCARIO',
    'COMPROVATIVOS',
    'BALANCETE',
    'FACTURA_COMPRA',
    'FACTURA_VENDA',
]

PESO_NOME = 4
PESO_TEXTO = 1
MAX_OCORRENCIAS_TEXTO = 10


def _normalizar(texto):
    texto = unicodedata.normalize('NFKD', texto or '')
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def contar_ocorrencias(palavra, texto_normalizado):
    """Ocorrências com correspondência a início de palavra (sem falsos positivos)."""
    padrao = r'\b' + re.escape(palavra)
    return len(re.findall(padrao, texto_normalizado))


def classificar(nome_arquivo, texto):
    """Devolve {'tipo', 'score', 'palavras'} — determinístico e sempre definido."""
    nome = _normalizar(nome_arquivo)
    corpo = _normalizar(texto)

    pontuacao = {}
    encontradas = {}
    for tipo, palavras in PALAVRAS_CHAVE.items():
        pontos = 0
        usadas = []
        for palavra in palavras:
            chave = _normalizar(palavra)
            no_nome = contar_ocorrencias(chave, nome) * PESO_NOME
            no_texto = min(
                contar_ocorrencias(chave, corpo), MAX_OCORRENCIAS_TEXTO
            ) * PESO_TEXTO
            if no_nome or no_texto:
                pontos += no_nome + no_texto
                usadas.append(palavra)
        pontuacao[tipo] = pontos
        encontradas[tipo] = usadas

    melhor_tipo = 'OUTRO'
    melhor_pontos = 0
    for tipo in ORDEM_DESEMPATE:
        pontos = pontuacao.get(tipo, 0)
        if pontos > melhor_pontos:
            melhor_tipo = tipo
            melhor_pontos = pontos

    return {
        'tipo': melhor_tipo,
        'score': melhor_pontos,
        'palavras': encontradas.get(melhor_tipo, []),
    }
