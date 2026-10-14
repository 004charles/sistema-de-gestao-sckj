"""Leitura completa do Comprovativo de Entrega da Declaração Modelo 7 de IVA (AGT).

O formulário oficial tem 15 quadros e 56 campos numerados. O extractor anterior
(`pdf_service.extrair_dados_modelo7`) lia 5 campos e tinha três defeitos
confirmados contra o documento real:

1. `fora_prazo` procurava a string "FORA DO PRAZO" no texto — que é a *etiqueta
   da checkbox*, impressa sempre. Toda a declaração era marcada como atrasada.
2. O NIF é impresso em caixas separadas (`5 0 0 2 8 3 0 2 8 0`), pelo que o
   padrão `\\b5\\d{9}\\b` nunca encontrava nada.
3. `Nº Declaração`, `Data Recepção`, `Substituição` e `Repartição Fiscal` são
   legíveis no texto e nunca eram lidos.

Aqui a leitura é genérica: todo o par `<nº campo> <valor Kz>` do quadro 9 é
capturado, o que cobre os 56 campos sem um regex por campo. As checkboxes são
lidas pela presença do `X` imediatamente antes da etiqueta — e devolvem `None`
(desconhecido) quando não é possível decidir, nunca um valor por omissão.
"""
import re
import unicodedata
from decimal import Decimal, InvalidOperation

# Pares "<numero do campo> <valor em Kz>". O número aceita sub-campos (26.1).
# O valor exige sempre a parte decimal, o que evita capturar o próprio número
# do campo seguinte ou os dígitos soltos do NIF.
_PAR_CAMPO_VALOR = re.compile(
    r'(?<![\d,.])(\d{1,2}(?:\.\d)?)\s+(\d{1,3}(?:[.\s]\d{3})*,\d{2})'
)

# Campos do quadro 9 com significado fiscal próprio (§12 do PROMPT MESTRE).
# numero -> (chave, descrição curta para a evidência)
CAMPOS_QUADRO9 = {
    '1': ('base_taxa_normal', 'Base tributável — taxa normal (14%)'),
    '2': ('iva_taxa_normal', 'IVA liquidado — taxa normal (14%)'),
    '1.1': ('base_cabinda', 'Base tributável — Cabinda, taxa reduzida'),
    '2.1': ('iva_cabinda', 'IVA liquidado — Cabinda, taxa reduzida'),
    '1.2': ('base_taxa_5', 'Base tributável — taxa reduzida 5%'),
    '2.2': ('iva_taxa_5', 'IVA liquidado — taxa reduzida 5%'),
    '1.3': ('base_taxa_7', 'Base tributável — taxa reduzida 7%'),
    '2.3': ('iva_taxa_7', 'IVA liquidado — taxa reduzida 7%'),
    '3': ('base_regime_caixa', 'Base — regime de caixa (art. 66.º CIVA)'),
    '4': ('iva_regime_caixa', 'IVA — regime de caixa (art. 66.º CIVA)'),
    '5': ('base_cativo_declarante', 'Base — IVA cativo pelo declarante (art. 21.º)'),
    '6': ('iva_cativo_declarante_favor', 'IVA cativo pelo declarante — a favor do sujeito passivo'),
    '7': ('iva_cativo_declarante_estado', 'IVA cativo pelo declarante — a favor do Estado'),
    '8': ('base_cativo_cliente', 'Base — IVA cativo pelo cliente (art. 31.º)'),
    '9': ('iva_cativo_cliente', 'IVA cativo pelo cliente (art. 31.º)'),
    '8.1': ('base_retencao_tpa', 'Base — imposto retido em TPA'),
    '9.1': ('iva_retencao_tpa', 'IVA retido em TPA'),
    '10': ('isentas_com_direito', 'Isentas com direito à dedução'),
    '11': ('isentas_sem_direito', 'Isentas sem direito à dedução (art. 12.º)'),
    '12': ('nao_tributadas', 'Não tributadas (art. 10.º)'),
    '13': ('base_autoliquidacao', 'Base — serviços de não residentes (art. 29.º)'),
    '14': ('iva_autoliquidacao_favor', 'IVA autoliquidado — a favor do sujeito passivo'),
    '15': ('iva_autoliquidacao_estado', 'IVA autoliquidado — a favor do Estado'),
    '16': ('base_meios_fixos', 'Base — meios fixos e investimentos'),
    '17': ('iva_meios_fixos', 'IVA dedutível — meios fixos e investimentos'),
    '18': ('base_existencias', 'Base — existências/inventários'),
    '19': ('iva_existencias', 'IVA dedutível — existências/inventários'),
    '20': ('base_outros_bens', 'Base — outros bens de consumo'),
    '21': ('iva_outros_bens', 'IVA dedutível — outros bens de consumo'),
    '22': ('base_servicos', 'Base — serviços'),
    '23': ('iva_servicos', 'IVA dedutível — serviços'),
    '24': ('base_importacoes', 'Base — importações de bens'),
    '25': ('iva_importacoes', 'IVA dedutível — importações de bens'),
    '26': ('base_reg_cativo', 'Base — regularizações do imposto cativo'),
    '27': ('iva_reg_cativo', 'IVA — regularizações do imposto cativo'),
    '26.1': ('base_reg_prorata', 'Base — regularizações do pro rata'),
    '27.1': ('iva_reg_prorata', 'IVA — regularizações do pro rata'),
    '28': ('base_reg_sujeito', 'Base — regularizações do sujeito passivo'),
    '29': ('iva_reg_sujeito', 'IVA — regularizações do sujeito passivo'),
    '28.1': ('base_reg_agt', 'Base — regularizações efectuadas pela AGT'),
    '29.1': ('iva_reg_agt', 'IVA — regularizações efectuadas pela AGT'),
    '30': ('percentagem_prorata', 'Percentagem estimada (dedução parcial pro rata)'),
    '31': ('soma_base', 'SOMA das bases tributáveis'),
    '32': ('soma_dedutivel', 'SOMA do imposto a favor do sujeito passivo'),
    '33': ('soma_liquidado', 'SOMA do imposto a favor do Estado'),
    '34': ('credito_periodo', 'Crédito do período (32−33)'),
    '35': ('divida_periodo', 'Dívida do período (33−32)'),
    '36': ('excesso_reportar_anterior', 'Excesso a reportar de períodos anteriores'),
    '36.1': ('pagamentos_periodo', 'Pagamentos do período actual'),
    '36.2': ('indeferimentos', 'Indeferimentos'),
    '37': ('iva_a_pagar', 'IVA a pagar ao Estado'),
    '37.1': ('iva_a_pagar_outros', 'IVA a pagar — outras entidades'),
    '38': ('credito_imposto', 'Crédito do imposto (34+36+36.1)'),
    '39': ('reporte_periodo_seguinte', 'Reporte para o período seguinte'),
    '40': ('pedido_reembolso', 'Pedido de reembolso'),
    '40.1': ('reembolso_anterior', 'Reembolso solicitado anteriormente'),
    '41': ('adiantamentos', 'Adiantamentos de transmissões tributadas'),
    '42': ('amostras_ofertas', 'Amostras e ofertas além do limite legal'),
    '43': ('tributacao_margem', 'Operações sujeitas a tributação da margem'),
    '44': ('operacoes_art5_art6', 'Operações art. 5.º n.º 3 e) f) e art. 6.º n.º 2'),
    '45': ('exportacoes', 'Operações destinadas à exportação'),
    '46': ('cesta_basica', 'Bens da lista anexa (cesta básica)'),
    '47': ('caixa_facturado', 'Regime de caixa — valor facturado'),
    '48': ('caixa_recebido', 'Regime de caixa — valor recebido'),
    '50': ('selo_base_isentas', 'Imposto do Selo — base de recebimentos isentos de IVA'),
    '52': ('selo_devido_isentas', 'Imposto do Selo devido — operações isentas (1%)'),
    '53': ('selo_base_simplificado', 'Imposto do Selo — base do regime simplificado'),
    '55': ('selo_devido_simplificado', 'Imposto do Selo devido — regime simplificado (7%)'),
    '56': ('selo_total_recebimentos', 'Total de recebimentos de operações de IVA'),
}

MESES = {
    'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11,
    'dezembro': 12,
}


def _sem_acentos(texto):
    return ''.join(
        c for c in unicodedata.normalize('NFKD', texto or '')
        if not unicodedata.combining(c)
    )


def _compacto(texto):
    """Texto sem espaços, sem acentos, em maiúsculas — para ler checkboxes."""
    return _sem_acentos(texto).upper().replace(' ', '')


def parse_kz(valor):
    if valor is None:
        return Decimal('0.00')
    limpo = str(valor).strip().replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return Decimal(limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _checkbox(compacto, etiqueta):
    """True/False se a etiqueta está (ou não) assinalada; None se indecidível.

    A AGT imprime `X` imediatamente antes da etiqueta assinalada. Procurar a
    etiqueta sozinha dá sempre positivo, porque ela faz parte do formulário.
    """
    alvo = _compacto(etiqueta)
    if alvo not in compacto:
        return None
    return ('X' + alvo) in compacto


def extrair_campos(texto):
    """Todos os pares `<nº campo> <valor>` encontrados no documento."""
    campos = {}
    for numero, valor in _PAR_CAMPO_VALOR.findall(texto or ''):
        # O primeiro valor encontrado para um campo é o válido: as páginas
        # seguintes do comprovativo repetem o cabeçalho, não os montantes.
        campos.setdefault(numero, parse_kz(valor))
    return campos


def _periodo(texto, compacto):
    """Ano e mês do quadro 05. Vêm em caixas separadas: `2 0 2 6 0 7`.

    O padrão exige o século `2 0` à cabeça: sem isso apanhava os dígitos do
    NIF, que está impresso no mesmo formato umas linhas acima.
    """
    ano = mes = None

    m = re.search(r'(?<![\d ])(2[ ]0[ ]\d[ ]\d)[ ]+(\d[ ]\d)(?![ ]?\d)', texto)
    if m:
        ano = int(m.group(1).replace(' ', ''))
        mes = int(m.group(2).replace(' ', ''))

    if mes is None:
        texto_norm = _sem_acentos(texto).lower()
        for nome, numero in MESES.items():
            if re.search(r'\b' + nome + r'\b', texto_norm):
                mes = numero
                break

    if ano is None:
        m_ano = re.search(r'PERIODODADECLARACAO.{0,40}?(20\d{2})', compacto)
        if m_ano:
            ano = int(m_ano.group(1))

    if ano is not None and not (2000 <= ano <= 2100):
        ano = None
    if mes is not None and not (1 <= mes <= 12):
        mes = None
    return ano, mes


def _nif(texto):
    """NIF do quadro 04. Impresso em caixas: `5 0 0 2 8 3 0 2 8 0`.

    O separador tem de ser espaço literal e não `\\s`: com `\\s` a procura
    atravessava a mudança de linha e colava dígitos de linhas diferentes.
    """
    espacados = [
        m.replace(' ', '')
        for m in re.findall(r'(?<!\d)(?<!\d )(\d(?:[ ]\d){9})(?![ ]?\d)', texto)
    ]
    # NIF de pessoa colectiva angolana começa por 5; se houver, é esse.
    for candidato in espacados:
        if candidato.startswith('5'):
            return candidato
    if espacados:
        return espacados[0]
    m = re.search(r'(?<!\d)(5\d{9})(?!\d)', texto)
    return m.group(1) if m else None


def _data_recepcao(texto):
    m = re.search(r'DATA\s*RECEP[ÇC][ÃA]O\s+(\d{2})-(\d{2})-(\d{4})', texto, re.I)
    if not m:
        return None
    dia, mes, ano = (int(g) for g in m.groups())
    from datetime import date
    try:
        return date(ano, mes, dia)
    except ValueError:
        return None


def parse(texto):
    """Lê o comprovativo completo. Devolve dict com metadados + campos.

    Nenhum valor é inventado: o que não for legível vem `None`, para que a
    camada de regras saiba distinguir "zero declarado" de "não foi possível ler".
    """
    texto = texto or ''
    compacto = _compacto(texto)
    campos = extrair_campos(texto)
    ano, mes = _periodo(texto, compacto)

    m_num = re.search(r'DECLARA[ÇC][ÃA]O\s+(\d{10,20})', texto, re.I)
    m_nome = re.search(r'NOME/DESIGNA[ÇC][ÃA]O:\s*(.+)', texto)

    # "REPARTIÇÃO FISCAL DE DOMICILIO" é o título do quadro 06; a repartição
    # real vem na linha de dados logo abaixo.
    reparticao = next(
        (
            nome for nome in re.findall(
                r'REPARTI[ÇC][ÃA]O\s+FISCAL\s+DE\s+'
                r'([A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]+(?:[ ][A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]+)*)',
                texto,
            )
            if _sem_acentos(nome).upper() != 'DOMICILIO'
        ),
        None,
    )

    dados = {
        'numero_declaracao': m_num.group(1) if m_num else None,
        'data_recepcao': _data_recepcao(texto),
        'nif': _nif(texto),
        'ano': ano,
        'mes': mes,
        'contribuinte': m_nome.group(1).strip() if m_nome else None,
        'reparticao_fiscal': reparticao,
        'regime_geral': _checkbox(compacto, 'REGIME GERAL'),
        'regime_caixa': _checkbox(compacto, 'REGIME DE CAIXA'),
        'no_prazo': _checkbox(compacto, 'NO PRAZO'),
        'fora_prazo': _checkbox(compacto, 'FORA DO PRAZO'),
        'substituicao': _checkbox(compacto, 'SUBSTITUICAO'),
        'campos': campos,
    }
    # As checkboxes do quadro 03 (mapas anexo) não são lidas: o pdfplumber
    # embaralha essa célula do formulário ("A SE N R E V X I O ÇO D S E )"),
    # e um valor adivinhado aqui seria pior do que a sua ausência.

    # Campos com nome, para quem lê a evidência sem o formulário à frente.
    nomeados = {}
    for numero, (chave, _descricao) in CAMPOS_QUADRO9.items():
        if numero in campos:
            nomeados[chave] = campos[numero]
    dados.update(nomeados)

    # Compatibilidade com o contrato antigo de `extrair_dados_modelo7`.
    dados['base_tributavel'] = campos.get('31', Decimal('0.00'))
    dados['iva_dedutivel'] = campos.get('32', Decimal('0.00'))
    dados['iva_liquidado'] = campos.get('33', Decimal('0.00'))
    dados['iva_pagar'] = campos.get('37', Decimal('0.00'))
    dados['iva_recuperar'] = max(
        campos.get('39', Decimal('0.00')), campos.get('40', Decimal('0.00'))
    )
    return dados


def coerencia(dados):
    """Verifica as somas que o próprio formulário declara (31=…, 35=33−32, 37=…).

    Devolve a lista de incoerências encontradas. Uma declaração incoerente é
    sinal de erro de preenchimento, não de má-fé — a linguagem reflecte isso.
    """
    campos = dados.get('campos') or {}
    z = Decimal('0.00')
    problemas = []

    def c(n):
        return campos.get(n, z)

    verificacoes = [
        ('35', c('33') - c('32'), 'Dívida do período deve ser campo 33 − campo 32'),
        ('34', max(c('32') - c('33'), z), 'Crédito do período deve ser campo 32 − campo 33'),
        (
            '37',
            c('35') + c('37.1') - c('36') - c('36.1'),
            'IVA a pagar deve ser campo 35 + 37.1 − 36 − 36.1',
        ),
        ('38', c('34') + c('36') + c('36.1'), 'Crédito do imposto deve ser 34 + 36 + 36.1'),
    ]
    for numero, esperado, explicacao in verificacoes:
        if numero not in campos:
            continue
        esperado = max(esperado, z)
        if abs(campos[numero] - esperado) > Decimal('0.01'):
            problemas.append({
                'campo': numero,
                'declarado': campos[numero],
                'esperado': esperado,
                'explicacao': explicacao,
            })
    return problemas
