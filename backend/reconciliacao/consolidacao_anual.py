"""Serviço de Consolidação Anual (12 Meses) — Reconciliação Contabilidade vs AGT.

Cruza o acumulado dos 12 meses de Declarações Modelo 7 de IVA com o Balancete
de Verificação de Fecho (Dezembro) para suporte e preparação da Declaração
Modelo 1 do Imposto Industrial (Código do Imposto Industrial - Lei n.º 19/14 e
Código do IVA - Lei n.º 7/19).
"""
import io
import re
from decimal import Decimal, InvalidOperation
from datetime import date
from django.utils import timezone
from .models import Empresa, DocumentoUpload
from . import agt_modelo7, balancete

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False


def _to_decimal(val):
    if val is None:
        return Decimal('0.00')
    if isinstance(val, Decimal):
        return val.quantize(Decimal('0.01'))
    try:
        limpo = str(val).strip().replace(' ', '').replace(' ', '').replace('.', '').replace(',', '.')
        return Decimal(limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def extrair_dados_balancete_fecho(balancete_doc):
    """Extrai as contas de proveitos (Classe 6), custos (Classe 7) e IVA (34.5) do balancete."""
    if not balancete_doc or not balancete_doc.texto_extraido:
        return {
            'disponivel': False,
            'documento_id': None,
            'nome_arquivo': None,
            'volume_negocios_contab': Decimal('0.00'),
            'vendas_61': Decimal('0.00'),
            'servicos_62': Decimal('0.00'),
            'outros_proveitos_63': Decimal('0.00'),
            'custos_operacionais_7': Decimal('0.00'),
            'iva_liquidado_3453': Decimal('0.00'),
            'iva_dedutivel_3452': Decimal('0.00'),
            'saldo_iva_345': Decimal('0.00'),
            'contas_detalhe': [],
        }

    texto = balancete_doc.texto_extraido
    linhas = balancete.extrair_linhas(texto)

    vendas_61 = Decimal('0.00')
    servicos_62 = Decimal('0.00')
    outros_63 = Decimal('0.00')
    custos_7 = Decimal('0.00')
    iva_liq_3453 = Decimal('0.00')
    iva_ded_3452 = Decimal('0.00')
    saldo_iva_345 = Decimal('0.00')

    contas_detalhe = []

    # Procura contas principais
    for linha in linhas:
        cod = str(linha['codigo']).strip()
        desc = linha['descricao']
        sc = linha['saldo_credito']
        sd = linha['saldo_debito']
        mc = linha['mov_credito']
        md = linha['mov_debito']

        # Contas da Classe 6 (Proveitos) - saldo credor reflete proveito
        if cod == '61' or cod.startswith('61.'):
            # Se for conta de maior nível 61
            if cod == '61' or len(cod) <= 3:
                vendas_61 = max(vendas_61, sc or mc)
        elif cod == '62' or cod.startswith('62.'):
            if cod == '62' or len(cod) <= 3:
                servicos_62 = max(servicos_62, sc or mc)
        elif cod == '63' or cod.startswith('63.'):
            if cod == '63' or len(cod) <= 3:
                outros_63 = max(outros_63, sc or mc)

        # Contas da Classe 7 (Custos) - saldo devedor reflete custo
        elif cod.startswith('7') and len(cod) <= 3:
            custos_7 += (sd or md)

        # Contas de IVA (34.5)
        elif '3453' in cod or '34.5.3' in cod:
            iva_liq_3453 = sc or mc
        elif '3452' in cod or '34.5.2' in cod:
            iva_ded_3452 = sd or md
        elif cod in ('345', '34.5', '3455', '34.5.5'):
            saldo_iva_345 = sc - sd

        contas_detalhe.append({
            'codigo': cod,
            'descricao': desc,
            'saldo_debito': float(sd),
            'saldo_credito': float(sc),
        })

    # Volume de negócios contabilístico (61 + 62)
    vol_negocios = vendas_61 + servicos_62

    return {
        'disponivel': True,
        'documento_id': balancete_doc.id,
        'nome_arquivo': balancete_doc.nome_arquivo,
        'volume_negocios_contab': vol_negocios,
        'vendas_61': vendas_61,
        'servicos_62': servicos_62,
        'outros_proveitos_63': outros_63,
        'custos_operacionais_7': custos_7,
        'iva_liquidado_3453': iva_liq_3453,
        'iva_dedutivel_3452': iva_ded_3452,
        'saldo_iva_345': saldo_iva_345,
        'contas_detalhe': contas_detalhe[:50],  # Primeiras 50 contas para exibição
    }


def extrair_mes_modelo7(doc_m7):
    """Extrai campos principais de um documento Modelo 7."""
    texto = doc_m7.texto_extraido or ''
    dados = agt_modelo7.parse(texto)
    campos = dados.get('campos', {})

    base_trib = dados.get('base_taxa_normal') or campos.get('1', Decimal('0.00'))
    base_isentas = (
        (dados.get('isentas_com_direito') or campos.get('10', Decimal('0.00'))) +
        (dados.get('isentas_sem_direito') or campos.get('11', Decimal('0.00')))
    )
    vol_negocios_mes = (dados.get('base_tributavel') or campos.get('31')) or (base_trib + base_isentas)
    iva_liq = dados.get('iva_liquidado') or campos.get('33', Decimal('0.00'))
    iva_ded = dados.get('iva_dedutivel') or campos.get('32', Decimal('0.00'))
    iva_pag = dados.get('iva_pagar') or campos.get('37', Decimal('0.00'))
    credito = dados.get('iva_recuperar') or campos.get('39', Decimal('0.00'))

    return {
        'documento_id': doc_m7.id,
        'nome_arquivo': doc_m7.nome_arquivo,
        'numero_declaracao': dados.get('numero_declaracao') or f"DOC-{doc_m7.id}",
        'data_recepcao': str(dados.get('data_recepcao') or ''),
        'no_prazo': dados.get('no_prazo'),
        'fora_prazo': dados.get('fora_prazo'),
        'base_tributavel': base_trib,
        'base_isentas': base_isentas,
        'volume_negocios': vol_negocios_mes,
        'iva_liquidado': iva_liq,
        'iva_dedutivel': iva_ded,
        'iva_a_pagar': iva_pag,
        'credito_imposto': credito,
    }


def gerar_consolidacao_anual(empresa_id, ano):
    """Gera o mapa consolidado dos 12 meses de IVA e confronta com o Balancete Anual de Fecho."""
    empresa = Empresa.objects.get(pk=empresa_id)

    # 1. Obter todos os documentos Modelo 7 do ano para esta empresa
    docs_m7 = DocumentoUpload.objects.filter(
        empresa=empresa,
        ano=ano,
        tipo='MODELO7'
    ).order_by('mes')

    mapa_mensal = []
    meses_presentes = set()
    total_vol_negocios_iva = Decimal('0.00')
    total_iva_liquidado = Decimal('0.00')
    total_iva_dedutivel = Decimal('0.00')
    total_iva_pagar = Decimal('0.00')
    total_credito = Decimal('0.00')

    # Dicionário por mês (1 a 12)
    m7_por_mes = {}
    for d in docs_m7:
        if d.mes and 1 <= d.mes <= 12:
            m7_por_mes[d.mes] = d

    NOMES_MESES = [
        '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    for m in range(1, 13):
        doc_mes = m7_por_mes.get(m)
        if doc_mes:
            meses_presentes.add(m)
            extraido = extrair_mes_modelo7(doc_mes)
            vol = extraido['volume_negocios']
            liq = extraido['iva_liquidado']
            ded = extraido['iva_dedutivel']
            pag = extraido['iva_a_pagar']
            cred = extraido['credito_imposto']

            total_vol_negocios_iva += vol
            total_iva_liquidado += liq
            total_iva_dedutivel += ded
            total_iva_pagar += pag
            total_credito += cred

            mapa_mensal.append({
                'mes': m,
                'mes_nome': NOMES_MESES[m],
                'estado': 'DECLARADO',
                'documento_id': doc_mes.id,
                'nome_arquivo': doc_mes.nome_arquivo,
                'numero_declaracao': extraido['numero_declaracao'],
                'volume_negocios': float(vol),
                'iva_liquidado': float(liq),
                'iva_dedutivel': float(ded),
                'iva_a_pagar': float(pag),
                'credito_imposto': float(cred),
            })
        else:
            mapa_mensal.append({
                'mes': m,
                'mes_nome': NOMES_MESES[m],
                'estado': 'EM_FALTA',
                'documento_id': None,
                'nome_arquivo': None,
                'numero_declaracao': '---',
                'volume_negocios': 0.0,
                'iva_liquidado': 0.0,
                'iva_dedutivel': 0.0,
                'iva_a_pagar': 0.0,
                'credito_imposto': 0.0,
            })

    # 2. Localizar Balancete de Fecho (Dezembro ou anual)
    balancete_fecho = DocumentoUpload.objects.filter(
        empresa=empresa,
        ano=ano,
        tipo='BALANCETE',
        mes=12
    ).first()

    if not balancete_fecho:
        # Tenta qualquer balancete do ano como referência
        balancete_fecho = DocumentoUpload.objects.filter(
            empresa=empresa,
            ano=ano,
            tipo='BALANCETE'
        ).order_by('-mes').first()

    dados_balancete = extrair_dados_balancete_fecho(balancete_fecho)

    # 3. Confronto e Divergências
    vol_contab = dados_balancete['volume_negocios_contab']
    diff_volume = vol_contab - total_vol_negocios_iva
    diff_volume_abs = abs(diff_volume)

    iva_liq_contab = dados_balancete['iva_liquidado_3453']
    diff_iva_liq = iva_liq_contab - total_iva_liquidado

    iva_ded_contab = dados_balancete['iva_dedutivel_3452']
    diff_iva_ded = iva_ded_contab - total_iva_dedutivel

    # Parecer fiscal da divergência anual
    divergencias = []
    if diff_volume_abs > Decimal('100.00'):
        if diff_volume > 0:
            divergencias.append({
                'rubrica': 'Volume de Negócios Anual (Vendas / Serviços)',
                'contabilidade': float(vol_contab),
                'agt_iva': float(total_vol_negocios_iva),
                'diferenca': float(diff_volume),
                'tipo_risco': 'ALTO_RISCO',
                'descricao': (
                    f"O volume de negócios na Contabilidade ({vol_contab:,.2f} Kz) é superior à soma dos 12 Modelos 7 ({total_vol_negocios_iva:,.2f} Kz). "
                    f"Diferença de {diff_volume:,.2f} Kz indicia possível omissão de vendas declaradas à AGT, sujeita a liquidação corretiva e coima (art. 76.º CIVA)."
                ),
            })
        else:
            divergencias.append({
                'rubrica': 'Volume de Negócios Anual (Vendas / Serviços)',
                'contabilidade': float(vol_contab),
                'agt_iva': float(total_vol_negocios_iva),
                'diferenca': float(diff_volume),
                'tipo_risco': 'DIVERGENCIA',
                'descricao': (
                    f"O volume de negócios declarado no IVA ({total_vol_negocios_iva:,.2f} Kz) é superior ao registo contabilístico ({vol_contab:,.2f} Kz). "
                    f"Diferença de {diff_volume_abs:,.2f} Kz indicia faturas não lançadas na contabilidade ou cancelamentos não comunicados."
                ),
            })
    else:
        divergencias.append({
            'rubrica': 'Volume de Negócios Anual (Vendas / Serviços)',
            'contabilidade': float(vol_contab),
            'agt_iva': float(total_vol_negocios_iva),
            'diferenca': 0.0,
            'tipo_risco': 'CONFORME',
            'descricao': "Conformidade integral: O Volume de Negócios da Contabilidade coincide rigorosamente com os 12 meses declarados na AGT.",
        })

    # Estimativa de Imposto Industrial (Modelo 1 - Quadro 05)
    taxa_ii = Decimal('0.25')  # Taxa geral 25% (Lei 19/14)
    estimativa_ii = (vol_contab - dados_balancete['custos_operacionais_7']) * taxa_ii
    if estimativa_ii < 0:
        estimativa_ii = Decimal('0.00')

    meses_em_falta = [m for m in range(1, 13) if m not in meses_presentes]

    return {
        'empresa': {
            'id': empresa.id,
            'nome': empresa.nome,
            'nif': empresa.nif,
            'regime_iva': empresa.regime_iva,
        },
        'ano': ano,
        'meses_declarados_count': len(meses_presentes),
        'meses_em_falta': meses_em_falta,
        'totais_iva': {
            'volume_negocios': float(total_vol_negocios_iva),
            'iva_liquidado': float(total_iva_liquidado),
            'iva_dedutivel': float(total_iva_dedutivel),
            'iva_a_pagar': float(total_iva_pagar),
            'credito_imposto': float(total_credito),
        },
        'balancete_fecho': {
            'disponivel': dados_balancete['disponivel'],
            'nome_arquivo': dados_balancete['nome_arquivo'],
            'volume_negocios_contab': float(dados_balancete['volume_negocios_contab']),
            'vendas_61': float(dados_balancete['vendas_61']),
            'servicos_62': float(dados_balancete['servicos_62']),
            'custos_operacionais_7': float(dados_balancete['custos_operacionais_7']),
            'iva_liquidado_3453': float(dados_balancete['iva_liquidado_3453']),
            'iva_dedutivel_3452': float(dados_balancete['iva_dedutivel_3452']),
        },
        'confronto_anual': {
            'diff_volume_negocios': float(diff_volume),
            'status_volume': 'IGUAIS' if diff_volume_abs <= Decimal('100.00') else 'DIFERENÇA',
            'estimativa_imposto_industrial': float(estimativa_ii),
            'taxa_imposto_industrial': '25%',
            'prazo_modelo1': f"31/05/{ano + 1}",
        },
        'divergencias': divergencias,
        'mapa_mensal': mapa_mensal,
    }


def gerar_excel_consolidacao_anual(dados):
    """Gera livro Excel (.xlsx) institucional com a Consolidação Anual dos 12 Meses."""
    if not OPENPYXL_AVAILABLE:
        raise RuntimeError("openpyxl não está instalado.")

    wb = openpyxl.Workbook()

    # Estilos
    cor_azul = '1A3353'
    cor_cinza_topo = 'F4F6F9'
    fonte_titulo = Font(name='Calibri', size=14, bold=True, color='FFFFFF')
    fonte_sub = Font(name='Calibri', size=10, italic=True, color='E0E0E0')
    fonte_header = Font(name='Calibri', size=10.5, bold=True, color='FFFFFF')
    fonte_bold = Font(name='Calibri', size=10, bold=True)
    fonte_normal = Font(name='Calibri', size=10)
    fonte_kpi_num = Font(name='Calibri', size=13, bold=True, color='1A3353')

    fill_topo = PatternFill('solid', fgColor=cor_azul)
    fill_header = PatternFill('solid', fgColor='2C496F')
    fill_zebrado = PatternFill('solid', fgColor='F9FAFB')
    fill_verde = PatternFill('solid', fgColor='E6F7EF')
    fill_vermelho = PatternFill('solid', fgColor='FFF1F0')

    borda_fina = Border(
        left=Side(style='thin', color='D0D5DD'),
        right=Side(style='thin', color='D0D5DD'),
        top=Side(style='thin', color='D0D5DD'),
        bottom=Side(style='thin', color='D0D5DD')
    )

    # ABA 1: CONSOLIDAÇÃO ANUAL
    ws1 = wb.active
    ws1.title = "Consolidação Anual 12 Meses"
    ws1.views.sheetView[0].showGridLines = True

    # Banner
    ws1.merge_cells('A1:G1')
    c1 = ws1['A1']
    c1.value = "RELATÓRIO DE CONSOLIDAÇÃO ANUAL & RECONCILIAÇÃO FISCAL (12 MESES)"
    c1.font = fonte_titulo
    c1.fill = fill_topo
    c1.alignment = Alignment(horizontal='center', vertical='center')
    ws1.row_dimensions[1].height = 32

    ws1.merge_cells('A2:G2')
    c2 = ws1['A2']
    c2.value = f"Exercício Fiscal: {dados['ano']} | Contribuinte: {dados['empresa']['nome']} | NIF: {dados['empresa']['nif']}"
    c2.font = fonte_sub
    c2.fill = fill_topo
    c2.alignment = Alignment(horizontal='center', vertical='center')
    ws1.row_dimensions[2].height = 20

    # Metadados
    ws1['A4'] = "Empresa:"
    ws1['A4'].font = fonte_bold
    ws1['B4'] = dados['empresa']['nome']
    ws1['D4'] = "NIF:"
    ws1['D4'].font = fonte_bold
    ws1['E4'] = dados['empresa']['nif']

    ws1['A5'] = "Regime IVA:"
    ws1['A5'].font = fonte_bold
    ws1['B5'] = dados['empresa']['regime_iva']
    ws1['D5'] = "Meses Declarados:"
    ws1['D5'].font = fonte_bold
    ws1['E5'] = f"{dados['meses_declarados_count']} de 12 meses"

    # Tabela de Confronto Anual
    ws1['A7'] = "QUADRO COMPARATIVO: CONTABILIDADE (BALANCETE) VS AGT (SOMA 12 MODELOS 7)"
    ws1['A7'].font = Font(name='Calibri', size=11, bold=True, color='1A3353')

    headers_confronto = ["Rubrica Fiscal", "Contabilidade (Fecho PGC)", "AGT (Acumulado 12 Meses IVA)", "Diferença Apurada", "Status de Conformidade"]
    for col_idx, h in enumerate(headers_confronto, 1):
        cell = ws1.cell(row=8, column=col_idx, value=h)
        cell.font = fonte_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal='center', vertical='center')
    ws1.row_dimensions[8].height = 24

    # Linhas de confronto
    tot = dados['totais_iva']
    bal = dados['balancete_fecho']
    conf = dados['confronto_anual']

    dados_linhas = [
        ("Volume de Negócios Anual (Vendas/Serviços)", bal['volume_negocios_contab'], tot['volume_negocios'], conf['diff_volume_negocios'], conf['status_volume']),
        ("IVA Liquidado no Exercício", bal['iva_liquidado_3453'], tot['iva_liquidado'], bal['iva_liquidado_3453'] - tot['iva_liquidado'], "IGUAIS" if abs(bal['iva_liquidado_3453'] - tot['iva_liquidado']) < 1 else "DIFERENÇA"),
        ("IVA Dedutível no Exercício", bal['iva_dedutivel_3452'], tot['iva_dedutivel'], bal['iva_dedutivel_3452'] - tot['iva_dedutivel'], "IGUAIS" if abs(bal['iva_dedutivel_3452'] - tot['iva_dedutivel']) < 1 else "DIFERENÇA"),
    ]

    for idx, (rub, c_val, a_val, d_val, st) in enumerate(dados_linhas, 9):
        ws1.cell(row=idx, column=1, value=rub).font = fonte_bold
        c_cell = ws1.cell(row=idx, column=2, value=c_val)
        c_cell.number_format = '#,##0.00 "Kz"'
        a_cell = ws1.cell(row=idx, column=3, value=a_val)
        a_cell.number_format = '#,##0.00 "Kz"'
        d_cell = ws1.cell(row=idx, column=4, value=d_val)
        d_cell.number_format = '#,##0.00 "Kz"'
        
        st_cell = ws1.cell(row=idx, column=5, value=st)
        st_cell.alignment = Alignment(horizontal='center')
        if st == 'IGUAIS':
            st_cell.fill = fill_verde
            st_cell.font = Font(name='Calibri', size=10, bold=True, color='008000')
        else:
            st_cell.fill = fill_vermelho
            st_cell.font = Font(name='Calibri', size=10, bold=True, color='CC0000')

        for c_idx in range(1, 6):
            ws1.cell(row=idx, column=c_idx).border = borda_fina
        ws1.row_dimensions[idx].height = 20

    # Estimativa Modelo 1 Imposto Industrial
    ws1['A14'] = "PREPARAÇÃO DA DECLARAÇÃO MODELO 1 DO IMPOSTO INDUSTRIAL"
    ws1['A14'].font = Font(name='Calibri', size=11, bold=True, color='1A3353')

    ws1['A15'] = "Volume de Negócios Quadro 05:"
    ws1['B15'] = bal['volume_negocios_contab']
    ws1['B15'].number_format = '#,##0.00 "Kz"'

    ws1['A16'] = "Custos Operacionais FSE / Pessoal (Classe 7):"
    ws1['B16'] = bal['custos_operacionais_7']
    ws1['B16'].number_format = '#,##0.00 "Kz"'

    ws1['A17'] = "Estimativa Imposto Industrial (25%):"
    ws1['B17'] = conf['estimativa_imposto_industrial']
    ws1['B17'].number_format = '#,##0.00 "Kz"'
    ws1['B17'].font = fonte_bold

    ws1['A18'] = "Prazo Legal de Entrega Modelo 1:"
    ws1['B18'] = conf['prazo_modelo1']
    ws1['B18'].font = fonte_bold

    # ABA 2: MAPA MENSAL 12 MESES
    ws2 = wb.create_sheet(title="Mapa Mensal 12 Meses IVA")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells('A1:G1')
    ws2['A1'] = f"MAPA MENSAL DE LIQUIDAÇÃO E DEDUÇÃO DE IVA — EXERCÍCIO {dados['ano']}"
    ws2['A1'].font = fonte_titulo
    ws2['A1'].fill = fill_topo
    ws2['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws2.row_dimensions[1].height = 28

    headers_m = ["Mês", "Nº Declaração", "Volume de Negócios (Kz)", "IVA Liquidado (Kz)", "IVA Dedutível (Kz)", "IVA a Pagar (Kz)", "Crédito Fiscal (Kz)"]
    for col_idx, h in enumerate(headers_m, 1):
        cell = ws2.cell(row=3, column=col_idx, value=h)
        cell.font = fonte_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal='center', vertical='center')
    ws2.row_dimensions[3].height = 22

    for r_idx, m_item in enumerate(dados['mapa_mensal'], 4):
        ws2.cell(row=r_idx, column=1, value=m_item['mes_nome']).font = fonte_bold
        ws2.cell(row=r_idx, column=2, value=m_item['numero_declaracao']).alignment = Alignment(horizontal='center')
        
        c3 = ws2.cell(row=r_idx, column=3, value=m_item['volume_negocios'])
        c3.number_format = '#,##0.00'
        c4 = ws2.cell(row=r_idx, column=4, value=m_item['iva_liquidado'])
        c4.number_format = '#,##0.00'
        c5 = ws2.cell(row=r_idx, column=5, value=m_item['iva_dedutivel'])
        c5.number_format = '#,##0.00'
        c6 = ws2.cell(row=r_idx, column=6, value=m_item['iva_a_pagar'])
        c6.number_format = '#,##0.00'
        c7 = ws2.cell(row=r_idx, column=7, value=m_item['credito_imposto'])
        c7.number_format = '#,##0.00'

        for c_idx in range(1, 8):
            ws2.cell(row=r_idx, column=c_idx).border = borda_fina
        ws2.row_dimensions[r_idx].height = 18

    # Linha Total Acumulado
    tot_row = 16
    ws2.cell(row=tot_row, column=1, value="TOTAL ACUMULADO").font = Font(name='Calibri', size=10.5, bold=True, color='1A3353')
    ws2.cell(row=tot_row, column=2, value="12 Meses").alignment = Alignment(horizontal='center')
    
    for c_i, key in [(3, 'volume_negocios'), (4, 'iva_liquidado'), (5, 'iva_dedutivel'), (6, 'iva_a_pagar'), (7, 'credito_imposto')]:
        tc = ws2.cell(row=tot_row, column=c_i, value=tot[key])
        tc.number_format = '#,##0.00'
        tc.font = fonte_bold

    for c_idx in range(1, 8):
        cell = ws2.cell(row=tot_row, column=c_idx)
        cell.border = borda_fina
        cell.fill = fill_zebrado
    ws2.row_dimensions[tot_row].height = 22

    # Ajuste automático de largura de colunas
    for sheet in [ws1, ws2]:
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or '')
                if '\n' in val_str:
                    val_str = max(val_str.split('\n'), key=len)
                if len(val_str) > max_len:
                    max_len = len(val_str)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
