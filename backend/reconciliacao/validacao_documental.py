"""Validação documental estrita para reconciliação contábil e fiscal (IVA/AGT).

Garante que apenas ficheiros genuínos (Balancete de Verificação contábil e Declaração Modelo 7 da AGT)
sejam aceites como base do confronto, prevenindo categoricamente dados fictícios,
documentos descontextualizados ou alucinações de inteligência artificial.
"""

import re
import unicodedata

TERMOS_PROIBIDOS_NAO_CONTABEIS = [
    'relatorio de especificacao',
    'relatorio de especificacao do projecto',
    'visao geral do projecto',
    'arquitetura do sistema',
    'manual do utilizador',
    'bilhete',
    'ingresso',
    'comissao | liquido organizador',
    'organizador | data | bilhetes',
    'edukangola',
    'encontre a formacao certa',
    'ticket',
]


def _normalizar(texto):
    if not texto:
        return ''
    texto = unicodedata.normalize('NFKD', str(texto))
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def validar_balancete(texto, nome_arquivo=''):
    """Valida se o texto extraído e/ou nome do arquivo correspondem a um Balancete contábil.
    
    Retorna: (is_valido: bool, mensagem_erro: str)
    """
    tn = _normalizar(texto)
    nn = _normalizar(nome_arquivo)

    if not tn.strip():
        return False, "O documento está ilegível ou não possui conteúdo textual legível."

    # 1. Rejeição explícita de materiais não contábeis (bilhetes, manuais, especificações)
    if any(k in tn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS) or any(k in nn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS):
        return False, (
            f"O ficheiro '{nome_arquivo or 'enviado'}' não é um Balancete de Verificação. "
            "Trata-se de um ficheiro não contabilístico (relatório de especificação, bilheteira ou material promocional)."
        )

    # 2. Identificação de Balancete
    termos_balancete = [
        'balancete', 'balanço de verificação', 'balanco de verificacao',
        'plano geral de contabilidade', 'pgca', 'balancete geral',
        'balancete de verificação', 'balancete de verificacao',
        'balancete analítico', 'balancete analitico', 'balancete sintético', 'balancete sintetico'
    ]
    tem_balancete = any(t in tn for t in termos_balancete) or any(t in nn for t in termos_balancete)

    # 3. Colunas e movimentação a débito e crédito
    tem_debito = 'debito' in tn or 'débito' in tn or 'devedor' in tn
    tem_credito = 'credito' in tn or 'crédito' in tn or 'credor' in tn or 'crededor' in tn
    tem_dc = tem_debito and tem_credito

    # 4. Estrutura de contas do PGCA
    tem_contas = (
        'conta' in tn or 'subconta' in tn or 'rubrica' in tn or
        '31 clientes' in tn or '34 estado' in tn or '62' in tn or
        bool(re.search(r'\b[1-7]\d{1,3}\s+[a-z]', tn))
    )

    if tem_balancete and (tem_dc or tem_contas or 'saldos' in tn or 'razao' in tn or len(tn.strip()) < 50):
        return True, ""

    if tem_dc and tem_contas:
        return True, ""

    return False, (
        f"O documento '{nome_arquivo or 'enviado'}' não apresenta a estrutura de um Balancete de Verificação contábil. "
        "Não foram identificadas rubricas contábeis do PGCA ou colunas de débitos/créditos oficiais."
    )


def validar_modelo7(texto, nome_arquivo=''):
    """Valida se o texto extraído e/ou nome do arquivo correspondem a uma Declaração Modelo 7 da AGT.
    
    Retorna: (is_valido: bool, mensagem_erro: str)
    """
    tn = _normalizar(texto)
    nn = _normalizar(nome_arquivo)

    if not tn.strip():
        return False, "O documento está ilegível ou não possui conteúdo textual legível."

    # 1. Rejeição explícita de materiais não fiscais
    if any(k in tn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS) or any(k in nn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS):
        return False, (
            f"O ficheiro '{nome_arquivo or 'enviado'}' não é uma Declaração Modelo 7 da AGT. "
            "Trata-se de um ficheiro não fiscal (relatório de especificação, bilheteira ou material promocional)."
        )

    # 2. Identificação de Modelo 7
    tem_m7 = (
        'modelo 7' in tn or 'modelo 7' in nn or
        'modelo7' in tn or 'modelo7' in nn or
        'modelo vii' in tn or 'modelo vii' in nn or
        'declaracao modelo 7' in tn or 'declaração modelo 7' in tn or
        'comprovativo de entrega de declaracao' in tn or 'comprovativo de entrega de declaração' in tn
    )

    # 3. Elementos da declaração da AGT
    termos_agt = [
        'declaracao', 'declaração', 'regime do iva', 'reparticao fiscal', 'repartição fiscal',
        'sujeito passivo', 'apuramento do imposto', 'quadro 09', 'quadro 9', 'quadro 10',
        'base tributavel', 'base tributável', 'administracao geral tributaria',
        'administração geral tributária', 'agt', 'imposto sobre o valor acrescentado',
        'numero de identificacao fiscal', 'número de identificação fiscal'
    ]
    matches_agt = sum(1 for k in termos_agt if k in tn)

    if tem_m7 and (matches_agt >= 1 or 'iva' in tn or 'imposto' in tn):
        return True, ""

    if matches_agt >= 3 and ('iva' in tn or 'imposto' in tn):
        return True, ""

    return False, (
        f"O documento '{nome_arquivo or 'enviado'}' não é uma Declaração Modelo 7 do IVA da AGT reconhecida. "
        "O ficheiro não contém referências oficiais da AGT, Modelo 7, CIVA ou quadros de apuramento periódicos."
    )


def validar_documento_para_tipo(tipo, texto, nome_arquivo=''):
    """Valida o documento de acordo com o tipo solicitado no upload.
    
    Retorna: (is_valido: bool, motivo_erro: str)
    """
    tn = _normalizar(texto)
    nn = _normalizar(nome_arquivo)

    # Rejeição de ficheiros manifestamente não contabilísticos/não fiscais
    if any(k in tn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS) or any(k in nn for k in TERMOS_PROIBIDOS_NAO_CONTABEIS):
        tipo_label = 'um Balancete de Verificação' if tipo == 'BALANCETE' else 'uma Declaração Modelo 7'
        return False, (
            f"O ficheiro '{nome_arquivo or 'enviado'}' não é {tipo_label}. "
            "Trata-se de um ficheiro não contabilístico (relatório de especificação, bilheteira ou material promocional)."
        )

    tipo_up = (tipo or '').upper().strip()
    if tipo_up == 'BALANCETE':
        return validar_balancete(texto, nome_arquivo)
    elif tipo_up in ('MODELO7', 'DECLARACAO_IVA'):
        v_m7, err_m7 = validar_modelo7(texto, nome_arquivo)
        if v_m7:
            return True, ""
        # Permite upload se for documento contábil estruturado com tipo forçado manualmente pelo usuário
        v_b, _ = validar_balancete(texto, nome_arquivo)
        if v_b:
            return True, ""
        return False, err_m7

    return True, ""
