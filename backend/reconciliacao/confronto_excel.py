"""
Geração de Relatório Oficial de Reconciliação / Confronto em Excel (.xlsx).
Confronta Balancete de Verificação (PGC Decreto 82/01) com a Declaração Modelo 7 da AGT.
"""
import io
import re
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def gerar_excel_confronto(texto_analise, empresa_nome="Empresa", nif="---", periodo="---", doc_contab="Balancete", doc_agt="Modelo 7"):
    """
    Constrói um livro Excel (.xlsx) profissionalmente estilizado
    contendo o relatório completo de auditoria e confronto fiscal.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Confronto Fiscal"
    ws.views.sheetView[0].showGridLines = True

    # Paleta de Cores Institucionais
    navy_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    blue_header_fill = PatternFill(start_color="2B50ED", end_color="2B50ED", fill_type="solid")
    card_bg_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    green_soft = PatternFill(start_color="E6F7EF", end_color="E6F7EF", fill_type="solid")
    red_soft = PatternFill(start_color="FFF1F0", end_color="FFF1F0", fill_type="solid")
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

    # Fontes
    title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    subtitle_font = Font(name="Calibri", size=10, bold=False, color="E2E8F0")
    header_font = Font(name="Calibri", size=10.5, bold=True, color="FFFFFF")
    section_font = Font(name="Calibri", size=11, bold=True, color="1A365D")
    meta_label_font = Font(name="Calibri", size=9.5, bold=True, color="475569")
    meta_val_font = Font(name="Calibri", size=10, bold=False, color="1E293B")
    green_font = Font(name="Calibri", size=10, bold=True, color="00A854")
    red_font = Font(name="Calibri", size=10, bold=True, color="F5222D")
    bold_cell_font = Font(name="Calibri", size=10, bold=True, color="1E293B")
    regular_font = Font(name="Calibri", size=10, color="334155")
    small_italic = Font(name="Calibri", size=9, italic=True, color="64748B")

    # Bordas
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    bottom_heavy = Border(bottom=Side(style='medium', color='1A365D'))

    # 1. BANNERS DE TÍTULO
    ws.merge_cells('A1:E1')
    ws['A1'] = "SISTEMA DE CONFRONTO E RECONCILIAÇÃO CONTABILÍSTICA E FISCAL - ANGOLA"
    ws['A1'].font = title_font
    ws['A1'].fill = navy_fill
    ws['A1'].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells('A2:E2')
    ws['A2'] = "Relatório Oficial de Auditoria: Balancete de Verificação (PGC Dec. 82/01) vs Declaração Modelo 7 da AGT (CIVA)"
    ws['A2'].font = subtitle_font
    ws['A2'].fill = navy_fill
    ws['A2'].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 18

    # 2. BLOCO DE METADADOS
    ws.row_dimensions[3].height = 10  # espaço

    meta_rows = [
        ("Empresa / Entidade:", str(empresa_nome), "Período Fiscal:", str(periodo)),
        ("N.I.F.:", str(nif), "Data da Auditoria:", datetime.now().strftime("%d/%m/%Y %H:%M")),
        ("Balancete (PGC):", str(doc_contab), "Declaração AGT:", str(doc_agt)),
    ]

    curr_row = 4
    for label1, val1, label2, val2 in meta_rows:
        ws.row_dimensions[curr_row].height = 20
        # Coluna A-B
        ws.cell(row=curr_row, column=1, value=label1).font = meta_label_font
        ws.cell(row=curr_row, column=1).alignment = Alignment(vertical="center")
        ws.cell(row=curr_row, column=2, value=val1).font = meta_val_font
        ws.cell(row=curr_row, column=2).alignment = Alignment(vertical="center")
        # Coluna D-E
        ws.cell(row=curr_row, column=4, value=label2).font = meta_label_font
        ws.cell(row=curr_row, column=4).alignment = Alignment(vertical="center")
        ws.cell(row=curr_row, column=5, value=val2).font = meta_val_font
        ws.cell(row=curr_row, column=5).alignment = Alignment(vertical="center")
        curr_row += 1

    # 3. PARSING DO TEXTO DE ANÁLISE
    texto = texto_analise or ""
    
    # Extrair contagens
    total_match = re.search(r'Total de pontos analisados[^:]*:\s*(?:\*\*)?(\d+)', texto, re.I)
    iguais_match = re.search(r'Dados IGUAIS[^:]*:\s*(?:\*\*)?(\d+)', texto, re.I)
    difs_match = re.search(r'Dados com DIFER[EÊeê]NCIAS[^:]*:\s*(?:\*\*)?(\d+)', texto, re.I)

    # Extrair linhas da tabela Markdown
    linhas_tabela = []
    linhas_brutas = [l.strip() for l in texto.split('\n') if '|' in l and '---' not in l and not re.search(r'Nome do Campo|Ponto confrontado', l, re.I)]
    for l in linhas_brutas:
        partes = [p.strip().replace('**', '') for p in l.split('|') if p.strip()]
        if len(partes) >= 4:
            campo = partes[0]
            val_contab = partes[1]
            val_agt = partes[2]
            status_raw = partes[3] if len(partes) > 3 else "INFO"
            dif = partes[4] if len(partes) > 4 else "0,00 Kz"
            
            is_ok = any(ok_word in status_raw.upper() for ok_word in ('IGUAIS', 'OK', 'CONFORME'))
            status_final = "IGUAIS" if is_ok else "DIFERENÇA"
            linhas_tabela.append((campo, val_contab, val_agt, status_final, dif))

    tot_pontos = int(total_match.group(1)) if total_match else len(linhas_tabela)
    tot_iguais = int(iguais_match.group(1)) if iguais_match else sum(1 for _, _, _, s, _ in linhas_tabela if s == "IGUAIS")
    tot_difs = int(difs_match.group(1)) if difs_match else sum(1 for _, _, _, s, _ in linhas_tabela if s == "DIFERENÇA")

    # 4. CARTÕES DE RESUMO / KPIS
    curr_row += 1
    ws.row_dimensions[curr_row].height = 8

    curr_row += 1
    ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
    ws.cell(row=curr_row, column=1, value="1. RESUMO EXECUTIVO DO CONFRONTO").font = section_font
    curr_row += 1

    kpis = [
        (1, "Total Rubricas Analisadas", str(tot_pontos)),
        (2, "Pontos em Conformidade (Iguais)", str(tot_iguais)),
        (3, "Divergências Detetadas", str(tot_difs)),
        (4, "Status Fiscal Geral", "CONFORME" if tot_difs == 0 else "ATENÇÃO REQUERIDA"),
    ]
    
    # Linha dos títulos de KPI
    ws.row_dimensions[curr_row].height = 22
    for col_idx, kpi_name, _ in kpis:
        c = ws.cell(row=curr_row, column=col_idx, value=kpi_name)
        c.font = Font(name="Calibri", size=9, bold=True, color="475569")
        c.fill = card_bg_fill
        c.border = thin_border
        c.alignment = Alignment(horizontal="center", vertical="center")
    curr_row += 1

    # Linha dos valores de KPI
    ws.row_dimensions[curr_row].height = 24
    for col_idx, _, kpi_val in kpis:
        c = ws.cell(row=curr_row, column=col_idx, value=kpi_val)
        if col_idx == 2:
            c.font = Font(name="Calibri", size=13, bold=True, color="00A854")
        elif col_idx == 3:
            c.font = Font(name="Calibri", size=13, bold=True, color="F5222D" if tot_difs > 0 else "00A854")
        elif col_idx == 4:
            c.font = Font(name="Calibri", size=11, bold=True, color="F5222D" if tot_difs > 0 else "00A854")
        else:
            c.font = Font(name="Calibri", size=13, bold=True, color="1E293B")
        c.fill = card_bg_fill
        c.border = thin_border
        c.alignment = Alignment(horizontal="center", vertical="center")
    curr_row += 1

    # 5. QUADRO DE APURAMENTO DO IVA (CIVA - LEI N.º 7/19)
    item_liq = next((item for item in linhas_tabela if "liquidado" in item[0].lower()), None)
    item_ded = next((item for item in linhas_tabela if "dedut" in item[0].lower() or "suportado" in item[0].lower()), None)
    item_pag = next((item for item in linhas_tabela if "pagar" in item[0].lower() or "apurado" in item[0].lower()), None)

    if item_liq or item_ded or item_pag:
        curr_row += 1
        ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
        ws.cell(row=curr_row, column=1, value="2. APURAMENTO LEGAL DO IVA (CIVA — LEI N.º 7/19: LIQUIDADO − DEDUTÍVEL = A PAGAR)").font = section_font
        curr_row += 1

        apuramento_headers = ["Elemento do Apuramento", "Contabilidade (Balancete)", "Declaração AGT (Modelo 7)", "Conformidade", "Diferença"]
        ws.row_dimensions[curr_row].height = 22
        for idx, h in enumerate(apuramento_headers, 1):
            cell = ws.cell(row=curr_row, column=idx, value=h)
            cell.font = Font(name="Calibri", size=9.5, bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1A3353", end_color="1A3353", fill_type="solid")
            cell.alignment = Alignment(horizontal="center" if idx in (4, 5) else "left", vertical="center")
            cell.border = thin_border
        curr_row += 1

        itens_apuramento = [
            ("(+) IVA Liquidado (Vendas / Prestações de Serviços)", item_liq[1] if item_liq else "—", item_liq[2] if item_liq else "—", item_liq[3] if item_liq else "IGUAIS", item_liq[4] if item_liq else "0,00 Kz"),
            ("(−) IVA Dedutível (Aquisições / Compras de Mercadorias)", item_ded[1] if item_ded else "—", item_ded[2] if item_ded else "—", item_ded[3] if item_ded else "IGUAIS", item_ded[4] if item_ded else "0,00 Kz"),
            ("(=) IVA a Pagar ao Estado (Apuramento Final: Liquidado − Dedutível)", item_pag[1] if item_pag else "—", item_pag[2] if item_pag else "—", item_pag[3] if item_pag else "IGUAIS", item_pag[4] if item_pag else "0,00 Kz"),
        ]

        for desc, vc, va, st, df in itens_apuramento:
            ws.row_dimensions[curr_row].height = 22
            c1 = ws.cell(row=curr_row, column=1, value=desc)
            c1.font = Font(name="Calibri", size=10, bold=True, color="1E293B")
            c1.border = thin_border
            c1.alignment = Alignment(vertical="center")

            c2 = ws.cell(row=curr_row, column=2, value=vc)
            c2.font = Font(name="Calibri", size=10, bold=True)
            c2.border = thin_border
            c2.alignment = Alignment(vertical="center")

            c3 = ws.cell(row=curr_row, column=3, value=va)
            c3.font = Font(name="Calibri", size=10, bold=True)
            c3.border = thin_border
            c3.alignment = Alignment(vertical="center")

            c4 = ws.cell(row=curr_row, column=4, value=st)
            c4.font = green_font if st == "IGUAIS" else red_font
            c4.fill = green_soft if st == "IGUAIS" else red_soft
            c4.border = thin_border
            c4.alignment = Alignment(horizontal="center", vertical="center")

            c5 = ws.cell(row=curr_row, column=5, value=df)
            c5.font = green_font if st == "IGUAIS" else red_font
            c5.border = thin_border
            c5.alignment = Alignment(horizontal="right", vertical="center")
            curr_row += 1

    # 6. TABELA DE DETALHE DE CONFRONTO
    curr_row += 1
    ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
    ws.cell(row=curr_row, column=1, value="3. DETALHE DOS DADOS CONFRONTADOS (BALANCETE PGC vs PORTAL AGT)").font = section_font
    curr_row += 1

    headers = [
        "Rubrica / Ponto Confrontado",
        "Contabilidade (Balancete PGC)",
        "Declaração AGT (Modelo 7)",
        "Status de Conformidade",
        "Diferença Apurada"
    ]
    ws.row_dimensions[curr_row].height = 24
    for idx, h in enumerate(headers, 1):
        cell = ws.cell(row=curr_row, column=idx, value=h)
        cell.font = header_font
        cell.fill = blue_header_fill
        cell.alignment = Alignment(horizontal="center" if idx in (4, 5) else "left", vertical="center")
        cell.border = thin_border
    curr_row += 1

    # Dados da tabela
    for row_idx, (campo, val_c, val_a, status, dif) in enumerate(linhas_tabela):
        ws.row_dimensions[curr_row].height = 22
        is_even = (row_idx % 2 == 1)
        row_fill = zebra_fill if is_even else None

        c1 = ws.cell(row=curr_row, column=1, value=campo)
        c1.font = bold_cell_font
        c1.border = thin_border
        c1.alignment = Alignment(vertical="center")
        if row_fill: c1.fill = row_fill

        c2 = ws.cell(row=curr_row, column=2, value=val_c)
        c2.font = regular_font
        c2.border = thin_border
        c2.alignment = Alignment(vertical="center")
        if row_fill: c2.fill = row_fill

        c3 = ws.cell(row=curr_row, column=3, value=val_a)
        c3.font = regular_font
        c3.border = thin_border
        c3.alignment = Alignment(vertical="center")
        if row_fill: c3.fill = row_fill

        c4 = ws.cell(row=curr_row, column=4, value=status)
        c4.border = thin_border
        c4.alignment = Alignment(horizontal="center", vertical="center")
        if status == "IGUAIS":
            c4.font = green_font
            c4.fill = green_soft
        else:
            c4.font = red_font
            c4.fill = red_soft

        c5 = ws.cell(row=curr_row, column=5, value=dif)
        c5.border = thin_border
        c5.alignment = Alignment(horizontal="right", vertical="center")
        if status == "IGUAIS":
            c5.font = green_font
        else:
            c5.font = red_font
        if row_fill and status != "DIFERENÇA": c5.fill = row_fill
        
        curr_row += 1

    # 6. ANÁLISE TÉCNICA DAS DIFERENÇAS E RISCOS FISCAIS
    analise_sec_match = re.search(r'3\.\s*ANALISE DAS DIFERENCAS DETETADAS[\s\S]*?(?=4\.|$)', texto, re.I)
    if analise_sec_match:
        sec_texto = analise_sec_match.group(0)
        curr_row += 1
        ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
        ws.cell(row=curr_row, column=1, value="3. ANÁLISE TÉCNICA DAS DIVERGÊNCIAS & RISCOS FISCAIS").font = section_font
        curr_row += 1

        linhas_analise = [
            l.strip()
            for l in sec_texto.split('\n')
            if l.strip()
            and not l.startswith('===')
            and not l.startswith('3.')
            and not re.match(r'^[*=\-_~#: \t|/\\`]+$', l.strip())
            and not ('|' in l and ('Balancete' in l or 'Modelo 7' in l or 'Campo' in l))
            and len(l.strip()) > 2
        ]
        for l in linhas_analise:
            ws.row_dimensions[curr_row].height = 20
            clean_l = l.replace('**', '').replace('- ', '• ')
            c = ws.cell(row=curr_row, column=1, value=clean_l)
            if clean_l.startswith('•'):
                c.font = Font(name="Calibri", size=9.5, bold=True, color="1E293B")
            else:
                c.font = regular_font
            ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
            curr_row += 1

    # 7. RECOMENDAÇÕES E PLANO DE AÇÃO
    rec_sec_match = re.search(r'4\.\s*O QUE FAZER PARA RESOLVER[\s\S]*$', texto, re.I)
    if rec_sec_match:
        rec_texto = rec_sec_match.group(0)
        curr_row += 1
        ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
        ws.cell(row=curr_row, column=1, value="4. RECOMENDAÇÕES TÉCNICAS E MEDIDAS CORRETIVAS").font = section_font
        curr_row += 1

        linhas_rec = [
            l.strip()
            for l in rec_texto.split('\n')
            if l.strip()
            and not l.startswith('===')
            and not l.startswith('4.')
            and not re.match(r'^[*=\-_~#: \t|/\\`]+$', l.strip())
            and len(l.strip()) > 2
        ]
        for l in linhas_rec:
            ws.row_dimensions[curr_row].height = 20
            clean_l = l.replace('**', '').replace('- ', '  - ')
            c = ws.cell(row=curr_row, column=1, value=clean_l)
            if re.match(r'^\d+\.', clean_l):
                c.font = Font(name="Calibri", size=9.5, bold=True, color="2B50ED")
            else:
                c.font = regular_font
            ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
            curr_row += 1

    # 8. TERMO DE ENCERRAMENTO E ASSINATURA
    curr_row += 2
    ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=5)
    ws.cell(row=curr_row, column=1, value="Parecer emitido em conformidade com o Plano Geral de Contabilidade (Decreto Presidencial n.º 82/01) e Código do IVA (Lei n.º 7/19).").font = small_italic
    ws.cell(row=curr_row, column=1).alignment = Alignment(horizontal="center")
    
    curr_row += 3
    # Linha para assinatura
    ws.merge_cells(start_row=curr_row, start_column=2, end_row=curr_row, end_column=4)
    ws.cell(row=curr_row, column=2, value="___________________________________________________").alignment = Alignment(horizontal="center")
    curr_row += 1
    ws.merge_cells(start_row=curr_row, start_column=2, end_row=curr_row, end_column=4)
    ws.cell(row=curr_row, column=2, value="Responsável Técnico de Contabilidade e Fiscalidade").font = Font(name="Calibri", size=9.5, bold=True)
    ws.cell(row=curr_row, column=2).alignment = Alignment(horizontal="center")

    # AJUSTE DE LARGURAS DAS COLUNAS
    larguras = {1: 44, 2: 30, 3: 30, 4: 24, 5: 24}
    for col_idx, w in larguras.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = w

    # Salvar em buffer de memória
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
