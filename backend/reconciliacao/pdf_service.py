import pdfplumber
import logging
import traceback
from groq import Groq
from decouple import config

logger = logging.getLogger('reconciliacao')

MODELS_DISPONIVEIS = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
]

def get_groq_client():
    api_key = config('GROQ_API_KEY', default='')
    if not api_key:
        logger.error("GROQ_API_KEY nao configurada no arquivo .env")
        raise ValueError("GROQ_API_KEY nao configurada no arquivo .env")
    logger.info(f"Cliente Groq criado com chave: {api_key[:10]}...")
    return Groq(api_key=api_key)


def get_model_name():
    model = config('GROQ_MODEL', default='llama-3.1-8b-instant')
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
            'system': "Voce e um contabilista angolano. Responda sempre em portugues de forma clara e objetiva.",
            'prompt': """Voce e um contabilista angolano especializado em IVA.

Compare estes dois documentos e produza um RELATORIO LIMPO e FACIL de ler.

=== DOCUMENTO 1: CONTABILIDADE ===
{texto_contabilidade}

=== DOCUMENTO 2: DECLARACAO AGT ===
{texto_agt}

FORMATO DO RELATORIO (obrigatorio seguir este formato):

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


def analisar_documentos(texto_contabilidade, texto_agt, idioma='pt'):
    client = get_groq_client()
    prompts = get_prompts_by_language(idioma)

    # Limitar tamanho do texto para evitar tokens excessivos
    texto_contabilidade = texto_contabilidade[:4000]
    texto_agt = texto_agt[:4000]

    prompt = prompts['prompt'].format(
        texto_contabilidade=texto_contabilidade,
        texto_agt=texto_agt
    )

    try:
        logger.info(f"Enviando requisicao para Groq (idioma: {idioma})")
        logger.info(f"Tamanho do texto contabilidade: {len(texto_contabilidade)} chars")
        logger.info(f"Tamanho do texto AGT: {len(texto_agt)} chars")
        
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
        error_msg = f"Erro na API Groq: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "error": error_msg,
            "detail": str(e)
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