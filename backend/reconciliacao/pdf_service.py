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
        logger.error("GROQ_API_KEY não configurada no arquivo .env")
        raise ValueError("GROQ_API_KEY não configurada no arquivo .env")
    logger.info(f"Cliente Groq criado com chave: {api_key[:10]}...")
    return Groq(api_key=api_key)


def get_model_name():
    model = config('GROQ_MODEL', default='llama-3.1-8b-instant')
    logger.info(f"Modelo Groq configurado: {model}")
    return model


def tentar_modelos(client, messages, temperature=0.2, max_tokens=4000):
    """Tenta múltiplos modelos até encontrar um que funcione"""
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
                logger.warning(f"Modelo {model} não encontrado, tentando próximo...")
                continue
            else:
                # Outro tipo de erro, lançar exceção
                raise e
    
    raise Exception("Nenhum modelo disponível foi encontrado")


def extrair_texto_pdf(caminho_arquivo):
    try:
        texto = ""
        with pdfplumber.open(caminho_arquivo) as pdf:
            for pagina in pdf.pages:
                texto += pagina.extract_text() or ""
        return texto
    except Exception as e:
        return f"Erro ao extrair texto: {str(e)}"


def analisar_documentos(texto_contabilidade, texto_agt):
    client = get_groq_client()

    prompt = f"""Você é um contabilista angolano especializado em IVA.

Compare estes dois documentos e produza um RELATÓRIO LIMPO e FÁCIL de ler.

=== DOCUMENTO 1: CONTABILIDADE ===
{texto_contabilidade[:4000]}

=== DOCUMENTO 2: DECLARAÇÃO AGT ===
{texto_agt[:4000]}

FORMATO DO RELATÓRIO (obrigatório seguir este formato):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMO GERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total de campos analisados: X
• Campos conformes: X
• Divergências encontradas: X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALHE POR CAMPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para CADA campo, use este formato:

[NOME DO CAMPO]
  Contabilidade: [valor] Kz
  AGT:           [valor] Kz
  Status:        ✅ Conforme  OU  ⚠️ Divergência
  Diferença:     [valor] Kz (se houver)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE TÉCNICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada divergência, explique em 1 frase:
• Possível causa do erro
• Risco fiscal (Baixo/Médio/Alto)
• Ação recomendada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMENDAÇÕES FINAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Liste 3 ações prioritárias para corrigir os problemas encontrados.

IMPORTANTE:
- Use valores em Kz (Kwanza)
- Seja direto e claro
- Não invente dados que não estejam nos documentos
- Se não encontrar algum dado, diga "Não encontrado no documento"
"""

    try:
        logger.info(f"Enviando requisição para Groq")
        logger.info(f"Tamanho do texto contabilidade: {len(texto_contabilidade)} chars")
        logger.info(f"Tamanho do texto AGT: {len(texto_agt)} chars")
        
        messages = [
            {"role": "system", "content": "Você é um contabilista angolano. Responda sempre em português de forma clara e objetiva."},
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


def analisar_documento_unico(texto, tipo_documento):
    client = get_groq_client()
    model = get_model_name()

    if tipo_documento == 'CONTABILIDADE':
        prompt = f"""Você é um especialista em contabilidade angolana.

Analise os seguintes dados contabilísticos extraídos de um documento PDF:

{texto[:4000]}

Identifique e extraia as seguintes informações organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutível
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores de retenções na fonte
   - Imposto de profissões e serviços

3. **IP - Imposto Predial**
   - Valores relativos a IP

4. **Segurança Social**
   - Contribuições da entidade patronal
   - Contribuições do trabalhador

5. **Retenção de Fornecedores**
   - Valores retidos na fonte

Apresente os valores encontrados de forma clara e organizada. Se não encontrar algum valor, indique "Não encontrado"."""
    else:
        prompt = f"""Você é um especialista em fiscalidade angolana, especialmente no portal da AGT.

Analise os seguintes dados extraídos do portal da AGT (Administração Geral Tributária):

{texto[:4000]}

Identifique e extraia as seguintes informações organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutível
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores declarados de retenções na fonte
   - Imposto de profissões e serviços

3. **IP - Imposto Predial**
   - Valores declarados de IP

4. **Segurança Social**
   - Contribuições declaradas

5. **Retenção de Fornecedores**
   - Valores retidos declarados

Apresente os valores encontrados de forma clara e organizada. Se não encontrar algum valor, indique "Não encontrado"."""

    try:
        logger.info(f"Enviando requisição para Groq (documento único) - Tipo: {tipo_documento}")
        logger.info(f"Tamanho do texto: {len(texto)} chars")
        
        messages = [
            {"role": "system", "content": "Você é um assistente especializado em contabilidade e fiscalidade angolana."},
            {"role": "user", "content": prompt}
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
