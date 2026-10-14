"""Tabela de taxas e regimes fiscais angolanos.

Até aqui o sistema conhecia três taxas — IVA 14%, retenção 6,5% e INSS 8%+3% —
espalhadas por literais no meio do código. Tudo o resto (taxas reduzidas de
IVA, Imposto Industrial, Imposto Provisório, Predial, IMV, escalões de IRT)
não existia, e os regimes de IVA eram texto livre: a mesma base de dados tinha
"Geral", "Regime Geral" e "Simplificado" como se fossem coisas diferentes.

Este módulo é a fonte única. Cada taxa traz a norma que a fundamenta, e nada
aqui dispensa validação jurídica: tal como as regras do Rule Engine, estes
valores são para o utilizador confirmar, não para o sistema afirmar sozinho.

Verificado em Outubro de 2026 contra o Portal do Contribuinte (AGT) e a Lei
n.º 14/25 (OGE 2026). Mudou a lei? É este ficheiro que se actualiza.
"""
from decimal import Decimal

VIGENCIA = '2026'


# ---------------------------------------------------------------------------
# Regimes de IVA — determinados pelo volume de negócios do ano anterior
# ---------------------------------------------------------------------------

REGIME_EXCLUSAO = 'EXCLUSAO'
REGIME_SIMPLIFICADO = 'SIMPLIFICADO'
REGIME_GERAL = 'GERAL'

REGIMES_IVA = [
    (REGIME_EXCLUSAO, 'Regime de Exclusão'),
    (REGIME_SIMPLIFICADO, 'Regime Simplificado'),
    (REGIME_GERAL, 'Regime Geral'),
]

LIMIAR_SIMPLIFICADO = Decimal('25000000.00')   # 25 milhões de Kz
LIMIAR_GERAL = Decimal('350000000.00')         # 350 milhões de Kz

# Como o sistema deve tratar cada regime.
CARACTERISTICAS_REGIME = {
    REGIME_EXCLUSAO: {
        'nome': 'Regime de Exclusão',
        'limite': f'Volume de negócios inferior a {LIMIAR_SIMPLIFICADO:,.0f} Kz',
        'tem_obrigacoes_iva': False,
        'taxa': None,
        'direito_deducao': False,
        'resumo': 'Sem obrigações de IVA. Não liquida nem deduz.',
    },
    REGIME_SIMPLIFICADO: {
        'nome': 'Regime Simplificado',
        'limite': (
            f'Volume de negócios entre {LIMIAR_SIMPLIFICADO:,.0f} e '
            f'{LIMIAR_GERAL:,.0f} Kz'
        ),
        'tem_obrigacoes_iva': True,
        'taxa': Decimal('0.07'),
        'direito_deducao': False,
        'resumo': '7% sobre o valor efectivamente recebido, sem direito à dedução.',
    },
    REGIME_GERAL: {
        'nome': 'Regime Geral',
        'limite': f'Volume de negócios igual ou superior a {LIMIAR_GERAL:,.0f} Kz',
        'tem_obrigacoes_iva': True,
        'taxa': Decimal('0.14'),
        'direito_deducao': True,
        'resumo': '14% com direito à dedução do IVA suportado.',
    },
}

# Grafias que já existem na base de dados e nos documentos, para normalizar
# sem perder o histórico.
_SINONIMOS_REGIME = {
    'geral': REGIME_GERAL,
    'regime geral': REGIME_GERAL,
    'normal': REGIME_GERAL,
    'regime normal': REGIME_GERAL,
    'simplificado': REGIME_SIMPLIFICADO,
    'regime simplificado': REGIME_SIMPLIFICADO,
    'exclusao': REGIME_EXCLUSAO,
    'exclusão': REGIME_EXCLUSAO,
    'regime de exclusao': REGIME_EXCLUSAO,
    'regime de exclusão': REGIME_EXCLUSAO,
    'isencao': REGIME_EXCLUSAO,
    'isenção': REGIME_EXCLUSAO,
}


def normalizar_regime(valor):
    """Converte qualquer grafia conhecida no código canónico, ou `None`."""
    if not valor:
        return None
    chave = ' '.join(str(valor).strip().lower().split())
    if chave.upper() in dict(REGIMES_IVA):
        return chave.upper()
    return _SINONIMOS_REGIME.get(chave)


def regime_por_volume(volume_negocios):
    """Regime que a lei impõe a este volume de negócios anual."""
    if volume_negocios is None:
        return None
    volume = Decimal(str(volume_negocios))
    if volume < LIMIAR_SIMPLIFICADO:
        return REGIME_EXCLUSAO
    if volume < LIMIAR_GERAL:
        return REGIME_SIMPLIFICADO
    return REGIME_GERAL


# ---------------------------------------------------------------------------
# IVA — taxas por tipo de operação
# ---------------------------------------------------------------------------

# (código, taxa, descrição, base legal)
TAXAS_IVA = [
    ('NORMAL', Decimal('0.14'),
     'Taxa geral — transmissões de bens e prestações de serviços',
     'Código do IVA — Lei n.º 7/19, alterada pela Lei n.º 42/20, art. 27.º'),
    ('SIMPLIFICADO', Decimal('0.07'),
     'Regime simplificado — sobre o valor recebido',
     'Código do IVA — regime simplificado'),
    ('HOTELARIA', Decimal('0.07'),
     'Hotelaria e restauração, cumpridos os requisitos legais',
     'Código do IVA — taxa reduzida'),
    ('ESSENCIAIS', Decimal('0.05'),
     'Produtos alimentares de largo consumo e insumos agrícolas',
     'Código do IVA — lista anexa (cesta básica)'),
    ('EQUIPAMENTO_INDUSTRIAL', Decimal('0.05'),
     'Importação e transmissão de equipamento industrial (OGE 2026)',
     'Lei n.º 14/25 — Orçamento Geral do Estado para 2026'),
    ('CABINDA', Decimal('0.02'),
     'Regime especial da Província de Cabinda',
     'Código do IVA — regime especial de Cabinda'),
    ('LOCACAO_SIMPLIFICADO', Decimal('0.01'),
     'Locação imobiliária no regime simplificado',
     'Código do IVA — regime simplificado'),
    ('ISENTA', Decimal('0.00'),
     'Operação isenta ou não tributada',
     'Código do IVA — art. 10.º e 12.º'),
]

TAXAS_IVA_VALIDAS = sorted({taxa for _, taxa, _, _ in TAXAS_IVA})

# Margem de tolerância ao comparar uma taxa implícita: arredondamentos ao
# cêntimo em milhões de kwanzas deslocam a taxa na quarta casa decimal.
TOLERANCIA_TAXA = Decimal('0.0015')


def taxa_implicita(base_tributavel, imposto):
    """Taxa que resulta dos valores declarados. `None` se não for calculável."""
    if not base_tributavel:
        return None
    base = Decimal(str(base_tributavel))
    if base <= 0:
        return None
    return (Decimal(str(imposto or 0)) / base).quantize(Decimal('0.000001'))


def classificar_taxa(taxa):
    """Taxa legal correspondente, ou `None` se não corresponder a nenhuma.

    Devolver `None` não significa "ilegal": pode ser uma declaração que mistura
    operações a taxas diferentes. É por isso que a regra que usa esta função
    pede confirmação em vez de afirmar que há erro.
    """
    if taxa is None:
        return None
    for codigo, legal, descricao, base_legal in TAXAS_IVA:
        if abs(taxa - legal) <= TOLERANCIA_TAXA:
            return {
                'codigo': codigo, 'taxa': legal,
                'descricao': descricao, 'base_legal': base_legal,
            }
    return None


# ---------------------------------------------------------------------------
# Imposto Industrial
# ---------------------------------------------------------------------------

TAXA_II_GERAL = Decimal('0.25')
TAXA_II_AGRICOLA = Decimal('0.10')
# Pagamento provisório: 2% sobre as vendas do primeiro semestre, até ao
# último dia útil de Agosto.
TAXA_II_PROVISORIO = Decimal('0.02')
LIMIAR_II_SIMPLIFICADO_USD = Decimal('250000')

TAXAS_IMPOSTO_INDUSTRIAL = [
    ('GERAL', TAXA_II_GERAL, 'Taxa geral sobre o lucro tributável',
     'Código do Imposto Industrial — Lei n.º 19/14, alterada pela Lei n.º 26/20'),
    ('AGRICOLA', TAXA_II_AGRICOLA,
     'Actividades agrícolas, aquícolas, apícolas, avícolas, piscatórias, '
     'silvícolas e pecuárias',
     'Código do Imposto Industrial — Lei n.º 26/20'),
    ('PROVISORIO', TAXA_II_PROVISORIO,
     'Liquidação provisória sobre as vendas do 1.º semestre',
     'Código do Imposto Industrial — liquidação provisória'),
]

# Retenção na fonte sobre prestações de serviço.
TAXA_RETENCAO_SERVICOS = Decimal('0.065')


# ---------------------------------------------------------------------------
# IRT — Lei n.º 14/25 (OGE 2026)
# ---------------------------------------------------------------------------

IRT_ISENCAO_MENSAL = Decimal('150000.00')

# (limite superior do escalão ou None, parcela fixa, taxa marginal, excesso sobre)
# Tabela publicada: a parcela fixa do 2.º escalão cria uma descontinuidade
# em 150.000 Kz. Está assim na lei e é assim que se reproduz — corrigi-la
# "para fazer sentido" daria um imposto diferente do que a AGT liquida.
IRT_ESCALOES = [
    (Decimal('150000'), Decimal('0'), Decimal('0.00'), Decimal('0')),
    (Decimal('200000'), Decimal('12500'), Decimal('0.16'), Decimal('150000')),
    (Decimal('300000'), Decimal('31250'), Decimal('0.18'), Decimal('200000')),
    (Decimal('500000'), Decimal('49250'), Decimal('0.19'), Decimal('300000')),
    (Decimal('1000000'), Decimal('87250'), Decimal('0.20'), Decimal('500000')),
    (Decimal('1500000'), Decimal('187250'), Decimal('0.21'), Decimal('1000000')),
    (Decimal('2000000'), Decimal('292250'), Decimal('0.22'), Decimal('1500000')),
    (Decimal('2500000'), Decimal('402250'), Decimal('0.23'), Decimal('2000000')),
    (Decimal('5000000'), Decimal('517250'), Decimal('0.24'), Decimal('2500000')),
    (Decimal('10000000'), Decimal('1117250'), Decimal('0.245'), Decimal('5000000')),
    (None, Decimal('2342250'), Decimal('0.25'), Decimal('10000000')),
]

# Grupo B (trabalho por conta própria) e Grupo C.
TAXA_IRT_GRUPO_B = Decimal('0.065')
TAXA_IRT_GRUPO_C = Decimal('0.065')


def irt_devido(materia_colectavel):
    """IRT do Grupo A sobre a matéria colectável mensal."""
    valor = Decimal(str(materia_colectavel or 0))
    if valor <= IRT_ISENCAO_MENSAL:
        return Decimal('0.00')
    for limite, parcela_fixa, taxa, excesso_sobre in IRT_ESCALOES:
        if limite is None or valor <= limite:
            return (
                parcela_fixa + (valor - excesso_sobre) * taxa
            ).quantize(Decimal('0.01'))
    return Decimal('0.00')


# ---------------------------------------------------------------------------
# Segurança Social
# ---------------------------------------------------------------------------

TAXA_INSS_PATRONAL = Decimal('0.08')
TAXA_INSS_TRABALHADOR = Decimal('0.03')
TAXA_INSS_TOTAL = TAXA_INSS_PATRONAL + TAXA_INSS_TRABALHADOR


# ---------------------------------------------------------------------------
# Imposto Predial, Imposto sobre Veículos e Imposto do Selo
# ---------------------------------------------------------------------------

# Arrendamento: 25% sobre 60% da renda (40% de dedução por conservação),
# o que dá 15% efectivos sobre a renda bruta — e é essa a taxa que o
# inquilino com contabilidade organizada retém.
TAXA_IP_ARRENDAMENTO_NOMINAL = Decimal('0.25')
IP_DEDUCAO_CONSERVACAO = Decimal('0.40')
TAXA_IP_ARRENDAMENTO_EFECTIVA = Decimal('0.15')

# Prédios não arrendados, por valor patrimonial.
IP_ESCALOES_PATRIMONIAL = [
    (Decimal('5000000'), 'percentagem', Decimal('0.001'), Decimal('0')),
    (Decimal('6000000'), 'fixo', Decimal('5000'), Decimal('0')),
    (None, 'excesso', Decimal('0.005'), Decimal('6000000')),
]

TAXA_SELO_QUITACAO = Decimal('0.01')

# O Imposto sobre Veículos Motorizados é tabelado por categoria, cilindrada e
# antiguidade (Lei n.º 14/25). Não é calculável a partir da contabilidade,
# pelo que o sistema o trata como obrigação de calendário e não como cálculo.
IMV_TABELADO = True


# ---------------------------------------------------------------------------
# Referência para a interface
# ---------------------------------------------------------------------------

def referencia():
    """Tabela completa para a página de Definições → Parâmetros Fiscais."""
    return {
        'vigencia': VIGENCIA,
        'regimes_iva': [
            dict(codigo=codigo, **CARACTERISTICAS_REGIME[codigo])
            for codigo, _ in REGIMES_IVA
        ],
        'iva': [
            {'codigo': c, 'taxa': str(t), 'descricao': d, 'base_legal': b}
            for c, t, d, b in TAXAS_IVA
        ],
        'imposto_industrial': [
            {'codigo': c, 'taxa': str(t), 'descricao': d, 'base_legal': b}
            for c, t, d, b in TAXAS_IMPOSTO_INDUSTRIAL
        ],
        'irt': {
            'isencao_mensal': str(IRT_ISENCAO_MENSAL),
            'base_legal': 'Lei n.º 14/25 — Orçamento Geral do Estado para 2026',
            'escaloes': [
                {
                    'ate': str(limite) if limite is not None else None,
                    'parcela_fixa': str(fixa),
                    'taxa': str(taxa),
                    'excesso_sobre': str(excesso),
                }
                for limite, fixa, taxa, excesso in IRT_ESCALOES
            ],
            'grupo_b': str(TAXA_IRT_GRUPO_B),
        },
        'seguranca_social': {
            'patronal': str(TAXA_INSS_PATRONAL),
            'trabalhador': str(TAXA_INSS_TRABALHADOR),
            'base_legal': 'Lei n.º 07/04 e Decreto Presidencial n.º 227/18',
        },
        'retencao_servicos': str(TAXA_RETENCAO_SERVICOS),
        'imposto_predial': {
            'arrendamento_efectiva': str(TAXA_IP_ARRENDAMENTO_EFECTIVA),
            'arrendamento_nominal': str(TAXA_IP_ARRENDAMENTO_NOMINAL),
            'deducao_conservacao': str(IP_DEDUCAO_CONSERVACAO),
        },
        'imposto_selo_quitacao': str(TAXA_SELO_QUITACAO),
        'aviso': (
            'Taxas verificadas em Outubro de 2026. Carecem de confirmação '
            'jurídica antes de serem usadas como fundamento de uma decisão.'
        ),
    }
