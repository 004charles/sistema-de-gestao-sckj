"""Serviço de análise e processamento de Dossiê Mensal Completo (Envelope Fiscal).

Recebe um único documento PDF (ex: dossiê com dezenas de páginas enviado pela empresa)
contendo múltiplos documentos fiscais e contabilísticos agrupados:
- Balancete de Verificação
- Declaração Modelo 7 de IVA / Anexo de Fornecedores / Liquidação de IVA
- Folha de Remunerações de Salários e Recibos
- Declaração e Mapa de IRT
- Guia e Comprovativo da Segurança Social (INSS)
- Retenções na Fonte de Imposto Industrial (6,5%) e Comprovativos

Segmenta inteligentemente o ficheiro em secções dedicadas, salva cada documento
no banco com o seu tipo oficial, sincroniza dados contabilísticos/fiscais e
dispara o motor de auditoria preventiva 360º.
"""
import io
import logging
import re
import unicodedata
from decimal import Decimal
from django.core.files.base import ContentFile
import pdfplumber
import pypdfium2 as pdfium

from .models import DocumentoUpload, Empresa, Contabilidade, DeclaracaoAGT
from . import pdf_service
from . import regra_engine

logger = logging.getLogger('reconciliacao')


def _norm(texto):
    if not texto:
        return ''
    return ''.join(
        c for c in unicodedata.normalize('NFKD', str(texto))
        if not unicodedata.combining(c)
    ).lower()


def classificar_pagina(texto, tipo_anterior=None):
    """Identifica o tipo de documento a que uma página pertence com base no seu conteúdo textual."""
    tn = _norm(texto)
    
    # 1. Balancete
    if 'balancete geral' in tn or ('balancete' in tn and ('mov. debito' in tn or 'soma saldos' in tn or 'soma liquida' in tn)):
        return 'BALANCETE'
    if tipo_anterior == 'BALANCETE' and ('saldo debito' in tn or 'saldo credito' in tn or 'soma saldos' in tn or 'cegid' in tn):
        return 'BALANCETE'

    # 2. Modelo 7 / IVA
    if (
        'modelo 7' in tn or 'modelo7' in tn or 'comprovativo de liquidacao de iva' in tn
        or 'liquidacao de iva' in tn or 'anexo de fornecedores - modelo 7' in tn
        or 'mod. iva-doc' in tn or 'comprovativo de entrega de declaracao modelo 7' in tn
    ):
        return 'MODELO7'
    if tipo_anterior == 'MODELO7' and (
        'anexo de fornecedores' in tn or 'deduzir saft' in tn or 'deduzir fe' in tn
        or 'valor tributavel' in tn or 'iva dedutivel' in tn
    ):
        return 'MODELO7'

    # 3. IRT
    if (
        'mapa anexo da retencao na fonte de irt' in tn
        or 'rendimentos do trabalho' in tn
        or 'mod. irt-doc' in tn
        or 'irt- retencao na fonte' in tn
        or 'imposto sobre os rendimentos do trabalho' in tn
    ):
        return 'DECLARACAO_IRT'
    if tipo_anterior == 'DECLARACAO_IRT' and ('responsavel pela retencao' in tn or 'subsidios' in tn):
        return 'DECLARACAO_IRT'

    # 4. Retenções na Fonte (Imposto Industrial 6.5%)
    if (
        'retencao na fonte de imposto industrial' in tn
        or 'mapa de retencao na fonte de imposto industrial' in tn
        or 'retencao na fonte - residentes' in tn
        or 'nota de liquidacao' in tn and 'imposto industrial' in tn
        or 'taxa de servicos de contabilidade' in tn and 'retencao' in tn
    ):
        return 'RETENCOES'
    if tipo_anterior == 'RETENCOES' and (
        'nota de liquidacao' in tn or 'recibo de pagamento' in tn or 'comprovativo digital' in tn
    ):
        return 'RETENCOES'

    # 5. Segurança Social (INSS)
    if 'seguranca social' in tn or 'guia de pagamento' in tn and 'inss' in tn or 'inscricao no inss' in tn:
        return 'FOLHA_SS'
    if tipo_anterior == 'FOLHA_SS' and ('comprovativo digital' in tn or 'multicaixa express' in tn):
        return 'FOLHA_SS'

    # 6. Folha Salarial e Recibos
    if (
        'folha de remuneracao de salario' in tn
        or 'recibo de salario' in tn
        or 'saralio liquido' in tn
        or 'salario base' in tn and 'subs. feria' in tn
    ):
        return 'FOLHA_SALARIAL'
    if tipo_anterior == 'FOLHA_SALARIAL' and ('total a pagar' in tn or 'recibo de salario' in tn):
        return 'FOLHA_SALARIAL'

    # 7. Comprovativos bancários soltos
    if 'comprovativo digital' in tn or 'multicaixa express' in tn or 'talão' in tn:
        return 'COMPROVATIVOS'

    # 8. Folha de rosto / resumo
    if 'resumul de salario' in tn or 'cliente' in tn and 'a pagar' in tn:
        return 'OUTRO'

    return tipo_anterior or 'OUTRO'


def detectar_periodo_e_nif(texto):
    """Extrai ano, mes e NIF a partir do texto de uma secção de documento."""
    tn = _norm(texto)
    ano, mes, nif = None, None, None

    # Procura NIF de 10 dígitos (formato angolano de pessoa coletiva, e.g. 5001136917)
    match_nif = re.search(r'\b(5\d{9})\b', texto)
    if match_nif:
        nif = match_nif.group(1)

    if match_nif:
        nif = match_nif.group(1)

    # Procura formato específico de cabeçalho: "balancete geral (julho) - 2026" ou "mês de julho"
    meses_pt = {
        'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4,
        'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
        'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    }
    
    # 1. Prioridade para menção em Balancete Geral
    match_bal_mes = re.search(r'balancete\s+geral\s*\(([a-z]+)\)', tn)
    if match_bal_mes and match_bal_mes.group(1) in meses_pt:
        mes = meses_pt[match_bal_mes.group(1)]

    # 2. Se não achou no balancete, contar frequência de cada mês
    if not mes:
        frequencias = {}
        for m_nome, m_num in meses_pt.items():
            qtd = len(re.findall(r'\b' + m_nome + r'\b', tn))
            if qtd > 0:
                frequencias[m_num] = qtd
        if frequencias:
            mes = max(frequencias, key=frequencias.get)

    # Procura formato MM/YYYY ou YYYY-MM
    match_data = re.search(r'\b(0?[1-9]|1[0-2])/(20\d{2})\b', texto)
    if match_data:
        if not mes:
            mes = int(match_data.group(1))
        ano = int(match_data.group(2))
    else:
        match_ano = re.search(r'\b(202[0-9])\b', texto)
        if match_ano:
            ano = int(match_ano.group(1))

    return ano, mes, nif


def is_dossie_mensal(caminho_pdf):
    """Determina se um PDF é um Dossiê Mensal composto por múltiplos tipos de documento."""
    try:
        with pdfplumber.open(caminho_pdf) as pdf:
            total = len(pdf.pages)
            if total < 4:
                return False
            
            tipos_encontrados = set()
            tipo_ant = None
            for p in pdf.pages[:30]:
                txt = p.extract_text() or ''
                t = classificar_pagina(txt, tipo_ant)
                if t and t != 'OUTRO':
                    tipos_encontrados.add(t)
                tipo_ant = t
            
            # Se contém pelo menos 2 tipos de documentos diferentes (ex: Balancete + Modelo 7, ou Folha + Balancete)
            return len(tipos_encontrados) >= 2
    except Exception as e:
        logger.warning(f"Erro ao verificar se é dossiê mensal: {e}")
        return False


def desmembrar_e_processar_dossie(caminho_pdf, empresa, ano_padrao=None, mes_padrao=None):
    """Desmembra o PDF do dossiê em blocos de páginas, cria DocumentoUpload para cada um,
    sincroniza com as tabelas de contabilidade/declarações e executa a auditoria integrada.
    """
    logger.info(f"Iniciando desmembramento de dossiê para empresa {empresa.nome} (caminho={caminho_pdf})")
    
    # 1. Carregar páginas com pdfplumber e classificar
    paginas_info = []
    with pdfplumber.open(caminho_pdf) as pdf:
        tipo_ant = None
        for i, p in enumerate(pdf.pages):
            txt = p.extract_text() or ''
            t = classificar_pagina(txt, tipo_ant)
            paginas_info.append({
                'numero': i, # 0-indexed
                'tipo': t,
                'texto': txt,
            })
            tipo_ant = t

    # 2. Agrupar em blocos contíguos do mesmo tipo (ou blocos complementares)
    blocos = []
    bloco_atual = None
    
    for p in paginas_info:
        tipo = p['tipo']
        if bloco_atual is None:
            bloco_atual = {'tipo': tipo, 'paginas': [p['numero']], 'textos': [p['texto']]}
        elif bloco_atual['tipo'] == tipo:
            bloco_atual['paginas'].append(p['numero'])
            bloco_atual['textos'].append(p['texto'])
        else:
            blocos.append(bloco_atual)
            bloco_atual = {'tipo': tipo, 'paginas': [p['numero']], 'textos': [p['texto']]}
            
    if bloco_atual:
        blocos.append(bloco_atual)

    # Unificar blocos dispersos do mesmo tipo quando fizer sentido (ex: recibos ou anexos separados)
    blocos_unificados = {}
    for b in blocos:
        t = b['tipo']
        if t not in blocos_unificados:
            blocos_unificados[t] = {'tipo': t, 'paginas': [], 'textos': []}
        blocos_unificados[t]['paginas'].extend(b['paginas'])
        blocos_unificados[t]['textos'].extend(b['textos'])

    # 3. Fatiar e gerar os sub-documentos com pypdfium2
    doc_original = pdfium.PdfDocument(caminho_pdf)
    documentos_criados = []

    nomes_amigaveis = {
        'BALANCETE': 'Balancete Geral de Verificação',
        'MODELO7': 'Declaração Modelo 7 de IVA e Anexos',
        'FOLHA_SALARIAL': 'Folha de Remuneração e Recibos de Salário',
        'FOLHA_SS': 'Guia e Comprovativo da Segurança Social (INSS)',
        'DECLARACAO_IRT': 'Declaração e Mapa de IRT',
        'RETENCOES': 'Retenção na Fonte de Imposto Industrial (6.5%)',
        'COMPROVATIVOS': 'Comprovativos de Pagamento Bancário',
        'OUTRO': 'Resumo e Folha de Rosto do Dossiê',
    }

    doc_balancete_obj = None
    doc_modelo7_obj = None

    for tipo, dados in blocos_unificados.items():
        if not dados['paginas']:
            continue
            
        texto_completo = '\n\n'.join(dados['textos'])
        ano_doc, mes_doc, nif_doc = detectar_periodo_e_nif(texto_completo)
        
        ano_final = ano_doc or ano_padrao
        mes_final = mes_doc or mes_padrao

        # Criar sub-PDF em memória
        subdoc = pdfium.PdfDocument.new()
        subdoc.import_pages(doc_original, sorted(dados['paginas']))
        buf = io.BytesIO()
        subdoc.save(buf)
        buf.seek(0)

        nome_amigavel = nomes_amigaveis.get(tipo, tipo)
        nome_arquivo = f"{tipo}_{mes_final:02d}_{ano_final}.pdf" if (mes_final and ano_final) else f"{tipo}_documento.pdf"

        # Criar registo DocumentoUpload
        doc_obj = DocumentoUpload(
            empresa=empresa,
            ano=ano_final,
            mes=mes_final,
            tipo=tipo,
            tipo_sugerido=tipo,
            estado='VALIDADO',
            nome_arquivo=f"{nome_amigavel} ({nome_arquivo})",
            texto_extraido=texto_completo,
        )
        doc_obj.arquivo.save(nome_arquivo, ContentFile(buf.getvalue()), save=True)
        documentos_criados.append({
            'id': doc_obj.id,
            'tipo': doc_obj.tipo,
            'nome': doc_obj.nome_arquivo,
            'ano': doc_obj.ano,
            'mes': doc_obj.mes,
            'paginas': [p + 1 for p in dados['paginas']],
        })

        if tipo == 'BALANCETE':
            doc_balancete_obj = doc_obj
        elif tipo == 'MODELO7':
            doc_modelo7_obj = doc_obj

    # 4. Sincronizar dados estruturados com Contabilidade e DeclaracaoAGT
    if doc_balancete_obj or doc_modelo7_obj:
        ano_sync = (doc_balancete_obj and doc_balancete_obj.ano) or (doc_modelo7_obj and doc_modelo7_obj.ano) or ano_padrao
        mes_sync = (doc_balancete_obj and doc_balancete_obj.mes) or (doc_modelo7_obj and doc_modelo7_obj.mes) or mes_padrao
        
        # Sincroniza Contabilidade a partir do Balancete
        if doc_balancete_obj and doc_balancete_obj.texto_extraido:
            b_dados = pdf_service.extrair_dados_balancete(doc_balancete_obj.texto_extraido)
            # Limpa dados anteriores do mesmo período para evitar duplicação
            Contabilidade.objects.filter(empresa=empresa, ano=ano_sync, mes=mes_sync).delete()
            contas = [
                ('6131', 'Vendas - Mercado Nacional', Decimal('0'), b_dados['vendas'], -b_dados['vendas']),
                ('4511', 'Caixa Kwanza', Decimal('0'), b_dados['caixa_saldo_credor'], -b_dados['caixa_saldo_credor']),
                ('3453', 'IVA Liquidado - Operações Gerais', b_dados['iva_liquidado'], b_dados['iva_liquidado'], Decimal('0')),
                ('3451', 'IVA Suportado / Dedutível', b_dados['iva_suportado'], b_dados['iva_suportado'], Decimal('0')),
                ('3456', 'IVA a Pagar de Apuramento', Decimal('0'), b_dados['iva_pagar'], -b_dados['iva_pagar']),
                ('3431', 'Imposto de Rendimento do Trabalho (IRT)', Decimal('0'), b_dados['irt_retido'], -b_dados['irt_retido']),
                ('3492', 'Segurança Social (INSS)', Decimal('0'), b_dados['inss_retido'], -b_dados['inss_retido']),
                ('3493', 'Retenção na Fonte Prestadores (6,5%)', Decimal('0'), b_dados['retencao_prestadores'], -b_dados['retencao_prestadores']),
                ('722', 'Remunerações - Pessoal', b_dados['remuneracoes'], Decimal('0'), b_dados['remuneracoes']),
            ]
            for cod, desc, deb, cred, sal in contas:
                if deb > 0 or cred > 0:
                    Contabilidade.objects.create(
                        empresa=empresa,
                        ano=ano_sync,
                        mes=mes_sync,
                        conta_codigo=cod,
                        conta_descricao=desc,
                        valor_debito=deb,
                        valor_credito=cred,
                        saldo=sal,
                    )

        # Sincroniza DeclaracaoAGT a partir do Modelo 7
        if doc_modelo7_obj and doc_modelo7_obj.texto_extraido:
            m_dados = pdf_service.extrair_dados_modelo7(doc_modelo7_obj.texto_extraido)
            DeclaracaoAGT.objects.filter(empresa=empresa, ano=doc_modelo7_obj.ano, mes=doc_modelo7_obj.mes).delete()
            DeclaracaoAGT.objects.create(
                empresa=empresa,
                ano=doc_modelo7_obj.ano,
                mes=doc_modelo7_obj.mes,
                nif=empresa.nif,
                razao_social=empresa.nome,
                regime_iva=empresa.regime_iva or 'Regime Geral',
                iva_liquidado=m_dados['iva_liquidado'],
                iva_dedutivel=m_dados['iva_dedutivel'],
                iva_apurado=m_dados['iva_liquidado'] - m_dados['iva_dedutivel'],
                iva_pagar=m_dados['iva_pagar'],
                iva_recuperar=m_dados['iva_recuperar'],
            )

    # 5. Executar motor de auditoria no período do Balancete
    resumo_auditoria = None
    ano_audit = (doc_balancete_obj and doc_balancete_obj.ano) or ano_padrao
    mes_audit = (doc_balancete_obj and doc_balancete_obj.mes) or mes_padrao
    if ano_audit and mes_audit:
        try:
            resumo_auditoria = regra_engine.executar(empresa, ano_audit, mes_audit)
        except Exception as e:
            logger.exception(f"Erro ao executar motor de auditoria pós-dossiê: {e}")

    # 6. Executar Análise com IA (Parecer e Confronto Executivo para Relatórios)
    analise_ia_id = None
    if doc_balancete_obj and doc_modelo7_obj:
        try:
            from .models import AnaliseIA
            res_ia = pdf_service.analisar_documentos(
                doc_balancete_obj.texto_extraido,
                doc_modelo7_obj.texto_extraido,
                'pt'
            )
            if res_ia.get('success'):
                analise_ia_obj = AnaliseIA.objects.create(
                    documento_contabilidade=doc_balancete_obj,
                    documento_agt=doc_modelo7_obj,
                    resultado=res_ia.get('analise'),
                    status='CONCLUIDA'
                )
                analise_ia_id = analise_ia_obj.id
                logger.info(f"AnaliseIA gerada automaticamente com ID {analise_ia_id}")
        except Exception as e:
            logger.warning(f"Erro ao gerar AnaliseIA pós-dossiê: {e}")

    # 7. Executar Reconciliação Contabilidade x AGT automaticamente
    resumo_reconciliacao = None
    if ano_audit and mes_audit:
        try:
            resumo_reconciliacao = executar_reconciliacao_automatica(empresa, ano_audit, mes_audit)
            logger.info(f"Reconciliação automática concluída com sucesso para {empresa.nome} ({mes_audit}/{ano_audit})")
        except Exception as e:
            logger.warning(f"Erro ao executar reconciliação pós-dossiê: {e}")

    return {
        'success': True,
        'mensagem': f"Dossiê desmembrado com sucesso em {len(documentos_criados)} secções documentais!",
        'empresa': empresa.nome,
        'ano': ano_audit,
        'mes': mes_audit,
        'documentos_criados': documentos_criados,
        'auditoria': resumo_auditoria,
        'reconciliacao': resumo_reconciliacao,
        'analise_ia_id': analise_ia_id,
    }


def normalizar_contabilidade(dados_contab):
    """Normaliza as contas do Balancete para apuramento de IVA."""
    resultado = {
        'iva_liquidado': 0.0,
        'iva_dedutivel': 0.0,
        'iva_apuramento': 0.0,
        'iva_pagar': 0.0,
        'iva_recuperar': 0.0,
    }
    for item in dados_contab:
        codigo = (item.conta_codigo or '').strip().upper()
        desc = (item.conta_descricao or '').strip().upper()
        saldo = abs(float(item.saldo or 0))
        if not saldo:
            saldo = max(abs(float(item.valor_debito or 0)), abs(float(item.valor_credito or 0)))

        if 'LIQUIDADO' in codigo or 'LIQUIDADO' in desc or codigo.startswith(('3453', '34.5.3', '24.4.1', '2441')):
            resultado['iva_liquidado'] += saldo
        elif 'DEDUTIVEL' in codigo or 'DEDUTIVEL' in desc or 'SUPORTADO' in desc or codigo.startswith(('3451', '34.5.1', '3452', '34.5.2', '24.4.2', '2442')):
            resultado['iva_dedutivel'] += saldo
        elif 'APURAMENTO' in codigo or 'APURAMENTO' in desc or codigo.startswith(('3455', '34.5.5', '24.4.3', '2443')):
            resultado['iva_apuramento'] += saldo
        elif 'PAGAR' in codigo or 'PAGAR' in desc or codigo.startswith(('3456', '34.5.6', '24.4.4', '2444')):
            resultado['iva_pagar'] += saldo
        elif 'RECUPERAR' in codigo or 'RECUPERAR' in desc or codigo.startswith(('3457', '34.5.7', '24.4.5', '2445')):
            resultado['iva_recuperar'] += saldo

    if resultado['iva_apuramento'] == 0:
        resultado['iva_apuramento'] = resultado['iva_liquidado'] - resultado['iva_dedutivel']
    if resultado['iva_pagar'] == 0 and resultado['iva_recuperar'] == 0:
        if resultado['iva_apuramento'] > 0:
            resultado['iva_pagar'] = resultado['iva_apuramento']
        else:
            resultado['iva_recuperar'] = abs(resultado['iva_apuramento'])

    return resultado


def executar_reconciliacao_automatica(empresa, ano, mes):
    """Executa a reconciliação automática Contabilidade x AGT para o período."""
    from .models import Reconciliacao, ReconciliacaoDetalhe, Contabilidade, DeclaracaoAGT
    if isinstance(empresa, (int, str)):
        from .models import Empresa
        empresa = Empresa.objects.filter(pk=empresa).first()
        if not empresa:
            return None

    dados_contab = Contabilidade.objects.filter(empresa=empresa, ano=ano, mes=mes)
    dados_agt = DeclaracaoAGT.objects.filter(empresa=empresa, ano=ano, mes=mes).first()
    if not dados_agt:
        # Se não há declaração no mesmo mês, tenta o mês mais recente do mesmo ano
        dados_agt = DeclaracaoAGT.objects.filter(empresa=empresa, ano=ano).order_by('-mes').first()

    if not dados_agt and not dados_contab.exists():
        return None

    contab_normalizado = normalizar_contabilidade(dados_contab)

    # Limpar reconciliação anterior do período para manter dados frescos e sem duplicados
    Reconciliacao.objects.filter(empresa=empresa, ano=ano, mes=mes).delete()

    reconciliacao = Reconciliacao.objects.create(
        empresa=empresa,
        ano=ano,
        mes=mes,
        status='PENDENTE'
    )

    campos_comparacao = [
        {'campo': 'IVA Liquidado', 'contab': 'iva_liquidado', 'agt': 'iva_liquidado'},
        {'campo': 'IVA Dedutível', 'contab': 'iva_dedutivel', 'agt': 'iva_dedutivel'},
        {'campo': 'IVA Apuramento', 'contab': 'iva_apuramento', 'agt': 'iva_apurado'},
        {'campo': 'IVA a Pagar', 'contab': 'iva_pagar', 'agt': 'iva_pagar'},
        {'campo': 'IVA a Recuperar', 'contab': 'iva_recuperar', 'agt': 'iva_recuperar'},
    ]

    total_ok = 0
    total_divergencia = 0

    for item in campos_comparacao:
        valor_contab = float(contab_normalizado.get(item['contab'], 0))
        valor_agt = float(getattr(dados_agt, item['agt'], 0)) if dados_agt else 0.0
        diferenca = valor_contab - valor_agt
        status_campo = 'OK' if abs(diferenca) < 0.01 else 'DIVERGENCIA'

        if status_campo == 'OK':
            total_ok += 1
        else:
            total_divergencia += 1

        ReconciliacaoDetalhe.objects.create(
            reconciliacao=reconciliacao,
            campo=item['campo'],
            descricao=f"Comparação {item['campo']}",
            valor_contabilidade=valor_contab,
            valor_agt=valor_agt,
            diferenca=diferenca,
            status=status_campo,
            nivel=2
        )

    reconciliacao.total_campos_ok = total_ok
    reconciliacao.total_campos_divergencia = total_divergencia
    reconciliacao.status = 'CONCILIADO' if total_divergencia == 0 else 'DIVERGENCIA'
    reconciliacao.save()

    return {
        'id': reconciliacao.id,
        'status': reconciliacao.status,
        'total_ok': total_ok,
        'total_divergencia': total_divergencia,
    }

