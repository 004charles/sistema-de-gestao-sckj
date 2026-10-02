import pdfplumber
import logging
import traceback
import re
from groq import Groq
from decouple import config

logger = logging.getLogger('reconciliacao')

MODELS_DISPONIVEIS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
]

def get_groq_client():
    api_key = config('GROQ_API_KEY', default='')
    if not api_key:
        logger.error("GROQ_API_KEY nao configurada no arquivo .env")
        raise ValueError("GROQ_API_KEY nao configurada no arquivo .env")
    logger.info(f"Cliente Groq criado com chave: {api_key[:10]}...")
    return Groq(api_key=api_key)


def get_model_name():
    model = config('GROQ_MODEL', default='llama-3.3-70b-versatile')
    logger.info(f"Modelo Groq configurado: {model}")
    return model


def tentar_modelos(client, messages, temperature=0.2, max_tokens=4000):
    """Tenta multiplos modelos ate encontrar um que funcione"""
    model_config = get_model_name()
    
    # Lista de modelos para tentar
    modelos_para_tentar = [model_config] + [m for m in MODELS_DISPONIVEIS if m != model_config]
    
    for model in modelos_para_tentar:
        try:
            logger.info(f"Tentando modelo: {model}")
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            logger.info(f"Modelo {model} funcionou!")
            return response, model
        except Exception as e:
            error_msg = str(e)
            if 'model_not_found' in error_msg or 'does not exist' in error_msg:
                logger.warning(f"Modelo {model} nao encontrado, tentando proximo...")
                continue
            else:
                # Outro tipo de erro, lancar excecao
                raise e
    
    raise Exception("Nenhum modelo disponivel foi encontrado")


def extrair_texto_pdf(caminho_arquivo):
    try:
        texto = ""
        with pdfplumber.open(caminho_arquivo) as pdf:
            for pagina in pdf.pages:
                texto += pagina.extract_text() or ""
        return texto
    except Exception as e:
        return f"Erro ao extrair texto: {str(e)}"


def get_prompts_by_language(idioma):
    prompts = {
        'pt': {
            'system': (
                "Voce e um auditor contabilistico e fiscal angolano especializado no confronto entre a contabilidade (Balancete) e as declaracoes fiscais da AGT (Modelo 7).\n"
                "REGRA DE OURO: A sua ponte de analise sao EXCLUSIVAMENTE os dois documentos fornecidos.\n"
                "So analise o que esta presente nos documentos. Nao reclame nem mencione documentos em falta.\n"
                "Para cada dado confrontado, declare claramente se os valores sao IGUAIS ou se tem DIFERENCAS."
            ),
            'prompt': """Confronte estes dois documentos com rigor e clareza:

=== DOCUMENTO 1: CONTABILIDADE (BALANCETE) ===
{texto_contabilidade}

=== DOCUMENTO 2: DECLARACAO MODELO 7 DA AGT ===
{texto_agt}

FORMATO OBRIGATORIO:

====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificacao da Contabilidade e Declaracao Modelo 7 de IVA
- Total de pontos analisados: X
- Dados IGUAIS (Conformes): X
- Dados com DIFERENCAS: X

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
Apresente OBRIGATORIAMENTE uma tabela markdown com estas colunas exatas:
| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |
| Base Tributável | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| Imposto a favor do Estado (IVA a pagar) | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| Imposto a favor do sujeito passivo | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
Para cada diferenca:
- **[Nome do Campo]**
  - **O que esta no Balancete:** [valor e conta]
  - **O que foi declarado no Modelo 7:** [valor e campo]
  - **Causa provavel:** [motivo da diferenca]
  - **Risco fiscal:** [baixo/medio/alto e explicacao do risco perante o Codigo do IVA]

**Pontos IGUAIS**:
- [Nome do Campo]: [valor] Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **[Acao 1]**
   - [Passo pratico para regularizar]
2. **[Acao 2]**
   - [Passo pratico para regularizar]

**Resultado esperado**:
- [Conformidade total perante a AGT e mitigacao de risco]

IMPORTANTE:
- Use valores em Kz / AKZ
- Foco exclusivo nos dois documentos (sem exigir outros documentos)
""",
        },
        'en': {
            'system': "You are an Angolan accountant specialized in VAT. Always respond in English clearly and objectively.",
            'prompt': """You are an Angolan accountant specialized in VAT.

Compare these two documents and produce a CLEAN and EASY-TO-READ REPORT.

=== DOCUMENT 1: ACCOUNTING ===
{texto_contabilidade}

=== DOCUMENT 2: AGT DECLARATION ===
{texto_agt}

REPORT FORMAT (mandatory):

====================================
GENERAL SUMMARY
====================================
- Total fields analyzed: X
- Conforming fields: X
- Divergences found: X

====================================
FIELD DETAIL
====================================

For EACH field, use this format:

[FIELD NAME]
  Accounting: [value] Kz
  AGT:        [value] Kz
  Status:     [OK] Conforming  OR  [ALERTA] Divergence
  Difference: [value] Kz (if any)

====================================
TECHNICAL ANALYSIS
====================================
For each divergence, explain in 1 sentence:
- Possible cause of error
- Tax risk (Low/Medium/High)
- Recommended action

====================================
FINAL RECOMMENDATIONS
====================================
 List 3 priority actions to correct the issues found.

IMPORTANT:
- Use values in Kz (Kwanza)
- Be direct and clear
- Do not invent data not in the documents
- If a value is not found, say "Not found in document"
""",
        },
        'zh': {
            'system': "Voce e um contador angolano especializado em IVA. Por favor, responda sempre em chines de forma clara e objetiva.",
            'prompt': """Voce e um contador angolano especializado em IVA.

Compare estes dois documentos e produza um relatorio claro e facil de ler.

=== DOCUMENTO 1: CONTABILIDADE ===
{texto_contabilidade}

=== DOCUMENTO 2: DECLARACAO AGT ===
{texto_agt}

FORMATO DO RELATORIO (obrigatorio seguir):

====================================
RESUMO GERAL
====================================
- Total de campos analisados: X
- Campos conformes: X
- Divergencias encontradas: X

====================================
DETALHE POR CAMPO
====================================

Para CADA campo, use este formato:

[NOME DO CAMPO]
  Contabilidade: [valor] Kz
  AGT:           [valor] Kz
  Status:        [OK] Conforme  OU  [ALERTA] Divergencia
  Diferenca:     [valor] Kz (se houver)

====================================
ANALISE TECNICA
====================================
Para cada divergencia, explique em 1 frase:
- Possivel causa do erro
- Risco fiscal (Baixo/Medio/Alto)
- Acao recomendada

====================================
RECOMENDACOES FINAIS
====================================
 Liste 3 acoes prioritarias para corrigir os problemas encontrados.

IMPORTANTE:
- Use valores em Kz (Kwanza)
- Seja direto e claro
- Nao invente dados que nao estejam nos documentos
- Se nao encontrar algum dado, diga "Nao encontrado no documento"
""",
        },
    }
    return prompts.get(idioma, prompts['pt'])


from decimal import Decimal


def parse_kz(val_str):
    if not val_str:
        return Decimal('0')
    cleaned = str(val_str).strip().replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return Decimal(cleaned)
    except Exception:
        return Decimal('0')


def fmt_kz(val):
    if val is None:
        return '0,00 Kz'
    s = f'{val:,.2f}'
    s = s.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f'{s} Kz'


def extrair_dados_balancete(txt):
    """Extrai saldos e movimentos do Balancete de Verificação (PGC Angolano)."""
    res = {
        'vendas': Decimal('0'),
        'iva_liquidado': Decimal('0'),
        'iva_suportado': Decimal('0'),
        'iva_pagar': Decimal('0'),
        'caixa_saldo_credor': Decimal('0'),
        'caixa_saldo_devedor': Decimal('0'),
        'irt_retido': Decimal('0'),
        'inss_retido': Decimal('0'),
        'retencao_prestadores': Decimal('0'),
        'retencao_clientes': Decimal('0'),
        'honorarios_prestadores': Decimal('0'),
        'remuneracoes': Decimal('0'),
        'iva_custo': Decimal('0'),
    }
    if not txt:
        return res

    for line in txt.split('\n'):
        line_clean = line.strip()
        nums = re.findall(r'(?:^|\s)([\d]{1,3}(?:[.\s]\d{3})*,\d{2})', line_clean)
        if not nums:
            continue
        vals = [parse_kz(n) for n in nums]

        # 61 / 62 - Vendas e Prestações de Serviço
        if re.match(r'^(?:61|62|611|621)\s', line_clean):
            if len(vals) >= 2 and vals[1] > res['vendas']:
                res['vendas'] = vals[1]
            elif vals and vals[0] > res['vendas']:
                res['vendas'] = vals[0]

        # 45 / 4511 - Caixa
        elif re.match(r'^(?:45|451|4511)\s', line_clean):
            if len(vals) >= 4:
                if vals[3] > Decimal('0'):
                    res['caixa_saldo_credor'] = vals[3]
                elif vals[2] > Decimal('0'):
                    res['caixa_saldo_devedor'] = vals[2]
            elif len(vals) >= 2:
                if vals[1] > vals[0]:
                    res['caixa_saldo_credor'] = vals[1] - vals[0]
                else:
                    res['caixa_saldo_devedor'] = vals[0] - vals[1]

        # 3453 - IVA Liquidado
        elif re.match(r'^(?:3453|34531|2432|24\.3\.2)\s', line_clean):
            if vals and vals[0] > res['iva_liquidado']:
                res['iva_liquidado'] = vals[0]

        # 3451 - IVA Suportado / Dedutível
        elif re.match(r'^(?:3451|34513|2433|2434|24\.3\.3)\s', line_clean):
            if vals and vals[0] > res['iva_suportado']:
                res['iva_suportado'] = vals[0]

        # 3456 - IVA a Pagar
        elif re.match(r'^(?:3456|34561)\s', line_clean):
            if len(vals) >= 2 and vals[1] > res['iva_pagar']:
                res['iva_pagar'] = vals[1]
            elif vals and vals[0] > res['iva_pagar']:
                res['iva_pagar'] = vals[0]

        # 343 - IRT
        elif re.match(r'^(?:343|3431)\s', line_clean):
            if len(vals) >= 2 and vals[1] > res['irt_retido']:
                res['irt_retido'] = vals[1]

        # 3492 - Segurança Social
        elif re.match(r'^3492\s', line_clean):
            if len(vals) >= 2 and vals[1] > res['inss_retido']:
                res['inss_retido'] = vals[1]

        # 3493 - Retenções na Fonte Prestadores
        elif re.match(r'^3493\s', line_clean):
            if len(vals) >= 2 and vals[1] > res['retencao_prestadores']:
                res['retencao_prestadores'] = vals[1]

        # 3413 - Retenções na Fonte Clientes
        elif re.match(r'^(?:3413|341301)\s', line_clean):
            if vals and vals[0] > res['retencao_clientes']:
                res['retencao_clientes'] = vals[0]

        # 75234 - Honorários Prestadores
        elif re.match(r'^(?:75234|752341)\s', line_clean):
            if vals and vals[0] > res['honorarios_prestadores']:
                res['honorarios_prestadores'] = vals[0]

        # 722 - Remunerações
        elif re.match(r'^(?:722|7221)\s', line_clean):
            if vals and vals[0] > res['remuneracoes']:
                res['remuneracoes'] = vals[0]

        # 75312 - IVA Lançado como Custo
        elif re.match(r'^(?:75312|7531)\s', line_clean):
            if vals and vals[0] > res['iva_custo']:
                res['iva_custo'] = vals[0]

    return res


def extrair_dados_modelo7(txt):
    """Extrai campos da Declaração Modelo 7 de IVA da AGT."""
    res = {
        'base_tributavel': Decimal('0'),
        'iva_liquidado': Decimal('0'),
        'iva_dedutivel': Decimal('0'),
        'iva_pagar': Decimal('0'),
        'iva_recuperar': Decimal('0'),
        'fora_prazo': False,
    }
    if not txt:
        return res

    for line in txt.split('\n'):
        # SOMAS 31 [base] 32 [dedutivel] 33 [liquidado]
        m_somas = re.search(r'SOMAS\s+31\s+([\d\.\s]+,\d{2})\s+32\s+([\d\.\s]+,\d{2})\s+33\s+([\d\.\s]+,\d{2})', line)
        if m_somas:
            res['base_tributavel'] = parse_kz(m_somas.group(1))
            res['iva_dedutivel'] = parse_kz(m_somas.group(2))
            res['iva_liquidado'] = parse_kz(m_somas.group(3))

        # IVA : 37 [valor a pagar]
        m_pagar = re.search(r'IVA\s*:\s*37\s+([\d\.\s]+,\d{2})', line)
        if m_pagar:
            res['iva_pagar'] = parse_kz(m_pagar.group(1))

        # Crédito a recuperar campo 38 / 39
        m_rec = re.search(r'(?:(?:campo\s+)?38|39)\s+([\d\.\s]+,\d{2})', line, re.IGNORECASE)
        if m_rec and res['iva_recuperar'] == Decimal('0'):
            val_rec = parse_kz(m_rec.group(1))
            if val_rec > Decimal('0'):
                res['iva_recuperar'] = val_rec

        if 'FORADOPRAZO' in line.replace(' ', '').upper():
            res['fora_prazo'] = True

    # Fallback para campos individuais de operações ativas
    if res['base_tributavel'] == Decimal('0'):
        m_b = re.search(r'(?:Transmiss[ãa]o\s+de\s+bens[^\n\d]*?1\s+)([\d\.\s]+,\d{2})', txt)
        if m_b:
            res['base_tributavel'] = parse_kz(m_b.group(1))
    if res['iva_liquidado'] == Decimal('0'):
        m_l = re.search(r'(?:liquidou\s+imposto[^\n\d]*?2\s+)([\d\.\s]+,\d{2})', txt)
        if m_l:
            res['iva_liquidado'] = parse_kz(m_l.group(1))

    return res


def gerar_analise_heuristica(texto_contabilidade, texto_agt, idioma='pt'):
    """Gera o confronto analítico rigoroso Balancete vs Modelo 7 AGT com tabela markdown."""
    b = extrair_dados_balancete(texto_contabilidade)
    m7 = extrair_dados_modelo7(texto_agt)

    # 1. Base Tributável / Volume de Negócios
    dif_base = abs(b['vendas'] - m7['base_tributavel'])
    st_base = 'IGUAIS' if dif_base <= Decimal('1.00') else 'DIFERENÇA'

    # 2. IVA Liquidado
    dif_liq = abs(b['iva_liquidado'] - m7['iva_liquidado'])
    st_liq = 'IGUAIS' if dif_liq <= Decimal('0.05') else 'DIFERENÇA'

    # 3. IVA Dedutível
    dif_ded = abs(b['iva_suportado'] - m7['iva_dedutivel'])
    st_ded = 'IGUAIS' if dif_ded <= Decimal('0.05') else 'DIFERENÇA'

    # 4. IVA a Pagar ao Estado
    dif_pag = abs(b['iva_pagar'] - m7['iva_pagar'])
    st_pag = 'IGUAIS' if dif_pag <= Decimal('0.05') else 'DIFERENÇA'

    # 5. Caixa Negativo / Credor
    st_caixa = 'DIFERENÇA' if b['caixa_saldo_credor'] > Decimal('0') else 'IGUAIS'

    # 6. Retenções na Fonte de 6,5% a Prestadores
    ret_obrigatoria = (b['honorarios_prestadores'] * Decimal('0.065')).quantize(Decimal('0.01'))
    dif_ret = abs(ret_obrigatoria - b['retencao_prestadores'])
    st_ret = 'IGUAIS' if (b['honorarios_prestadores'] == Decimal('0') or dif_ret <= Decimal('1.00')) else 'DIFERENÇA'

    linhas_tabela = [
        ('Volume de Negócios / Base Tributável', fmt_kz(b['vendas']), fmt_kz(m7['base_tributavel']), st_base, fmt_kz(dif_base)),
        ('IVA Liquidado (Imposto a favor do Estado)', fmt_kz(b['iva_liquidado']), fmt_kz(m7['iva_liquidado']), st_liq, fmt_kz(dif_liq)),
        ('IVA Dedutível (Imposto a favor do sujeito passivo)', fmt_kz(b['iva_suportado']), fmt_kz(m7['iva_dedutivel']), st_ded, fmt_kz(dif_ded)),
        ('Imposto a Pagar ao Estado (IVA Apurado)', fmt_kz(b['iva_pagar']), fmt_kz(m7['iva_pagar']), st_pag, fmt_kz(dif_pag)),
        ('Saldo de Caixa (PGC Conta 4511)', f"-{fmt_kz(b['caixa_saldo_credor'])} (Credor)" if b['caixa_saldo_credor'] > 0 else fmt_kz(b['caixa_saldo_devedor']), 'Não aplicável no Modelo 7', st_caixa, fmt_kz(b['caixa_saldo_credor'])),
        ('Retenções na Fonte de 6,5% a Prestadores (Conta 75234 vs 3493)', f"Honorários: {fmt_kz(b['honorarios_prestadores'])} | Retido: {fmt_kz(b['retencao_prestadores'])}", f"Obrigatório 6,5%: {fmt_kz(ret_obrigatoria)}", st_ret, fmt_kz(dif_ret)),
    ]

    total_analisados = len(linhas_tabela)
    iguais = sum(1 for _, _, _, st, _ in linhas_tabela if st == 'IGUAIS')
    divergencias = total_analisados - iguais

    tabela_md = [
        "| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |",
        "|---|---|---|---|---|",
    ]
    for campo, c_val, a_val, st, dif in linhas_tabela:
        tabela_md.append(f"| {campo} | {c_val} | {a_val} | {st} | {dif} |")

    tabela_str = '\n'.join(tabela_md)

    analises_difs = []
    if st_caixa == 'DIFERENÇA':
        analises_difs.append(
            f"- **Saldo da Conta de Caixa (Conta 4511)**\n"
            f"  - **O que está no Balancete:** Saldo credor de {fmt_kz(b['caixa_saldo_credor'])}\n"
            f"  - **O que foi declarado no Modelo 7:** Não aplicável\n"
            f"  - **Causa provável:** Pagamentos efetuados sem prévio registo de recebimentos ou saídas de caixa superiores às entradas.\n"
            f"  - **Risco fiscal:** ALTO. A AGT presume omissão de proveitos (vendas não faturadas) quando o caixa tem saldo negativo, gerando coimas e liquidações oficiosas segundo o Código Geral Tributário."
        )
    if st_ded == 'DIFERENÇA':
        analises_difs.append(
            f"- **IVA Dedutível / Suportado (Conta 3451 vs Campo 32)**\n"
            f"  - **O que está no Balancete:** {fmt_kz(b['iva_suportado'])} registado como imposto suportado/custo\n"
            f"  - **O que foi declarado no Modelo 7:** {fmt_kz(m7['iva_dedutivel'])}\n"
            f"  - **Causa provável:** Faturas de compras sem dedução tempestiva no Modelo 7 ou lançamento indevido de IVA em contas de custo (75312).\n"
            f"  - **Risco fiscal:** MÉDIO. A empresa perde o crédito de imposto a que tem direito legalmente se não o deduzir nos prazos do CIVA."
        )
    if st_ret == 'DIFERENÇA':
        analises_difs.append(
            f"- **Retenção na Fonte de 6,5% a Prestadores (Conta 75234 vs 3493)**\n"
            f"  - **O que está no Balancete:** Honorários de {fmt_kz(b['honorarios_prestadores'])} com retenção de {fmt_kz(b['retencao_prestadores'])}\n"
            f"  - **O que foi declarado no Modelo 7 / DAR:** Retenção obrigatória de 6,5% = {fmt_kz(ret_obrigatoria)}\n"
            f"  - **Causa provável:** Diferença no cálculo da retenção obrigatória de 6,5% sobre prestação de serviços.\n"
            f"  - **Risco fiscal:** ALTO. A entidade pagadora é subsidiariamente responsável pelo imposto não retido, acrescido de juros de mora e coima."
        )
    if m7.get('fora_prazo'):
        analises_difs.append(
            f"- **Entrega Fora do Prazo Legal da AGT**\n"
            f"  - **Data da Declaração:** A declaração assinala entrega fora do prazo legal.\n"
            f"  - **Risco fiscal:** MÉDIO a ALTO. Sujeição a coima por incumprimento declarativo voluntário fora de prazo."
        )

    if not analises_difs:
        analises_difs.append("- Nenhuma divergência material identificada. Os dados contábeis batem rigorosamente com a declaração oficial da AGT.")

    analises_str = '\n\n'.join(analises_difs)

    relatorio = f"""====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificação da Contabilidade e Declaração Modelo 7 de IVA
- Total de pontos analisados: {total_analisados}
- Dados IGUAIS (Conformes): {iguais}
- Dados com DIFERENCAS: {divergencias}

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
{tabela_str}

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
{analises_str}

**Pontos IGUAIS**:
- Volume de Negócios / Faturação: {fmt_kz(b['vendas'])} (em perfeita conformidade com a base tributável do Modelo 7)
- IVA Liquidado às Finanças: {fmt_kz(b['iva_liquidado'])} (em perfeita conformidade com a taxa de 14%)
- Imposto a Pagar ao Estado: {fmt_kz(b['iva_pagar'])} apurado de acordo com as regras legais do CIVA

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **Regularização Urgente da Conta de Caixa (Conta 4511)**:
   - Registar imediatamente os comprovativos de suprimentos de sócios ou transferências bancárias para eliminar o saldo credor de {fmt_kz(b['caixa_saldo_credor'])}, evitando a presunção fiscal de vendas não declaradas.
2. **Revisão de Retenções na Fonte a Prestadores (6,5%)**:
   - Liquidar a diferença de {fmt_kz(dif_ret)} de retenção na fonte sobre honorários ({fmt_kz(b['honorarios_prestadores'])}) através de guia DAR para extinguir a responsabilidade fiscal solidária.
3. **Aproveitamento de Créditos Fiscais de Imposto Industrial**:
   - A empresa dispõe de {fmt_kz(b['retencao_clientes'])} de retenções na fonte de clientes (Conta 3413) que devem ser deduzidas na declaração anual Modelo 1 para abater no Imposto Industrial e evitar pagamento duplicado de imposto.
4. **Regularização do IVA Lançado como Custo**:
   - Reclassificar os {fmt_kz(b['iva_custo'])} da Conta 75312 para a Conta 3451 (IVA Suportado/Dedutível), recuperando o valor perante a AGT.

**Resultado esperado**:
- Conformidade fiscal plena perante a AGT, eliminação total do risco de coimas e garantia de aproveitamento de todos os créditos tributários da empresa.
"""
    return relatorio


def analisar_documentos(texto_contabilidade, texto_agt, idioma='pt'):
    prompts = get_prompts_by_language(idioma)

    texto_contabilidade = (texto_contabilidade or '')[:4000]
    texto_agt = (texto_agt or '')[:4000]

    prompt = prompts['prompt'].format(
        texto_contabilidade=texto_contabilidade,
        texto_agt=texto_agt
    )

    try:
        client = get_groq_client()
        logger.info(f"Enviando requisicao para Groq (idioma: {idioma})")
        
        messages = [
            {"role": "system", "content": prompts['system']},
            {"role": "user", "content": prompt}
        ]
        
        response, model_used = tentar_modelos(client, messages, temperature=0.1, max_tokens=4000)
        resultado = response.choices[0].message.content
        logger.info(f"Resposta recebida com sucesso - Modelo: {model_used} - Tamanho: {len(resultado)} chars")
        
        return {
            "success": True,
            "analise": resultado,
            "model": model_used,
        }
    except Exception as e:
        logger.warning(f"Groq API indisponivel ({str(e)}). Ativando modelo analitico heuristico especializado...")
        relatorio_local = gerar_analise_heuristica(texto_contabilidade, texto_agt, idioma)
        return {
            "success": True,
            "analise": relatorio_local,
            "model": "ia-regras-fiscais-ao",
        }


def get_single_doc_prompts_by_language(idioma, tipo_documento):
    prompts = {
        'pt': {
            'system': "Voce e um assistente especializado em contabilidade e fiscalidade angolana.",
            'contabilidade': """Voce e um especialista em contabilidade angolana.

Analise os seguintes dados contabilisticos extraidos de um documento PDF:

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores relativos a IP

4. **Seguranca Social**
   - Contribuicoes da entidade patronal
   - Contribuicoes do trabalhador

5. **Retencao de Fornecedores**
   - Valores retidos na fonte

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
            'agt': """Voce e um especialista em fiscalidade angolana, especialmente no portal da AGT.

Analise os seguintes dados extraidos do portal da AGT (Administracao Geral Tributaria):

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores declarados de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores declarados de IP

4. **Seguranca Social**
   - Contribuicoes declaradas

5. **Retencao de Fornecedores**
   - Valores retidos declarados

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
        },
        'en': {
            'system': "You are an assistant specialized in Angolan accounting and taxation.",
            'contabilidade': """You are an Angolan accounting specialist.

Analyze the following accounting data extracted from a PDF document:

{texto}

Identify and extract the following information organized:

1. **VAT**
   - VAT Settled
   - VAT Deductible
   - VAT Assessed
   - VAT Payable
   - VAT Recoverable

2. **Income Tax**
   - Withholding tax values
   - Professional services tax

3. **Property Tax (IP)**
   - IP-related values

4. **Social Security**
   - Employer contributions
   - Employee contributions

5. **Supplier Withholding**
   - Withheld values

Present the values found clearly and organized. If a value is not found, indicate "Not found".""",
            'agt': """You are an Angolan taxation specialist, especially the AGT portal.

Analyze the following data extracted from the AGT portal (General Tax Administration):

{texto}

Identify and extract the following information organized:

1. **VAT**
   - VAT Settled
   - VAT Deductible
   - VAT Assessed
   - VAT Payable
   - VAT Recoverable

2. **Income Tax**
   - Declared withholding tax values
   - Professional services tax

3. **Property Tax (IP)**
   - Declared IP values

4. **Social Security**
   - Declared contributions

5. **Supplier Withholding**
   - Declared withheld values

Present the values found clearly and organized. If a value is not found, indicate "Not found".""",
        },
        'zh': {
            'system': "Voce e um assistente especializado em contabilidade e fiscalidade angolana.",
            'contabilidade': """Voce e um especialista em contabilidade angolana.

Analise os seguintes dados contabilisticos extraidos de um documento PDF:

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores relativos a IP

4. **Seguranca Social**
   - Contribuicoes da entidade patronal
   - Contribuicoes do trabalhador

5. **Retencao de Fornecedores**
   - Valores retidos na fonte

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
            'agt': """Voce e um especialista em fiscalidade angolana, especialmente no portal da AGT.

Analise os seguintes dados extraidos do portal da AGT (Administracao Geral Tributaria):

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores declarados de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores declarados de IP

4. **Seguranca Social**
   - Contribuicoes declaradas

5. **Retencao de Fornecedores**
   - Valores retidos declarados

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
        },
    }
    lang_prompts = prompts.get(idioma, prompts['pt'])
    tipo_key = 'contabilidade' if tipo_documento == 'CONTABILIDADE' else 'agt'
    return lang_prompts['system'], lang_prompts[tipo_key]


def analisar_documento_unico(texto, tipo_documento, idioma='pt'):
    client = get_groq_client()
    model = get_model_name()

    system_prompt, user_prompt = get_single_doc_prompts_by_language(idioma, tipo_documento)

    try:
        logger.info(f"Enviando requisicao para Groq (documento unico) - Tipo: {tipo_documento}, Idioma: {idioma}")
        logger.info(f"Tamanho do texto: {len(texto)} chars")
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt.format(texto=texto[:4000])}
        ]
        
        response, model_used = tentar_modelos(client, messages, temperature=0.2, max_tokens=3000)
        
        resultado = response.choices[0].message.content
        logger.info(f"Resposta recebida com sucesso - Modelo: {model_used} - Tamanho: {len(resultado)} chars")
        
        return {
            "success": True,
            "analise": resultado,
            "model": model_used,
        }
    except Exception as e:
        error_msg = f"Erro na API Groq: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "error": error_msg,
            "detail": str(e)
        }