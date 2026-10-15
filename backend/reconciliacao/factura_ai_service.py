"""Serviço de Inteligência Artificial para Leitura, Extração e Auditoria de Facturas.
Conforme as normas fiscais da República de Angola:
- Código do Imposto sobre o Valor Acrescentado (CIVA - Lei n.º 7/19 e alterações)
- Regime Jurídico das Facturas e Documentos Equivalentes (Decreto Presidencial n.º 292/18)
- Regime de Retenção na Fonte de IVA (Decreto Presidencial n.º 180/19 - 7%)
- Código do Imposto Industrial (Retenção na fonte de 6.5% sobre serviços)
- Plano Geral de Contabilidade de Angola (PGC - Decreto n.º 82/01)
"""
import re
import json
import logging
from decimal import Decimal, InvalidOperation
from datetime import datetime, date

from decouple import config
from groq import Groq
import pdfplumber

from .models import Empresa, Factura, LancamentoContabilistico, LinhaLancamento, DocumentoUpload
from .pdf_service import get_groq_client, tentar_modelos

logger = logging.getLogger('reconciliacao')


def _converter_decimal(valor, padrao='0.00'):
    """Converte com segurança qualquer representação de valor para Decimal."""
    if valor is None or valor == '':
        return Decimal(padrao)
    if isinstance(valor, (int, float, Decimal)):
        try:
            return Decimal(str(valor)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError):
            return Decimal(padrao)
    
    val_str = str(valor).strip().replace('Kz', '').replace('KZ', '').replace('kz', '').strip()
    # Tratar pontuação angolana/europeia: 1.500,50 -> 1500.50
    if ',' in val_str and '.' in val_str:
        if val_str.rfind(',') > val_str.rfind('.'):
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    
    # Remover caracteres que não sejam dígitos, sinal ou ponto
    val_limpo = re.sub(r'[^\d.-]', '', val_str)
    try:
        return Decimal(val_limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal(padrao)


def _formatar_data(data_str):
    """Normaliza texto de data para YYYY-MM-DD."""
    if not data_str:
        return None
    if isinstance(data_str, (datetime, date)):
        return data_str.strftime('%Y-%m-%d')
    
    data_limpa = str(data_str).strip()
    padroes = [
        (r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"),
        (r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', lambda m: f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"),
    ]
    for padrao, formatador in padroes:
        m = re.search(padrao, data_limpa)
        if m:
            try:
                dt_str = formatador(m)
                datetime.strptime(dt_str, '%Y-%m-%d')
                return dt_str
            except ValueError:
                continue
    return None


def extrair_texto_ficheiro(caminho_arquivo):
    """Extrai texto bruto de um PDF ou ficheiro de texto."""
    texto = ""
    try:
        if caminho_arquivo.lower().endswith('.pdf'):
            with pdfplumber.open(caminho_arquivo) as pdf:
                for pag in pdf.pages:
                    texto_pag = pag.extract_text() or ""
                    texto += texto_pag + "\n"
        else:
            with open(caminho_arquivo, 'r', encoding='utf-8', errors='ignore') as f:
                texto = f.read()
    except Exception as e:
        logger.error(f"Erro ao ler ficheiro para extracao: {e}")
        texto = ""
    return texto.strip()


PROMPT_SISTEMA_FACTURA = """Tu és um Perito Contabilista e Auditor Fiscal Sénior em Angola, especialista na legislação da AGT (Administração Geral Tributária), Código do IVA (CIVA), Decreto Presidencial n.º 292/18 (Regime das Facturas) e no PGC (Plano Geral de Contabilidade de Angola).

Analisa o texto da factura fornecida e extrai com rigor absoluto todos os dados fiscais e contabilísticos no formato JSON estruturado.

Campos obrigatórios a extrair no JSON:
{
  "tipo_documento": "FT" (Factura), "FR" (Factura-Recibo), "FS" (Factura Simplificada), "NC" (Nota de Crédito) ou "ND" (Nota de Débito),
  "tipo_operacao": "COMPRA" ou "VENDA",
  "numero_factura": "Número oficial da fatura (ex: FT 2026/00142)",
  "data_emissao": "YYYY-MM-DD",
  "data_vencimento": "YYYY-MM-DD ou null",
  "fornecedor_nome": "Denominação social completa do emissor/fornecedor",
  "fornecedor_nif": "NIF do emissor (10 dígitos para pessoas colectivas)",
  "fornecedor_endereco": "Endereço ou cidade do fornecedor",
  "cliente_nome": "Nome/Denominação do adquirente/cliente",
  "cliente_nif": "NIF do adquirente (10 dígitos)",
  "base_incidencia": 0.00,
  "taxa_iva": 14.00,
  "valor_iva": 0.00,
  "motivo_isencao_iva": "Código/artigo de isenção se taxa for 0% (ex: M02 - Artigo 12.º do CIVA)",
  "retencao_iva": 0.00 (Retenção de 7% de IVA ao abrigo do Dec. Presidencial 180/19 se aplicável),
  "retencao_ii": 0.00 (Retenção na fonte de 6.5% de Imposto Industrial sobre serviços se aplicável),
  "valor_total": 0.00 (Total bruto: Base + IVA),
  "valor_liquido": 0.00 (Total a pagar: Total - Retenções),
  "software_certificacao": "Menção de certificação AGT (ex: Processado por programa validado nº .../AGT/...)",
  "hash_agt": "4 caracteres do hash de certificação (ex: aB3x)",
  "iva_dedutivel": true ou false,
  "motivo_nao_dedutivel": "Explicar se IVA não é dedutível nos termos do Art. 19º e 20º do CIVA (ex: refeições, combustíveis sem afectação directa, viaturas de turismo)",
  "conta_custo_sugerida": "Código PGC da despesa (ex: 61.1 para mercadorias, 62.2.1 eletricidade, 62.2.2 comunicações, 62.2.4 combustíveis, 62.2.6 rendas, 62.2.8 serviços especializados)",
  "conta_custo_nome": "Designação da conta PGC",
  "conta_terceiro_sugerida": "32.1.1",
  "conta_terceiro_nome": "Fornecedores Nacionais - Correntes",
  "conta_iva_sugerida": "34.5.2",
  "conta_iva_nome": "IVA Suportado - Operações Gerais",
  "itens": [
    {
      "descricao": "Descrição do bem ou serviço",
      "quantidade": 1.0,
      "preco_unitario": 0.00,
      "taxa_iva": 14.0,
      "total": 0.00
    }
  ],
  "alertas": ["lista de alertas se faltar NIF, certificação AGT, cálculo incorreto, etc."]
}

Devolve APENAS o JSON válido, sem texto explicativo adicional.
"""


def analisar_factura_com_ia(texto_factura, empresa_nif=None):
    """Envia o texto da fatura para o Groq LLM e devolve os dados estruturados."""
    client = get_groq_client()
    
    prompt_usuario = f"""Texto extraído da Factura:
---
{texto_factura[:8000]}
---
NIF da empresa cliente no sistema (se presente na fatura como adquirente): {empresa_nif or 'Não especificado'}

Gera o JSON completo conforme as regras da AGT e PGC de Angola."""

    messages = [
        {"role": "system", "content": PROMPT_SISTEMA_FACTURA},
        {"role": "user", "content": prompt_usuario}
    ]

    response, modelo_usado = tentar_modelos(client, messages, temperature=0.1, max_tokens=3500)
    conteudo = response.choices[0].message.content.strip()

    # Extrair JSON caso haja marcadores de código markdown
    if "```json" in conteudo:
        conteudo = conteudo.split("```json")[1].split("```")[0].strip()
    elif "```" in conteudo:
        conteudo = conteudo.split("```")[1].split("```")[0].strip()

    try:
        dados = json.loads(conteudo)
    except json.JSONDecodeError as err:
        logger.warning(f"Erro ao decodificar JSON do modelo {modelo_usado}: {err}. Tentando regex fallback.")
        dados = extrair_dados_heuristica(texto_factura)

    return dados, modelo_usado


def extrair_dados_heuristica(texto):
    """Extração determinística por Regex para resiliência caso a IA não esteja disponível."""
    dados = {
        "tipo_documento": "FT",
        "tipo_operacao": "COMPRA",
        "numero_factura": "FT",
        "data_emissao": None,
        "data_vencimento": None,
        "fornecedor_nome": "",
        "fornecedor_nif": "",
        "fornecedor_endereco": "",
        "cliente_nome": "",
        "cliente_nif": "",
        "base_incidencia": 0.0,
        "taxa_iva": 14.0,
        "valor_iva": 0.0,
        "motivo_isencao_iva": "",
        "retencao_iva": 0.0,
        "retencao_ii": 0.0,
        "valor_total": 0.0,
        "valor_liquido": 0.0,
        "software_certificacao": "",
        "hash_agt": "",
        "iva_dedutivel": True,
        "motivo_nao_dedutivel": "",
        "conta_custo_sugerida": "62.2",
        "conta_custo_nome": "Fornecimentos e Serviços de Terceiros",
        "conta_terceiro_sugerida": "32.1.1",
        "conta_terceiro_nome": "Fornecedores Nacionais - Correntes",
        "conta_iva_sugerida": "34.5.2",
        "conta_iva_nome": "IVA Suportado - Operações Gerais",
        "itens": [],
        "alertas": []
    }

    # Tipo e Número de Fatura
    m_num = re.search(r'(F[T|R|S]|NC|ND)\s*([A-Z0-9\/\.\-]+)', texto, re.IGNORECASE)
    if m_num:
        dados["tipo_documento"] = m_num.group(1).upper()
        dados["numero_factura"] = f"{dados['tipo_documento']} {m_num.group(2).strip()}"

    # NIFs de Angola (10 dígitos começando por 5 para empresas)
    nifs = re.findall(r'(?<!\d)(5\d{9})(?!\d)', texto)
    if nifs:
        dados["fornecedor_nif"] = nifs[0]
        if len(nifs) > 1:
            dados["cliente_nif"] = nifs[1]

    # Certificação AGT
    m_cert = re.search(r'([A-Za-z0-9\.\-\s]+validado\s*n\.?[ºo]?\s*[0-9A-Za-z\/\_\-]+AGT[0-9A-Za-z\/\_\-]*)', texto, re.IGNORECASE)
    if m_cert:
        dados["software_certificacao"] = m_cert.group(1).strip()

    # Hash AGT (ex: -Processado por... ou no rodapé 4 chars com traço)
    m_hash = re.search(r'([a-zA-Z0-9]{4})-Processado', texto)
    if m_hash:
        dados["hash_agt"] = m_hash.group(1)

    return dados


def auditar_e_validar_regras_fiscais(dados, empresa_atual=None):
    """
    Executa bateria de testes de conformidade fiscal da AGT e PGC de Angola:
    1. Validação de NIFs
    2. Menção legal de certificação de software
    3. Coerência matemática (Base + IVA - Retenções == Líquido)
    4. Dedução de IVA segundo os artigos 19º e 20º do CIVA
    5. Retenção na fonte de IVA (7%) e Imposto Industrial (6.5%)
    """
    alertas = list(dados.get('alertas', []))
    conformidade = 'CONFORME'

    fornecedor_nif = str(dados.get('fornecedor_nif') or '').strip()
    cliente_nif = str(dados.get('cliente_nif') or '').strip()
    certificacao = str(dados.get('software_certificacao') or '').strip()

    # 1. Validação do NIF do Fornecedor
    if not fornecedor_nif:
        alertas.append("NIF do fornecedor não identificado. Documento fiscal incompleto perante a AGT.")
        conformidade = 'IRREGULAR'
    elif len(fornecedor_nif) != 10:
        alertas.append(f"O NIF do fornecedor '{fornecedor_nif}' não possui 10 dígitos exigidos pela AGT.")
        conformidade = 'AVISO'

    # 2. Verificação do Adquirente com a Empresa Ativa
    if empresa_atual and empresa_atual.nif:
        emp_nif = empresa_atual.nif.strip()
        if cliente_nif and cliente_nif != emp_nif:
            alertas.append(
                f"Atenção: O NIF do adquirente na fatura ({cliente_nif}) não coincide com o NIF da empresa ativa ({emp_nif}). "
                "Este IVA não poderá ser deduzido nesta empresa!"
            )
            dados['iva_dedutivel'] = False
            dados['motivo_nao_dedutivel'] = f"Fatura emitida a favor de outro NIF ({cliente_nif})."
            conformidade = 'AVISO'

    # 3. Validação de Software Certificado pela AGT (Dec. Presidencial 292/18)
    tem_cert = 'AGT' in certificacao.upper() or 'VALIDADO' in certificacao.upper() or bool(dados.get('hash_agt'))
    if not tem_cert:
        alertas.append(
            "Ausência de menção de software certificado pela AGT ou Hash de validação. "
            "Risco de o documento não ser aceite como custo fiscal."
        )
        if conformidade == 'CONFORME':
            conformidade = 'AVISO'

    # 4. Coerência Matemática
    base = _converter_decimal(dados.get('base_incidencia'))
    taxa = _converter_decimal(dados.get('taxa_iva'), '14.00')
    iva = _converter_decimal(dados.get('valor_iva'))
    ret_iva = _converter_decimal(dados.get('retencao_iva'))
    ret_ii = _converter_decimal(dados.get('retencao_ii'))
    total = _converter_decimal(dados.get('valor_total'))
    liquido = _converter_decimal(dados.get('valor_liquido'))

    # Se total estiver a zero mas base e IVA existirem
    if total == Decimal('0.00') and (base > 0 or iva > 0):
        total = base + iva
        dados['valor_total'] = float(total)

    # Verificar cálculo do IVA esperado
    if taxa > 0 and base > 0:
        iva_esperado = (base * (taxa / Decimal('100.00'))).quantize(Decimal('0.01'))
        if abs(iva - iva_esperado) > Decimal('1.00') and iva > 0:
            alertas.append(
                f"Divergência no cálculo do IVA: IVA faturado ({iva} Kz) difere do cálculo à taxa de {taxa}% ({iva_esperado} Kz)."
            )
            if conformidade == 'CONFORME':
                conformidade = 'AVISO'

    # Verificar valor líquido a pagar
    liquido_calculado = total - ret_iva - ret_ii
    if liquido == Decimal('0.00') and total > 0:
        liquido = liquido_calculado
        dados['valor_liquido'] = float(liquido)
    elif abs(liquido - liquido_calculado) > Decimal('1.00') and liquido > 0:
        alertas.append(
            f"Diferença no valor líquido a pagar: {liquido} Kz faturado vs {liquido_calculado} Kz calculado."
        )

    # 5. Elegibilidade de Dedução do IVA (CIVA Arts. 19º e 20º)
    desc_itens = " ".join([it.get('descricao', '') for it in dados.get('itens', [])]).lower()
    fornecedor_nome = (dados.get('fornecedor_nome') or '').lower()
    
    palavras_restritas = ['combustivel', 'gasolina', 'restaurante', 'refeicao', 'hotel', 'alojamento', 'viatura de turismo', 'tabaco', 'bebidas alcoolicas']
    for p in palavras_restritas:
        if p in desc_itens or p in fornecedor_nome:
            if 'combustivel' in p or 'gasolina' in p:
                alertas.append("CIVA Art. 20.º: O IVA de despesas com combustíveis tem limitações de dedução (exclui gasolina; gasóleo dedutível a 50% salvo atividades de transporte).")
            elif 'restaurante' in p or 'refeicao' in p:
                alertas.append("CIVA Art. 20.º: Despesas com alimentação, refeições e bebidas são excluídas do direito à dedução do IVA.")
                dados['iva_dedutivel'] = False
                dados['motivo_nao_dedutivel'] = "Excluído de dedução nos termos da alínea d) do n.º 1 do Art. 20.º do CIVA."
            elif 'viatura' in p:
                alertas.append("CIVA Art. 20.º: Despesas com viaturas de turismo não afectas à exploração comercial são excluídas da dedução.")
            break

    dados['conformidade_agt'] = conformidade
    dados['alertas_auditoria'] = alertas
    return dados


def processar_factura_ficheiro(arquivo_path, nome_arquivo, empresa_id=None, doc_upload_id=None):
    """
    Pipeline mestre:
    1. Extrai texto do ficheiro.
    2. Envia para IA analisar com as regras de Angola.
    3. Executa auditoria fiscal automatizada.
    4. Grava na tabela Factura associada à empresa.
    """
    texto = extrair_texto_ficheiro(arquivo_path)
    if not texto:
        raise ValueError("Não foi possível extrair texto do documento da fatura.")

    empresa = None
    if empresa_id:
        empresa = Empresa.objects.filter(pk=empresa_id).first()

    empresa_nif = empresa.nif if empresa else None
    dados_ia, modelo = analisar_factura_com_ia(texto, empresa_nif=empresa_nif)
    dados_validados = auditar_e_validar_regras_fiscais(dados_ia, empresa_atual=empresa)

    # Identificar Empresa se não foi passada
    if not empresa:
        # Se cliente_nif bate com alguma empresa
        c_nif = dados_validados.get('cliente_nif')
        if c_nif:
            empresa = Empresa.objects.filter(nif=c_nif).first()
        if not empresa:
            f_nif = dados_validados.get('fornecedor_nif')
            if f_nif:
                empresa = Empresa.objects.filter(nif=f_nif).first()
        if not empresa:
            empresa = Empresa.objects.first()

    if not empresa:
        raise ValueError("Nenhuma empresa configurada no sistema para associar a fatura.")

    # Data de emissão e período
    dt_emissao = _formatar_data(dados_validados.get('data_emissao'))
    dt_venc = _formatar_data(dados_validados.get('data_vencimento'))
    
    ano = None
    mes = None
    if dt_emissao:
        partes = dt_emissao.split('-')
        ano = int(partes[0])
        mes = int(partes[1])
    else:
        ano = datetime.now().year
        mes = datetime.now().month

    doc_upload = None
    if doc_upload_id:
        doc_upload = DocumentoUpload.objects.filter(pk=doc_upload_id).first()

    factura = Factura.objects.create(
        empresa=empresa,
        documento=doc_upload,
        tipo_documento=(dados_validados.get('tipo_documento') or 'FT')[:10],
        tipo_operacao=(dados_validados.get('tipo_operacao') or 'COMPRA')[:10],
        numero_factura=(dados_validados.get('numero_factura') or f"FT-{int(datetime.now().timestamp())}")[:80],
        data_emissao=dt_emissao,
        data_vencimento=dt_venc,
        ano=ano,
        mes=mes,
        fornecedor_nome=(dados_validados.get('fornecedor_nome') or '')[:200],
        fornecedor_nif=(dados_validados.get('fornecedor_nif') or '')[:30],
        fornecedor_endereco=(dados_validados.get('fornecedor_endereco') or '')[:255],
        cliente_nome=(dados_validados.get('cliente_nome') or '')[:200],
        cliente_nif=(dados_validados.get('cliente_nif') or '')[:30],
        base_incidencia=_converter_decimal(dados_validados.get('base_incidencia')),
        taxa_iva=_converter_decimal(dados_validados.get('taxa_iva'), '14.00'),
        valor_iva=_converter_decimal(dados_validados.get('valor_iva')),
        motivo_isencao_iva=(dados_validados.get('motivo_isencao_iva') or '')[:200],
        retencao_iva=_converter_decimal(dados_validados.get('retencao_iva')),
        retencao_ii=_converter_decimal(dados_validados.get('retencao_ii')),
        valor_total=_converter_decimal(dados_validados.get('valor_total')),
        valor_liquido=_converter_decimal(dados_validados.get('valor_liquido')),
        software_certificacao=(dados_validados.get('software_certificacao') or '')[:150],
        hash_agt=(dados_validados.get('hash_agt') or '')[:20],
        iva_dedutivel=bool(dados_validados.get('iva_dedutivel', True)),
        motivo_nao_dedutivel=(dados_validados.get('motivo_nao_dedutivel') or '')[:255],
        conformidade_agt=(dados_validados.get('conformidade_agt') or 'CONFORME')[:20],
        alertas_auditoria=dados_validados.get('alertas_auditoria') or [],
        conta_custo_sugerida=(dados_validados.get('conta_custo_sugerida') or '62.2')[:40],
        conta_custo_nome=(dados_validados.get('conta_custo_nome') or 'Fornecimentos e Serviços de Terceiros')[:150],
        conta_terceiro_sugerida=(dados_validados.get('conta_terceiro_sugerida') or '32.1.1')[:40],
        conta_terceiro_nome=(dados_validados.get('conta_terceiro_nome') or 'Fornecedores Nacionais - Correntes')[:150],
        conta_iva_sugerida=(dados_validados.get('conta_iva_sugerida') or '34.5.2')[:40],
        conta_iva_nome=(dados_validados.get('conta_iva_nome') or 'IVA Suportado - Operações Gerais')[:150],
        itens_detalhe=dados_validados.get('itens') or []
    )

    return factura


def criar_lancamento_contabilistico_da_factura(factura, user=None):
    """
    Gera lançamento no Livro Diário em Partidas Dobradas:
    Débito: Conta de Custo (Base tributável + IVA se não dedutível)
    Débito: Conta de IVA Suportado 34.5.2 (se IVA for dedutível)
    Crédito: Retenções na Fonte 34.2.x (se houver)
    Crédito: Conta de Fornecedor 32.1.x (Valor líquido a pagar)
    """
    if factura.lancado_na_contabilidade and factura.lancamento:
        return factura.lancamento, False, "Esta fatura já se encontra lançada na contabilidade."

    empresa = factura.empresa
    ano = factura.ano or datetime.now().year
    mes = factura.mes or datetime.now().month
    dt_lanc = factura.data_emissao or date.today()

    # Gerar número sequencial do diário de compras
    total_compras = LancamentoContabilistico.objects.filter(
        empresa=empresa, ano=ano, tipo_diario='COMPRAS'
    ).count() + 1
    numero_diario = f"COM-{ano}-{total_compras:04d}"

    descricao = f"Registo de Fatura {factura.numero_factura} - {factura.fornecedor_nome or 'Fornecedor'}"
    if len(descricao) > 250:
        descricao = descricao[:250]

    # Cálculos das parcelas em partidas dobradas
    base = factura.base_incidencia
    iva = factura.valor_iva
    ret_iva = factura.retencao_iva
    ret_ii = factura.retencao_ii
    liquido = factura.valor_liquido
    total_bruto = factura.valor_total

    # Se IVA não for dedutível, vai para o custo do bem/serviço (regra fundamental PGC)
    if factura.iva_dedutivel:
        valor_custo = base
        valor_iva_dedutivel = iva
    else:
        valor_custo = base + iva
        valor_iva_dedutivel = Decimal('0.00')

    # Total Débito = valor_custo + valor_iva_dedutivel == total_bruto
    # Total Crédito = ret_iva + ret_ii + liquido == total_bruto
    total_debito = (valor_custo + valor_iva_dedutivel).quantize(Decimal('0.01'))
    total_credito = (liquido + ret_iva + ret_ii).quantize(Decimal('0.01'))

    # Ajuste fino de cêntimos de arredondamento se necessário
    if total_debito != total_credito:
        diff = total_debito - total_credito
        liquido += diff
        total_credito = total_debito

    lancamento = LancamentoContabilistico.objects.create(
        empresa=empresa,
        numero_diario=numero_diario,
        data_lancamento=dt_lanc,
        tipo_diario='COMPRAS',
        descricao=descricao,
        documento_referencia=factura.numero_factura,
        documento_anexo=factura.documento,
        ano=ano,
        mes=mes,
        total_debito=total_debito,
        total_credito=total_credito,
        estado='CONFIRMADO',
        criado_por=user
    )

    ordem = 1
    # 1. Linha Débito Custo
    LinhaLancamento.objects.create(
        lancamento=lancamento,
        ordem=ordem,
        conta_codigo=factura.conta_custo_sugerida or '62.2',
        conta_nome=factura.conta_custo_nome or 'Fornecimentos e Serviços de Terceiros',
        debito=valor_custo,
        credito=Decimal('0.00'),
        descricao_linha=f"Custo base fatura {factura.numero_factura}",
        terceiro_nif=factura.fornecedor_nif,
        terceiro_nome=factura.fornecedor_nome
    )
    ordem += 1

    # 2. Linha Débito IVA Suportado (se dedutível)
    if valor_iva_dedutivel > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo=factura.conta_iva_sugerida or '34.5.2',
            conta_nome=factura.conta_iva_nome or 'IVA Suportado - Operações Gerais',
            debito=valor_iva_dedutivel,
            credito=Decimal('0.00'),
            descricao_linha=f"IVA Suportado {factura.taxa_iva}% - {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 3. Linha Crédito Retenção de IVA (se houver)
    if ret_iva > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo='34.2.2',
            conta_nome='Retenção na Fonte de IVA (7%)',
            debito=Decimal('0.00'),
            credito=ret_iva,
            descricao_linha=f"Retenção 7% IVA Dec. 180/19 s/ {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 4. Linha Crédito Retenção de Imposto Industrial (se houver)
    if ret_ii > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo='34.2.1',
            conta_nome='Retenção na Fonte de Imposto Industrial (6.5%)',
            debito=Decimal('0.00'),
            credito=ret_ii,
            descricao_linha=f"Retenção 6.5% Imposto Industrial s/ {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 5. Linha Crédito Fornecedor (Valor líquido a liquidar)
    LinhaLancamento.objects.create(
        lancamento=lancamento,
        ordem=ordem,
        conta_codigo=factura.conta_terceiro_sugerida or '32.1.1',
        conta_nome=factura.conta_terceiro_nome or 'Fornecedores Nacionais - Correntes',
        debito=Decimal('0.00'),
        credito=liquido,
        descricao_linha=f"Valor líquido da fatura {factura.numero_factura}",
        terceiro_nif=factura.fornecedor_nif,
        terceiro_nome=factura.fornecedor_nome
    )

    factura.lancado_na_contabilidade = True
    factura.lancamento = lancamento
    factura.save(update_fields=['lancado_na_contabilidade', 'lancamento', 'updated_at'])

    return lancamento, True, f"Lançamento {numero_diario} escriturado com sucesso no Diário de Compras."
