"""Serviço de Extração Inteligente de Metadados e Auto-Cadastro de Empresas.

Ao carregar um documento (Balancete, Modelo 7 AGT, Dossiê Fiscal, etc.),
este serviço inspeciona o texto do documento para:
1. Extrair NIF, Denominação Social / Razão Social, Regime de IVA, Repartição Fiscal,
   Província, Município e Período Contabilístico.
2. Identificar se a empresa já existe na base de dados.
3. Se não existir, realizar o pré-cadastro automático inteligente da nova empresa,
   associando o documento diretamente e permitindo que o utilizador finalize os
   dados complementares mais tarde.
"""
import re
import unicodedata
import logging
from .models import Empresa, EmpresaUtilizador
from . import agt_modelo7
from . import balancete

logger = logging.getLogger('reconciliacao')

MAPEAMENTO_REPARTICOES_PROVINCIAS = {
    'CATETE': ('Ícolo e Bengo', 'Catete (Ícolo e Bengo)'),
    'ICOLO E BENGO': ('Ícolo e Bengo', 'Catete (Ícolo e Bengo)'),
    'VIANA': ('Luanda', 'Viana'),
    'TALATONA': ('Luanda', 'Talatona'),
    'BELAS': ('Luanda', 'Belas'),
    'CAZENGA': ('Luanda', 'Cazenga'),
    'CACUACO': ('Luanda', 'Cacuaco'),
    'KILAMBA KIAXI': ('Luanda', 'Kilamba Kiaxi'),
    'MAIANGA': ('Luanda', 'Maianga'),
    'INGOMBITA': ('Luanda', 'Luanda'),
    'INGOMBOTAS': ('Luanda', 'Luanda'),
    'RANGEL': ('Luanda', 'Luanda'),
    'SAMBIZANGA': ('Luanda', 'Luanda'),
    'LUANDA': ('Luanda', 'Luanda'),
    'GRANDES CONTRIBUINTES': ('Luanda', 'Luanda'),
    'BENGUELA': ('Benguela', 'Benguela'),
    'LOBITO': ('Benguela', 'Lobito'),
    'BAIA FARTA': ('Benguela', 'Baía Farta'),
    'CATUMBELA': ('Benguela', 'Catumbela'),
    'HUAMBO': ('Huambo', 'Huambo'),
    'BAILUNDO': ('Huambo', 'Bailundo'),
    'CAALA': ('Huambo', 'Caála'),
    'LUBANGO': ('Huíla', 'Lubango'),
    'MATALA': ('Huíla', 'Matala'),
    'CABINDA': ('Cabinda', 'Cabinda'),
    'MALANJE': ('Malanje', 'Malanje'),
    'SOYO': ('Zaire', 'Soyo'),
    'MBANZA KONGO': ('Zaire', 'Mbanza Kongo'),
    'DUNDO': ('Lunda Norte', 'Chitato (Dundo)'),
    'CHITATO': ('Lunda Norte', 'Chitato (Dundo)'),
    'SAURIMO': ('Lunda Sul', 'Saurimo'),
    'LUENA': ('Moxico', 'Moxico (Luena)'),
    'MOXICO': ('Moxico', 'Moxico (Luena)'),
    'ALTO ZAMBEZE': ('Moxico Leste', 'Alto Zambeze (Cazombo)'),
    'CAZOMBO': ('Moxico Leste', 'Alto Zambeze (Cazombo)'),
    'NAMIBE': ('Namibe', 'Moçâmedes (Namibe)'),
    'MOCAMEDES': ('Namibe', 'Moçâmedes (Namibe)'),
    'UIGE': ('Uíge', 'Uíge'),
    'NEGAGE': ('Uíge', 'Negage'),
    'ONDJIVA': ('Cunene', 'Cuanhama (Ondjiva)'),
    'CUANHAMA': ('Cunene', 'Cuanhama (Ondjiva)'),
    'SUMBE': ('Cuanza Sul', 'Sumbe'),
    'PORTO AMBOIM': ('Cuanza Sul', 'Porto Amboim'),
    'GABELA': ('Cuanza Sul', 'Amboim (Gabela)'),
    'NDALATANDO': ('Cuanza Norte', 'Cazengo (Ndalatando)'),
    'CAZENGO': ('Cuanza Norte', 'Cazengo (Ndalatando)'),
    'CUITO': ('Bié', 'Cuito'),
    'CAXITO': ('Bengo', 'Dande (Caxito)'),
    'DANDE': ('Bengo', 'Dande (Caxito)'),
    'MENONGUE': ('Cubango', 'Menongue'),
    'MAVINGA': ('Cuando', 'Mavinga'),
}


def _limpar_texto(txt):
    if not txt:
        return ''
    return ''.join(
        c for c in unicodedata.normalize('NFKD', str(txt))
        if not unicodedata.combining(c)
    ).upper()


def _normalizar_nome_chave(txt):
    if not txt:
        return ''
    limpo = _limpar_texto(txt)
    return re.sub(r'[^A-Z0-9]', '', limpo)


def extrair_dados_empresa_do_texto(texto, nome_arquivo=''):
    """Analisa o texto do documento e extrai os metadados cadastrais da empresa."""
    texto = texto or ''
    texto_limpo = _limpar_texto(texto)
    
    # 1. Extração do NIF (10 dígitos, iniciando em 5 para empresas angolanas)
    nif = agt_modelo7._nif(texto)
    if not nif:
        m_nif = re.search(r'(?<!\d)(5\d{9})(?!\d)', texto)
        if m_nif:
            nif = m_nif.group(1)

    # 2. Extração do Nome / Razão Social
    nome = None
    
    # Tentativa A: Declaração Modelo 7 da AGT (campo oficial NOME/DESIGNAÇÃO)
    m_nome_agt = re.search(r'NOME/DESIGNA[ÇC][ÃA]O:\s*([^\n\r]+)', texto, re.I)
    if m_nome_agt:
        nome_candidato = m_nome_agt.group(1).strip()
        # Remove eventuais etiquetas anexadas
        nome_candidato = re.sub(r'\s+(?:05\s*-|06\s*-|REPARTIÇÃO).*$', '', nome_candidato, flags=re.I).strip()
        if len(nome_candidato) > 2:
            nome = nome_candidato

    # Tentativa B: Balancete de Verificação (Cabeçalho nas primeiras linhas)
    if not nome:
        linhas = [l.strip() for l in texto.split('\n') if l.strip()][:15]
        for linha in linhas:
            # Se for linha de título do balancete, para a busca superior
            if re.search(r'balancete\s+geral|balancete\s+de\s+verifica|balancete\s+anal[íi]tico', linha, re.I):
                break
            # Ignora linhas com metadados do software ou paginação
            limpa = re.sub(r'P[áa]g\.?\s*\d+/\d+', '', linha, flags=re.I).strip()
            limpa = re.sub(r'^\s*©.*$', '', limpa).strip()
            
            # Se a linha contiver sufixos empresariais típicos de Angola
            if re.search(r'\b(LDA|LIMITADA|LTD|S\.?A\.?|SU|E\.?P\.?|E\.?I\.?|SARL|HOLDING|GRUPO)\b', limpa, re.I):
                # Limpa sufixos de paginação ou pontuação extra
                limpa = re.sub(r'[\(\[\{]?P[áa]g.*?$', '', limpa, flags=re.I).strip(' -:,')
                if len(limpa) > 3 and not re.search(r'cegid|primavera|software|licen[çc]a', limpa, re.I):
                    nome = limpa
                    break

    # Tentativa C: Padrão explícito Empresa / Firma / Contribuinte
    if not nome:
        m_emp = re.search(r'(?:Empresa|Denomina[çc][ãa]o|Raz[ãa]o\s+Social|Firma|Contribuinte|Cliente)[:\s]+([^\n\r,]+)', texto, re.I)
        if m_emp:
            candidato = m_emp.group(1).strip()
            if len(candidato) > 3 and not re.search(r'cegid|primavera|sistema|modelo|agt', candidato, re.I):
                nome = candidato

    # Fallback de nome se só achou NIF
    if not nome and nif:
        # Se o nome do arquivo contiver o nome da empresa
        nome_base = nome_arquivo.rsplit('.', 1)[0] if '.' in nome_arquivo else nome_arquivo
        nome_base = re.sub(r'(?:balancete|modelo7|declaracao|comprovativo|iva|dossie|irt|inss|\d{2,4})', '', nome_base, flags=re.I).strip(' _-')
        if len(nome_base) >= 3:
            nome = nome_base.replace('_', ' ').replace('-', ' ').strip().upper()
        else:
            nome = f"Empresa Contribuinte {nif}"

    # 3. Regime de IVA
    regime_iva = 'GERAL'
    if 'REGIME GERAL' in texto_limpo or 'REGIMEGERAL' in texto_limpo:
        regime_iva = 'GERAL'
    elif 'REGIME SIMPLIFICADO' in texto_limpo or 'REGIMESIMPLIFICADO' in texto_limpo or 'SIMPLIFICADO' in texto_limpo:
        regime_iva = 'SIMPLIFICADO'
    elif 'EXCLUSAO' in texto_limpo or 'EXCLUSÃO' in texto_limpo or 'ISENTO' in texto_limpo:
        regime_iva = 'EXCLUSAO'

    # 4. Repartição Fiscal, Província e Município
    reparticao = None
    m_rep = re.search(r'REPARTI[ÇC][ÃA]O\s+FISCAL\s+(?:DE|DO|DA)?\s*([A-ZÁÂÃÀÉÊÍÓÔÕÚÇ\s]+)', texto, re.I)
    if m_rep:
        rep_candidata = m_rep.group(1).split('\n')[0].strip()
        rep_limpa = _limpar_texto(rep_candidata)
        if 'DOMICILIO' not in rep_limpa:
            reparticao = rep_candidata

    provincia = 'Luanda'
    municipio = 'Luanda'

    if reparticao:
        rep_u = _limpar_texto(reparticao)
        for termo, (prov, mun) in MAPEAMENTO_REPARTICOES_PROVINCIAS.items():
            if termo in rep_u:
                provincia = prov
                municipio = mun
                break
    else:
        # Procura nomes de províncias no texto do cabeçalho
        for termo, (prov, mun) in MAPEAMENTO_REPARTICOES_PROVINCIAS.items():
            if termo in texto_limpo[:1500]:
                provincia = prov
                municipio = mun
                break

    # 5. Contabilista / Técnico de Contas
    contabilista_nome = ''
    m_contab = re.search(r'(?:T[eé]cnico\s+de\s+Contas|Contabilista|O\s+Contabilista)[:\s]+([^\n\r]+)', texto, re.I)
    if m_contab:
        cand = m_contab.group(1).strip()[:100]
        if not re.search(r'declara[çc][ãa]o|verdade|omite|informa[çc][ãa]o|identifica[çc][ãa]o', cand, re.I):
            contabilista_nome = cand

    return {
        'nif': nif,
        'nome': nome[:200] if nome else None,
        'regime_iva': regime_iva,
        'provincia': provincia,
        'municipio': municipio,
        'reparticao_fiscal': reparticao[:100] if reparticao else '',
        'contabilista_nome': contabilista_nome,
        'confianca': 'alta' if (nif and nome) else ('media' if nif else 'baixa'),
    }


def obter_ou_cadastrar_empresa_automatica(dados_extraidos, user=None, auto_criar=True):
    """Localiza a empresa pelo NIF/Nome ou cria automaticamente uma nova empresa.

    Retorna:
        tuple (empresa_obj, foi_criada: bool, mensagem: str)
    """
    nif = dados_extraidos.get('nif')
    nome = dados_extraidos.get('nome')

    # 1. Se não temos NIF mas temos Nome, tenta localizar por nome existente
    if not nif and nome:
        chave_nome = _normalizar_nome_chave(nome)
        for emp in Empresa.objects.all():
            chave_emp = _normalizar_nome_chave(emp.nome)
            if chave_emp and (chave_emp in chave_nome or chave_nome in chave_emp):
                if user and user.is_authenticated and not (user.is_superuser or user.is_staff):
                    EmpresaUtilizador.objects.get_or_create(
                        empresa=emp,
                        utilizador=user,
                        defaults={'perfil_acesso': 'ADMIN', 'ativo': True}
                    )
                return emp, False, f"Empresa identificada por denominação: {emp.nome}"

        # Se não existe e auto_criar activo, gera um NIF provisório para pré-cadastrar a empresa
        if auto_criar:
            base_num = abs(hash(nome)) % 10000000
            nif_prov = None
            for offset in range(500):
                cand = f"599{(base_num + offset) % 10000000:07d}"
                if not Empresa.objects.filter(nif=cand).exists():
                    nif_prov = cand
                    break
            if not nif_prov:
                import time
                nif_prov = f"599{int(time.time()) % 10000000:07d}"
            nif = nif_prov
        else:
            return None, False, 'Nenhum NIF identificado no documento.'

    if not nif:
        return None, False, 'Nenhum NIF identificado no documento.'

    # 2. Procura se a empresa já existe na base por NIF
    empresa_existente = Empresa.objects.filter(nif=nif).first()
    if empresa_existente:
        # Se os dados novos tiverem repartição fiscal ou província e a existente estiver vazia, atualiza
        alterou = False
        if dados_extraidos.get('reparticao_fiscal') and not empresa_existente.reparticao_fiscal:
            empresa_existente.reparticao_fiscal = dados_extraidos['reparticao_fiscal']
            alterou = True
        if alterou:
            empresa_existente.save()

        # Assegura que o utilizador tem vínculo se não for superusuário
        if user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            EmpresaUtilizador.objects.get_or_create(
                empresa=empresa_existente,
                utilizador=user,
                defaults={'perfil_acesso': 'ADMIN', 'ativo': True}
            )
        return empresa_existente, False, f"Empresa já cadastrada: {empresa_existente.nome}"

    # 3. Se temos um NIF real oficial (não provisório) e nome, verificar se existe alguma empresa
    # com NIF provisório (iniciando em 599) cujo nome corresponda à mesma empresa!
    if nif and not nif.startswith('599') and nome:
        chave_nome = _normalizar_nome_chave(nome)
        for emp_prov in Empresa.objects.filter(nif__startswith='599'):
            chave_emp = _normalizar_nome_chave(emp_prov.nome)
            if chave_emp and (chave_emp in chave_nome or chave_nome in chave_emp):
                emp_prov.nif = nif
                emp_prov.nome = nome  # Atualiza para o nome oficial com formatação da AGT
                if dados_extraidos.get('reparticao_fiscal'):
                    emp_prov.reparticao_fiscal = dados_extraidos['reparticao_fiscal']
                if dados_extraidos.get('provincia'):
                    emp_prov.provincia = dados_extraidos['provincia']
                if dados_extraidos.get('municipio'):
                    emp_prov.municipio = dados_extraidos['municipio']
                emp_prov.save()
                if user and user.is_authenticated:
                    EmpresaUtilizador.objects.get_or_create(
                        empresa=emp_prov,
                        utilizador=user,
                        defaults={'perfil_acesso': 'ADMIN', 'ativo': True}
                    )
                logger.info(f"NIF provisório de {emp_prov.nome} atualizado para NIF oficial {nif}")
                return emp_prov, False, f"✨ Empresa atualizada com NIF oficial da AGT: {emp_prov.nome} (NIF: {emp_prov.nif})"

    # 4. Se não existir e auto_criar estiver activo, cadastra automaticamente
    if not auto_criar:
        return None, False, f"Nova empresa identificada ({nif} - {nome}), pendente de confirmação."

    nome_final = nome or f"Empresa {nif}"
    regime_iva = dados_extraidos.get('regime_iva') or 'GERAL'
    provincia = dados_extraidos.get('provincia') or 'Luanda'
    municipio = dados_extraidos.get('municipio') or 'Luanda'
    reparticao = dados_extraidos.get('reparticao_fiscal') or ''
    contabilista = dados_extraidos.get('contabilista_nome') or ''

    nova_empresa = Empresa.objects.create(
        nome=nome_final,
        nif=nif,
        regime_iva=regime_iva,
        provincia=provincia,
        municipio=municipio,
        reparticao_fiscal=reparticao,
        contabilista_nome=contabilista,
        estado='ATIVA',
    )

    # Vincula o utilizador que carregou o documento à nova empresa
    if user and user.is_authenticated:
        EmpresaUtilizador.objects.get_or_create(
            empresa=nova_empresa,
            utilizador=user,
            defaults={'perfil_acesso': 'ADMIN', 'ativo': True}
        )

    logger.info(f"Auto-cadastro de empresa realizado com sucesso: {nova_empresa.nome} (NIF: {nova_empresa.nif})")
    msg_tipo = "com NIF provisório (pendente de documento AGT)" if nif.startswith('599') else f"(NIF: {nova_empresa.nif})"
    return nova_empresa, True, f"✨ Nova empresa pré-cadastrada automaticamente: {nova_empresa.nome} {msg_tipo}"
