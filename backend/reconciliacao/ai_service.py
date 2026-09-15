from groq import Groq
from decouple import config
from .models import (
    Empresa, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe
)
from .serializers import (
    EmpresaSerializer, ContabilidadeSerializer,
    DeclaracaoAGTSerializer, ReconciliacaoSerializer,
    ReconciliacaoDetalheSerializer
)

MAX_PROMPT_CHARS = 6000


def truncar_contexto(texto, max_chars=MAX_PROMPT_CHARS):
    if len(texto) <= max_chars:
        return texto
    return texto[:max_chars] + "\n\n[CONTEXTO TRUNCADO - dados incompletos devido ao limite de tokens]"


def get_groq_client():
    api_key = config('GROQ_API_KEY', default='')
    if not api_key:
        raise ValueError("GROQ_API_KEY não configurada no arquivo .env")
    return Groq(api_key=api_key)


def get_model_name():
    return config('GROQ_MODEL', default='llama3-70b-8192')


def montar_contexto_empresa(empresa_id, ano, mes):
    empresa = Empresa.objects.get(pk=empresa_id)

    dados_contab = Contabilidade.objects.filter(
        empresa_id=empresa_id, ano=ano, mes=mes
    )
    dados_agt = DeclaracaoAGT.objects.filter(
        empresa_id=empresa_id, ano=ano, mes=mes
    ).first()

    if not dados_agt:
        return None, "Declaração AGT não encontrada para este período"

    contexto = f"""
=== DADOS DA EMPRESA ===
Nome: {empresa.nome}
NIF: {empresa.nif}
Regime IVA: {empresa.regime_iva}

=== DADOS CONTÁBEIS ({mes}/{ano}) ===
"""
    for item in dados_contab:
        contexto += f"- Conta {item.conta_codigo}: {item.conta_descricao} | Débito: {item.valor_debito} | Crédito: {item.valor_credito} | Saldo: {item.saldo}\n"

    contexto += f"""
=== DECLARAÇÃO AGT ({mes}/{ano}) ===
NIF: {dados_agt.nif}
Razão Social: {dados_agt.razao_social}
Regime IVA: {dados_agt.regime_iva}
IVA Liquidado: {dados_agt.iva_liquidado}
IVA Dedutível: {dados_agt.iva_dedutivel}
IVA Apurado: {dados_agt.iva_apurado}
IVA a Pagar: {dados_agt.iva_pagar}
IVA a Recuperar: {dados_agt.iva_recuperar}
"""
    return contexto, None


def montar_contexto_reconciliacao(reconciliacao_id):
    reconciliacao = Reconciliacao.objects.select_related('empresa').prefetch_related('detalhes').get(pk=reconciliacao_id)

    contexto = f"""
=== RECONCILIAÇÃO IVA ===
Empresa: {reconciliacao.empresa.nome}
NIF: {reconciliacao.empresa.nif}
Período: {reconciliacao.mes}/{reconciliacao.ano}
Status: {reconciliacao.status}
Campos OK: {reconciliacao.total_campos_ok}
Campos com Divergência: {reconciliacao.total_campos_divergencia}

=== DETALHES DA RECONCILIAÇÃO ===
"""
    for detalhe in reconciliacao.detalhes.all():
        contexto += f"""
Campo: {detalhe.campo}
Descrição: {detalhe.descricao}
Valor Contabilidade: {detalhe.valor_contabilidade}
Valor AGT: {detalhe.valor_agt}
Diferença: {detalhe.diferenca}
Status: {detalhe.status}
"""
    return contexto


def analise_reconciliacao(reconciliacao_id):
    client = get_groq_client()
    model = get_model_name()

    contexto = montar_contexto_reconciliacao(reconciliacao_id)

    prompt = f"""Você é um especialista em contabilidade e fiscalidade angolana, com foco em IVA (Imposto sobre o Valor Acrescentado).

Analise a seguinte reconciliação entre dados contábeis e a declaração de IVA apresentada à AGT (Administração Geral Tributária).

{truncar_contexto(contexto)}

Por favor, forneça uma análise completa incluindo:

1. **Resumo da Situação**: Descreva o estado geral da reconciliação
2. **Análise de Divergências**: Identifique e explique cada divergência encontrada
3. **Possíveis Causas**: Para cada divergência, indique possíveis causas (erros de digitação, classificação incorreta de contas, diferenças de arredondamento, etc.)
4. **Recomendações**: Sugira ações corretivas específicas
5. **Riscos Fiscais**: Avalie riscos de multas ou penalidades
6. **Conformidade com Legislação**: Verifique se os valores estão em conformidade com a legislação fiscal angolana

Seja específico e técnico na análise. Use linguagem acessível mas profissional."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em contabilidade e fiscalidade angolana."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        return {
            "success": True,
            "analise": response.choices[0].message.content,
            "model": model,
            "reconciliacao_id": reconciliacao_id
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def analise_empresa_periodo(empresa_id, ano, mes):
    client = get_groq_client()
    model = get_model_name()

    contexto, erro = montar_contexto_empresa(empresa_id, ano, mes)
    if erro:
        return {"success": False, "error": erro}

    prompt = f"""Você é um especialista em contabilidade e fiscalidade angolana, com foco em IVA.

Analise os seguintes dados contábeis e a declaração de IVA apresentada à AGT.

{truncar_contexto(contexto)}

Por favor, forneça:

1. **Análise Comparativa**: Compare os dados contábeis com a declaração AGT
2. **Identificação de Divergências**: Aponte diferenças entre o que está na contabilidade e o que foi declarado
3. **Explicação Técnica**: Explique cada divergência em termos contábeis
4. **Classificação de Contas**: Verifique se as contas 24.4.1 a 24.4.5 estão corretamente mapeadas
5. **Recomendações**: Sugira correções necessárias
6. **Alertas**: Indique possíveis problemas fiscais ou riscos de auditoria

Seja detalhado e preciso na análise."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente especializado em contabilidade e fiscalidade angolana."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        return {
            "success": True,
            "analise": response.choices[0].message.content,
            "model": model,
            "empresa_id": empresa_id,
            "periodo": f"{mes}/{ano}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def chat_interativo(mensagem, contexto=None):
    client = get_groq_client()
    model = get_model_name()

    system_prompt = """Você é um assistente especializado em contabilidade e fiscalidade angolana, 
especialmente em IVA (Imposto sobre o Valor Acrescentado). 

Você ajuda contabilistas e gestores financeiros com:
- Análise de dados contábeis e fiscais
- Reconciliação entre dados internos e declarações à AGT
- Explicação de conceitos de contabilidade angolana
- Identificação de erros e divergências
- Recomendações para conformidade fiscal
- Legislação tributária angolana

Responda sempre em português de Angola, sendo preciso e técnico quando necessário."""

    messages = [{"role": "system", "content": system_prompt}]

    if contexto:
        messages.append({"role": "user", "content": f"Contexto disponível:\n{truncar_contexto(contexto)}"})
        messages.append({"role": "assistant", "content": "Entendi o contexto. Como posso ajudar?"})

    messages.append({"role": "user", "content": mensagem})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.5,
            max_tokens=1500,
        )
        return {
            "success": True,
            "resposta": response.choices[0].message.content,
            "model": model
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
