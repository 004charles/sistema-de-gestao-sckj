import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import AdminLayout from '../components/admin/AdminLayout';
import PgcView from '../components/pgc/PgcView';
import { adminService, empresaService } from '../services/api';
import { usePeriodo } from '../context/PeriodoContext';
import { kzComMoeda } from '../utils/formato';

const PROVINCIAS_ANGOLA = [
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cubango',
  'Cunene',
  'Huambo',
  'Huíla',
  'Ícolo e Bengo',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Moxico Leste',
  'Namibe',
  'Uíge',
  'Zaire'
];

const MUNICIPIOS_POR_PROVINCIA = {
  'Bengo': ['Dande (Caxito)', 'Ambriz', 'Bula Atumba', 'Dembos', 'Nambuangongo', 'Pango Aluquém'],
  'Benguela': ['Benguela', 'Baía Farta', 'Balombo', 'Bocoio', 'Caimbambo', 'Catumbela', 'Chongorói', 'Cubal', 'Ganda', 'Lobito'],
  'Bié': ['Cuito', 'Andulo', 'Camacupa', 'Catabola', 'Chinguar', 'Chitembo', 'Cuemba', 'Cunhinga', 'Nharêa'],
  'Cabinda': ['Cabinda', 'Belize', 'Buco-Zau', 'Cacongo'],
  'Cuando': ['Mavinga', 'Calai', 'Dirico', 'Rivungo'],
  'Cuando Cubango': ['Menongue', 'Cuchi', 'Cuito Cuanavale', 'Cuangar', 'Mavinga', 'Calai', 'Dirico', 'Rivungo', 'Nancova'],
  'Cuanza Norte': ['Cazengo (Ndalatando)', 'Ambaca', 'Banga', 'Bolongongo', 'Cambambe', 'Golungo Alto', 'Gonguembo', 'Lucala', 'Quiculungo', 'Samba Caju'],
  'Cuanza Sul': ['Sumbe', 'Amboim (Gabela)', 'Cassongue', 'Cela (Waku Kungo)', 'Conda', 'Ebo', 'Libolo', 'Mussende', 'Porto Amboim', 'Quibala', 'Quilenda', 'Seles'],
  'Cubango': ['Menongue', 'Cuchi', 'Cuito Cuanavale', 'Cuangar', 'Nancova'],
  'Cunene': ['Cuanhama (Ondjiva)', 'Cahama', 'Curoca', 'Cuvelai', 'Namacunde', 'Ombadja'],
  'Huambo': ['Huambo', 'Bailundo', 'Caála', 'Catchiungo', 'Chicala Cholohanga', 'Chinjenje', 'Ecunha', 'Londuimbali', 'Longonjo', 'Mungo', 'Ucuma'],
  'Huíla': ['Lubango', 'Cacula', 'Caluquembe', 'Chiange (Gambos)', 'Chibia', 'Chicomba', 'Chipindo', 'Cuvango', 'Humpata', 'Jamba', 'Matala', 'Quilengues', 'Quipungo'],
  'Ícolo e Bengo': ['Catete (Ícolo e Bengo)', 'Quiçama (Kissama)', 'Calumbo', 'Cabo Ledo', 'Bom Jesus'],
  'Luanda': ['Luanda', 'Belas', 'Cacuaco', 'Cazenga', 'Kilamba Kiaxi', 'Maianga', 'Rangel', 'Sambizanga', 'Talatona', 'Viana'],
  'Lunda Norte': ['Chitato (Dundo)', 'Cambulo', 'Capenda-Camulemba', 'Caungula', 'Cuango', 'Cuílo', 'Lóvua', 'Lubalo', 'Lucapa', 'Xá-Muteba'],
  'Lunda Sul': ['Saurimo', 'Cacolo', 'Dala', 'Muconda'],
  'Malanje': ['Malanje', 'Cacuso', 'Calandula', 'Cambundi-Catembo', 'Cangandala', 'Caombo', 'Cuaba Nzogo', 'Cunda-dia-Baze', 'Luquembo', 'Marimba', 'Massango', 'Mucari', 'Quela', 'Quirima'],
  'Moxico': ['Moxico (Luena)', 'Camanongue', 'Léua', 'Luacano', 'Luchazes', 'Lumeje'],
  'Moxico Leste': ['Alto Zambeze (Cazombo)', 'Bundas', 'Luau'],
  'Namibe': ['Moçâmedes (Namibe)', 'Bibala', 'Camucuio', 'Tômbwa', 'Virei'],
  'Uíge': ['Uíge', 'Ambuíla', 'Bembe', 'Buengas', 'Bungo', 'Cangola', 'Damba', 'Maquela do Zombo', 'Milunga', 'Mucaba', 'Negage', 'Puri', 'Quimbele', 'Quitexe', 'Sanza Pombo', 'Songo', 'Zombo'],
  'Zaire': ['Mbanza Kongo', 'Cuimba', 'Nóqui', 'Nzeto', 'Soyo', 'Tomboco']
};


const AdminGestao = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { atualizar } = usePeriodo();

  const abaUrl = searchParams.get('aba') || 'pgc';
  const [abaAtiva, setAbaAtiva] = useState(abaUrl);
  const userAtivo = JSON.parse(localStorage.getItem('user') || '{}');

  const mudarAba = (novaAba) => {
    setAbaAtiva(novaAba);
    setSearchParams({ aba: novaAba });
  };

  // Estados principais
  const [estatisticas, setEstatisticas] = useState(null);
  const [utilizadores, setUtilizadores] = useState([]);
  const [regras, setRegras] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [registrosAcesso, setRegistrosAcesso] = useState({ total: 0, total_bloqueados: 0, registros: [] });
  const [carregando, setCarregando] = useState(true);

  // Filtros de empresas
  const [pesquisaEmpresa, setPesquisaEmpresa] = useState('');
  const [filtroRegimeEmpresa, setFiltroRegimeEmpresa] = useState('TODOS');
  const [filtroEstadoEmpresa, setFiltroEstadoEmpresa] = useState('TODOS');

  // Filtros de utilizadores
  const [pesquisaUser, setPesquisaUser] = useState('');
  const [filtroPapelUser, setFiltroPapelUser] = useState('TODOS');

  // Filtros de regras
  const [pesquisaRegra, setPesquisaRegra] = useState('');
  const [filtroMotorRegra, setFiltroMotorRegra] = useState('TODOS');
  const [filtroSeveridadeRegra, setFiltroSeveridadeRegra] = useState('TODOS');

  // Filtros de ocorrências
  const [pesquisaOcorrencia, setPesquisaOcorrencia] = useState('');
  const [filtroSeveridadeOcorrencia, setFiltroSeveridadeOcorrencia] = useState('TODOS');
  const [filtroEstadoOcorrencia, setFiltroEstadoOcorrencia] = useState('TODOS');
  const [filtroEmpresaOcorrencia, setFiltroEmpresaOcorrencia] = useState('TODOS');

  // Filtros de documentos
  const [pesquisaDoc, setPesquisaDoc] = useState('');
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('TODOS');

  // Filtros e Dados do Plano Geral de Contabilidade (PGC)
  const [pgcDados, setPgcDados] = useState({
    classes: [],
    contas: [],
    total: 0,
    total_oficial: 0,
    principios: [],
    criterios_valorimetria: [],
    demonstracoes_financeiras: null,
    notas_anexo: [],
    diploma_legal: null,
  });
  const [filtroClassePgc, setFiltroClassePgc] = useState('TODAS');
  const [pesquisaPgc, setPesquisaPgc] = useState('');
  const [subAbaPgc, setSubAbaPgc] = useState('contas');
  const [contaDetalhe, setContaDetalhe] = useState(null);
  const [tipoDemonstracao, setTipoDemonstracao] = useState('balanco');
  const [baixandoExcelPgc, setBaixandoExcelPgc] = useState(false);

  // Modal de Empresa (Django Admin Empresa)
  const [modalEmpresaAberto, setModalEmpresaAberto] = useState(false);
  const [empresaEmEdicao, setEmpresaEmEdicao] = useState(null);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    nome: '',
    nome_comercial: '',
    nif: '',
    tipo_entidade: 'SQ',
    regime_iva: 'GERAL',
    volume_negocios_anual: '',
    ano_volume_negocios: 2025,
    data_constituicao: '',
    data_inicio_atividade: '',
    atividade_principal: '',
    cae_principal: '',
    provincia: 'Luanda',
    municipio: '',
    comuna: '',
    endereco: '',
    telefone: '',
    email: '',
    website: '',
    reparticao_fiscal: '',
    contabilista_nome: '',
    contabilista_contacto: '',
    periodo_inicial_analise: '',
    estado: 'ATIVA',
  });

  // Modal de Utilizador (Django Admin auth.User + EmpresaUtilizador)
  const [modalUserAberto, setModalUserAberto] = useState(false);
  const [userEmEdicao, setUserEmEdicao] = useState(null);
  const [salvandoUser, setSalvandoUser] = useState(false);
  const [formUser, setFormUser] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    papel: 'Contabilista',
    is_active: true,
    empresas_ids: [],
  });

  // Modal de Execução de Motor de Regras
  const [modalExecEngine, setModalExecEngine] = useState(false);
  const [executandoEngine, setExecutandoEngine] = useState(false);
  const [formExecEngine, setFormExecEngine] = useState({
    empresa_id: '',
    ano: 2026,
    mes: 7,
  });

  // Configurações Globais do Sistema
  const [configuracoes, setConfiguracoes] = useState({
    nome_sistema: 'SCKJ - Sistema de Reconciliação Contabilística & Fiscal',
    versao_sistema: 'v2.4.0 (OGE Angola 2026)',
    modo_manutencao: false,
    idioma_padrao: 'pt',
    fuso_horario: 'Africa/Luanda (GMT+1)',
    limite_upload_mb: 50,
    taxa_iva_geral: 14.0,
    taxa_retencao_fonte_ii: 6.5,
    taxa_inss_patronal: 8.0,
    taxa_inss_trabalhador: 3.0,
    limite_alerta_risco_kz: 5000000.0,
    prazo_inss_dia: 10,
    prazo_iva_dia: 31,
    notificacoes_email_ativas: true,
    email_alertas_fiscal: 'auditoria@sckj.co.ao',
  });
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Carregar todos os dados do painel administrativo
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resStats, resUsers, resRegras, resOcorrencias, resDocs, resConfig, resAcessos, resPgc] = await Promise.allSettled([
        adminService.getEstatisticas(),
        adminService.getUtilizadores(),
        adminService.getRegras(),
        adminService.getOcorrencias(),
        adminService.getDocumentos(),
        adminService.getConfiguracoes(),
        adminService.getRegistrosAcesso(),
        adminService.getPgc(),
      ]);

      if (resStats.status === 'fulfilled') setEstatisticas(resStats.value.data);
      if (resUsers.status === 'fulfilled') setUtilizadores(resUsers.value.data);
      if (resRegras.status === 'fulfilled') setRegras(Array.isArray(resRegras.value.data) ? resRegras.value.data : []);
      if (resOcorrencias.status === 'fulfilled') setOcorrencias(Array.isArray(resOcorrencias.value.data) ? resOcorrencias.value.data : []);
      if (resDocs.status === 'fulfilled') setDocumentos(Array.isArray(resDocs.value.data) ? resDocs.value.data : []);
      if (resConfig.status === 'fulfilled' && resConfig.value.data) setConfiguracoes((prev) => ({ ...prev, ...resConfig.value.data }));
      if (resAcessos.status === 'fulfilled' && resAcessos.value.data) setRegistrosAcesso(resAcessos.value.data);
      if (resPgc.status === 'fulfilled' && resPgc.value.data) setPgcDados(resPgc.value.data);

      if (resStats.status === 'rejected' && resStats.reason?.response?.status === 403) {
        toast.error('Acesso restrito ao Administrador do Sistema.');
        navigate('/auditoria');
      }
    } catch {
      toast.error('Erro ao sincronizar dados com o servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const carregarPgcFiltrado = async (classe, busca) => {
    try {
      const params = {};
      if (classe && classe !== 'TODAS') params.classe = classe;
      if (busca && busca.trim()) params.pesquisa = busca.trim();
      const res = await adminService.getPgc(params);
      if (res.data) setPgcDados(res.data);
    } catch {
      // Ignora erro momentâneo
    }
  };

  const baixarPgcExcel = async () => {
    setBaixandoExcelPgc(true);
    try {
      const res = await adminService.exportarPgcExcel();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Plano_Geral_Contabilidade_Angola_Decreto_82_01.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download do PGC em Excel (.xlsx) concluído com sucesso!');
    } catch {
      toast.error('Erro ao transferir ficheiro Excel do PGC.');
    } finally {
      setBaixandoExcelPgc(false);
    }
  };

  const imprimirPgcPdf = () => {
    window.print();
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchParams.get('aba') && searchParams.get('aba') !== abaAtiva) {
      setAbaAtiva(searchParams.get('aba'));
    }
  }, [searchParams, abaAtiva]);

  // ==========================================
  // FUNÇÕES DE EMPRESAS (CRUD DJANGO ADMIN)
  // ==========================================
  const abrirModalNovaEmpresa = () => {
    setEmpresaEmEdicao(null);
    setFormEmpresa({
      nome: '',
      nome_comercial: '',
      nif: '',
      tipo_entidade: 'SQ',
      regime_iva: 'GERAL',
      volume_negocios_anual: '',
      ano_volume_negocios: 2025,
      data_constituicao: '',
      data_inicio_atividade: '',
      atividade_principal: '',
      cae_principal: '',
      provincia: 'Luanda',
      municipio: '',
      comuna: '',
      endereco: '',
      telefone: '',
      email: '',
      website: '',
      reparticao_fiscal: '',
      contabilista_nome: '',
      contabilista_contacto: '',
      periodo_inicial_analise: '',
      estado: 'ATIVA',
    });
    setModalEmpresaAberto(true);
  };

  useEffect(() => {
    if (searchParams.get('novaEmpresa') === '1') {
      abrirModalNovaEmpresa();
      setSearchParams({ aba: 'empresas' });
    }
  }, [searchParams, setSearchParams]);

  const abrirModalEditarEmpresa = (emp) => {
    setEmpresaEmEdicao(emp);
    setFormEmpresa({
      nome: emp.nome || '',
      nome_comercial: emp.nome_comercial || '',
      nif: emp.nif || '',
      tipo_entidade: emp.tipo_entidade || 'SQ',
      regime_iva: emp.regime_iva || 'GERAL',
      volume_negocios_anual: emp.volume_negocios_anual || '',
      ano_volume_negocios: emp.ano_volume_negocios || 2025,
      data_constituicao: emp.data_constituicao || '',
      data_inicio_atividade: emp.data_inicio_atividade || '',
      atividade_principal: emp.atividade_principal || '',
      cae_principal: emp.cae_principal || '',
      provincia: emp.provincia || 'Luanda',
      municipio: emp.municipio || '',
      comuna: emp.comuna || '',
      endereco: emp.endereco || '',
      telefone: emp.telefone || '',
      email: emp.email || '',
      website: emp.website || '',
      reparticao_fiscal: emp.reparticao_fiscal || '',
      contabilista_nome: emp.contabilista_nome || '',
      contabilista_contacto: emp.contabilista_contacto || '',
      periodo_inicial_analise: emp.periodo_inicial_analise || '',
      estado: emp.estado || 'ATIVA',
    });
    setModalEmpresaAberto(true);
  };

  const salvarEmpresa = async (e) => {
    e.preventDefault();
    if (!formEmpresa.nome.trim() || !formEmpresa.nif.trim()) {
      toast.warning('O Nome e o NIF da empresa são obrigatórios.');
      return;
    }

    setSalvandoEmpresa(true);
    try {
      const payload = {
        ...formEmpresa,
        volume_negocios_anual: formEmpresa.volume_negocios_anual && String(formEmpresa.volume_negocios_anual).trim()
          ? String(formEmpresa.volume_negocios_anual).replace(',', '.')
          : null,
        data_constituicao: formEmpresa.data_constituicao && String(formEmpresa.data_constituicao).trim()
          ? formEmpresa.data_constituicao.trim()
          : null,
        data_inicio_atividade: formEmpresa.data_inicio_atividade && String(formEmpresa.data_inicio_atividade).trim()
          ? formEmpresa.data_inicio_atividade.trim()
          : null,
        periodo_inicial_analise: formEmpresa.periodo_inicial_analise && String(formEmpresa.periodo_inicial_analise).trim()
          ? formEmpresa.periodo_inicial_analise.trim()
          : null,
        ano_volume_negocios: formEmpresa.ano_volume_negocios ? Number(formEmpresa.ano_volume_negocios) : 2025,
      };

      if (empresaEmEdicao) {
        await empresaService.update(empresaEmEdicao.id, payload);
        toast.success(`Empresa "${payload.nome}" atualizada com sucesso!`);
      } else {
        await empresaService.create(payload);
        toast.success(`Empresa "${payload.nome}" cadastrada com sucesso!`);
      }

      setModalEmpresaAberto(false);
      carregarDados();
    } catch (err) {
      const msg = err.response?.data
        ? Object.entries(err.response.data)
            .map(([campo, erro]) => `${campo}: ${Array.isArray(erro) ? erro.join(' ') : erro}`)
            .join(' | ')
        : 'Erro ao guardar dados da empresa.';
      toast.error(msg);
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  const excluirEmpresa = async (emp) => {
    const confirmacao = window.confirm(
      `Tem a certeza que deseja eliminar a empresa "${emp.nome}" (NIF: ${emp.nif})?\n\n` +
      `Esta ação irá remover a empresa e todos os seus registos associados de forma permanente.`
    );
    if (!confirmacao) return;

    try {
      await empresaService.delete(emp.id);
      toast.success(`Empresa "${emp.nome}" eliminada com sucesso.`);
      carregarDados();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Erro ao eliminar empresa.';
      toast.error(msg);
    }
  };

  const alterarEstadoRapidoEmpresa = async (emp, novoEstado) => {
    try {
      await empresaService.patch(emp.id, { estado: novoEstado });
      toast.success(`Estado da empresa alterado para ${novoEstado}.`);
      carregarDados();
    } catch {
      toast.error('Erro ao atualizar estado da empresa.');
    }
  };

  const entrarNoEspacoEmpresa = (empresaId) => {
    atualizar({ empresaId: String(empresaId) });
    toast.info('Workspace alterado para a empresa selecionada.');
    navigate('/auditoria');
  };

  // ==========================================
  // FUNÇÕES DE UTILIZADORES (CRUD DJANGO ADMIN)
  // ==========================================
  const abrirModalNovoUser = () => {
    setUserEmEdicao(null);
    setFormUser({
      username: '',
      password: '',
      email: '',
      first_name: '',
      last_name: '',
      papel: 'Contabilista',
      is_active: true,
      empresas_ids: [],
    });
    setModalUserAberto(true);
  };

  const abrirModalEditarUser = (u) => {
    setUserEmEdicao(u);
    const empresasIds = (u.empresas_vinculadas || []).map((e) => e.id);
    const papelAtual = (u.grupos && u.grupos[0]) || (u.is_superuser ? 'Super Admin' : u.is_staff ? 'Administrador' : 'Contabilista');
    setFormUser({
      username: u.username,
      password: '',
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      papel: papelAtual,
      is_active: u.is_active !== undefined ? u.is_active : true,
      empresas_ids: empresasIds,
    });
    setModalUserAberto(true);
  };

  const salvarUser = async (e) => {
    e.preventDefault();
    if (!formUser.username.trim()) {
      toast.warning('O nome de utilizador (username) é obrigatório.');
      return;
    }
    if (!userEmEdicao && !formUser.password) {
      toast.warning('A palavra-passe é obrigatória para novos utilizadores.');
      return;
    }

    setSalvandoUser(true);
    try {
      if (userEmEdicao) {
        const payload = { ...formUser };
        if (!payload.password) delete payload.password;
        await adminService.updateUtilizador(userEmEdicao.id, payload);
        toast.success(`Utilizador "${formUser.username}" atualizado com sucesso!`);
      } else {
        await adminService.createUtilizador(formUser);
        toast.success(`Utilizador "${formUser.username}" criado com sucesso!`);
      }
      setModalUserAberto(false);
      carregarDados();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao processar utilizador.';
      toast.error(msg);
    } finally {
      setSalvandoUser(false);
    }
  };

  const alternarAtivoUser = async (u) => {
    try {
      await adminService.patchUtilizador(u.id, { is_active: !u.is_active });
      toast.success(`Utilizador ${!u.is_active ? 'ativado' : 'desativado'} com sucesso.`);
      carregarDados();
    } catch {
      toast.error('Erro ao alterar estado do utilizador.');
    }
  };

  const excluirUser = async (u) => {
    if (!window.confirm(t('admin.users.deleteConfirm', 'Tem a certeza de que deseja eliminar o utilizador "{{username}}"?', { username: u.username }))) return;
    try {
      await adminService.deleteUtilizador(u.id);
      toast.success(`Utilizador "${u.username}" removido.`);
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao eliminar utilizador.');
    }
  };

  // ==========================================
  // FUNÇÕES DE REGRAS FISCAIS (RULE ENGINE)
  // ==========================================
  const alternarActivaRegra = async (regra) => {
    try {
      await adminService.updateRegra(regra.id, { activa: !regra.activa });
      toast.success(`Regra ${regra.codigo} ${!regra.activa ? 'ativada' : 'desativada'}.`);
      setRegras((prev) =>
        prev.map((r) => (r.id === regra.id ? { ...r, activa: !r.activa } : r))
      );
    } catch {
      toast.error('Erro ao atualizar regra.');
    }
  };

  const mudarSeveridadeRegra = async (regra, novaSeveridade) => {
    try {
      await adminService.updateRegra(regra.id, { severidade: novaSeveridade });
      toast.success(`Severidade da regra ${regra.codigo} alterada para ${novaSeveridade}.`);
      setRegras((prev) =>
        prev.map((r) => (r.id === regra.id ? { ...r, severidade: novaSeveridade } : r))
      );
    } catch {
      toast.error('Erro ao atualizar severidade.');
    }
  };

  const validarRegraHumana = async (regra, novoEstado) => {
    try {
      await adminService.updateRegra(regra.id, { estado_validacao: novoEstado });
      toast.success(`Estado de validação da regra ${regra.codigo} definido como ${novoEstado}.`);
      setRegras((prev) =>
        prev.map((r) => (r.id === regra.id ? { ...r, estado_validacao: novoEstado } : r))
      );
    } catch {
      toast.error('Erro ao validar regra.');
    }
  };

  // ==========================================
  // FUNÇÕES DE OCORRÊNCIAS GLOBAIS
  // ==========================================
  const mudarEstadoOcorrencia = async (occ, novoEstado) => {
    try {
      await adminService.updateOcorrencia(occ.id, { estado: novoEstado });
      toast.success(`Ocorrência #${occ.id} marcada como ${novoEstado}.`);
      setOcorrencias((prev) =>
        prev.map((o) => (o.id === occ.id ? { ...o, estado: novoEstado } : o))
      );
    } catch {
      toast.error('Erro ao atualizar estado da ocorrência.');
    }
  };

  const executarMotorParaEmpresa = async (e) => {
    e.preventDefault();
    if (!formExecEngine.empresa_id) {
      toast.warning('Selecione a empresa para executar o motor de auditoria.');
      return;
    }
    setExecutandoEngine(true);
    try {
      const res = await adminService.executarOcorrencias({
        empresa_id: Number(formExecEngine.empresa_id),
        ano: Number(formExecEngine.ano),
        mes: Number(formExecEngine.mes),
      });
      toast.success(`Motor executado com sucesso! ${res.data?.ocorrencias_geradas ?? ''} ocorrências geradas/revistas.`);
      setModalExecEngine(false);
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao executar motor.');
    } finally {
      setExecutandoEngine(false);
    }
  };

  // ==========================================
  // FUNÇÕES DE DOCUMENTOS GLOBAIS
  // ==========================================
  const excluirDocumento = async (doc) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o documento "${doc.nome_arquivo || doc.nome}"?`)) return;
    try {
      await adminService.deleteDocumento(doc.id);
      toast.success('Documento eliminado do arquivo.');
      carregarDados();
    } catch {
      toast.error('Erro ao eliminar documento.');
    }
  };

  // ==========================================
  // CONFIGURAÇÕES GLOBAIS DO SISTEMA
  // ==========================================
  const salvarConfiguracoesSistema = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSalvandoConfig(true);
    try {
      const res = await adminService.updateConfiguracoes(configuracoes);
      if (res.data?.data) {
        setConfiguracoes((prev) => ({ ...prev, ...res.data.data }));
      }
      toast.success(t('admin.config.saveSuccess', 'Configurações do sistema guardadas com sucesso!'));
    } catch {
      toast.error(t('admin.config.saveError', 'Erro ao guardar configurações.'));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const restaurarPadroesAgt = () => {
    setConfiguracoes((prev) => ({
      ...prev,
      taxa_iva_geral: 14.0,
      taxa_retencao_fonte_ii: 6.5,
      taxa_inss_patronal: 8.0,
      taxa_inss_trabalhador: 3.0,
      limite_alerta_risco_kz: 5000000.0,
      limite_upload_mb: 50,
      fuso_horario: 'Africa/Luanda (GMT+1)',
    }));
    toast.info('Valores de referência restaurados para o padrão AGT Angola 2026. Clique em Guardar para confirmar.');
  };

  // ==========================================
  // FILTRAGENS
  // ==========================================
  const empresasLista = estatisticas?.empresas || [];
  const empresasFiltradas = empresasLista.filter((emp) => {
    const batePesquisa =
      !pesquisaEmpresa ||
      emp.nome.toLowerCase().includes(pesquisaEmpresa.toLowerCase()) ||
      emp.nif.toLowerCase().includes(pesquisaEmpresa.toLowerCase()) ||
      (emp.provincia && emp.provincia.toLowerCase().includes(pesquisaEmpresa.toLowerCase()));
    const bateRegime = filtroRegimeEmpresa === 'TODOS' || emp.regime_iva === filtroRegimeEmpresa;
    const bateEstado = filtroEstadoEmpresa === 'TODOS' || emp.estado === filtroEstadoEmpresa;
    return batePesquisa && bateRegime && bateEstado;
  });

  const usersFiltrados = utilizadores.filter((u) => {
    const batePesquisa =
      !pesquisaUser ||
      u.username.toLowerCase().includes(pesquisaUser.toLowerCase()) ||
      (u.first_name && u.first_name.toLowerCase().includes(pesquisaUser.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(pesquisaUser.toLowerCase()));
    const batePapel =
      filtroPapelUser === 'TODOS' ||
      (u.grupos && u.grupos.includes(filtroPapelUser)) ||
      (filtroPapelUser === 'Super Admin' && u.is_superuser);
    return batePesquisa && batePapel;
  });

  const regrasFiltradas = regras.filter((r) => {
    const batePesquisa =
      !pesquisaRegra ||
      r.codigo.toLowerCase().includes(pesquisaRegra.toLowerCase()) ||
      r.nome.toLowerCase().includes(pesquisaRegra.toLowerCase()) ||
      (r.imposto && r.imposto.toLowerCase().includes(pesquisaRegra.toLowerCase()));
    const bateMotor = filtroMotorRegra === 'TODOS' || r.motor === filtroMotorRegra;
    const bateSev = filtroSeveridadeRegra === 'TODOS' || r.severidade === filtroSeveridadeRegra;
    return batePesquisa && bateMotor && bateSev;
  });

  const ocorrenciasFiltradas = ocorrencias.filter((o) => {
    const nomeEmpresa = o.empresa_nome || '';
    const codRegra = o.regra_codigo || '';
    const batePesquisa =
      !pesquisaOcorrencia ||
      nomeEmpresa.toLowerCase().includes(pesquisaOcorrencia.toLowerCase()) ||
      codRegra.toLowerCase().includes(pesquisaOcorrencia.toLowerCase()) ||
      (o.mensagem && o.mensagem.toLowerCase().includes(pesquisaOcorrencia.toLowerCase()));
    const bateSev = filtroSeveridadeOcorrencia === 'TODOS' || o.severidade === filtroSeveridadeOcorrencia;
    const bateEst = filtroEstadoOcorrencia === 'TODOS' || o.estado === filtroEstadoOcorrencia;
    const bateEmp = filtroEmpresaOcorrencia === 'TODOS' || String(o.empresa) === String(filtroEmpresaOcorrencia);
    return batePesquisa && bateSev && bateEst && bateEmp;
  });

  const documentosFiltrados = documentos.filter((d) => {
    const nome = d.nome_arquivo || d.nome || '';
    const emp = d.empresa_nome || '';
    const batePesquisa =
      !pesquisaDoc ||
      nome.toLowerCase().includes(pesquisaDoc.toLowerCase()) ||
      emp.toLowerCase().includes(pesquisaDoc.toLowerCase());
    const bateTipo = filtroTipoDoc === 'TODOS' || d.tipo === filtroTipoDoc;
    return batePesquisa && bateTipo;
  });

  if (carregando && !estatisticas) {
    return (
      <AdminLayout abaAtiva={abaAtiva} onMudarAba={mudarAba} estatisticas={estatisticas}>
        <div className="d-flex flex-column align-items-center justify-content-center py-80">
          <div className="spinner-border text-primary mb-15" role="status" style={{ width: 44, height: 44 }}>
            <span className="sr-only">A carregar portal administrativo...</span>
          </div>
          <h5 className="text-dark fw-600 mb-4">A carregar Centro de Controlo Master...</h5>
          <span className="text-muted" style={{ fontSize: 13 }}>
            A sincronizar empresas, utilizadores, regras e ocorrências fiscais
          </span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      abaAtiva={abaAtiva}
      onMudarAba={mudarAba}
      estatisticas={estatisticas}
    >
      {/* CABEÇALHO DO PAINEL */}
      <div className="row">
        <div className="col-lg-12">
          <div className="breadcrumb-main d-flex justify-content-between align-items-center flex-wrap" style={{ marginBottom: 25, gap: 12 }}>
            <h4 className="text-capitalize breadcrumb-title m-0" style={{ fontSize: 20, fontWeight: 700, color: '#272b41' }}>
              {t('admin.globalAdminTitle', 'Painel de Administração Global')}
            </h4>
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 38,
                  padding: '0 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: 6,
                }}
                onClick={() => setModalExecEngine(true)}
              >
                <i className="la la-play mr-1" style={{ fontSize: 14 }}></i> {t('admin.executeEngines', 'Executar Motores de Regras')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 38,
                  padding: '0 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: 6,
                  backgroundColor: '#5f63f2',
                  borderColor: '#5f63f2',
                }}
                onClick={abrirModalNovaEmpresa}
              >
                <i className="la la-plus mr-1" style={{ fontSize: 14 }}></i> {t('admin.newCompany', 'Nova Empresa')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS COM ESTILO PADRÃO DO SISTEMA */}
      <div className="row mb-25">
        <div className="col-xl-3 col-sm-6 mb-25 mb-xl-0">
          <div className="card card-default" style={{ borderTop: '3px solid #5f63f2' }}>
            <div className="card-body" style={{ padding: '20px 22px' }}>
              <span className="text-muted d-block" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('admin.kpi.totalCompanies', 'Total de Empresas')}
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#5f63f2', margin: '6px 0 2px' }}>
                {estatisticas?.total_empresas ?? '—'}
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {estatisticas?.empresas_ativas ?? 0} {t('admin.kpi.active', 'ativas')} · {estatisticas?.empresas_inativas ?? 0} {t('admin.kpi.inactive', 'inativas')}
              </span>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6 mb-25 mb-xl-0">
          <div className="card card-default" style={{ borderTop: '3px solid #ff4d4f' }}>
            <div className="card-body" style={{ padding: '20px 22px' }}>
              <span className="text-muted d-block" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('admin.kpi.globalRiskExposure', 'Exposição Global em Risco')}
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ff4d4f', margin: '6px 0 2px', lineHeight: 1.2 }}>
                {estatisticas ? kzComMoeda(estatisticas.total_risco_global) : '—'}
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {t('admin.kpi.accumulatedTaxRiskKz', 'Risco fiscal acumulado em Kwanzas')}
              </span>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6 mb-25 mb-xl-0">
          <div className="card card-default" style={{ borderTop: '3px solid #20c997' }}>
            <div className="card-body" style={{ padding: '20px 22px' }}>
              <span className="text-muted d-block" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('admin.kpi.usersWithAccess', 'Utilizadores com Acesso')}
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#20c997', margin: '6px 0 2px' }}>
                {estatisticas?.total_utilizadores ?? '—'}
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {t('admin.kpi.adminsAndAccountants', 'Administradores e contabilistas')}
              </span>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6">
          <div className="card card-default" style={{ borderTop: '3px solid #fa8b0c' }}>
            <div className="card-body" style={{ padding: '20px 22px' }}>
              <span className="text-muted d-block" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('admin.kpi.activeRulesEngines', 'Regras & Motores Ativos')}
              </span>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#fa8b0c', margin: '6px 0 2px' }}>
                {regras.length || 12}
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {t('admin.kpi.autoAuditModules', 'módulos de auditoria automática')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO DE SECÇÕES */}
      <div className="card card-default mb-25">
        <div
          className="d-flex align-items-center flex-wrap"
          style={{
            borderBottom: '1px solid #f1f2f6',
            padding: '0 10px',
            background: '#fff',
            gap: 2,
          }}
        >
          {[
            { key: 'pgc', label: `${t('admin.sidebar.pgcCatalog', 'Plano Geral de Contabilidade (PGC)')} (${pgcDados.total || 0})`, icon: 'la-book' },
            { key: 'empresas', label: `${t('admin.sidebar.registeredCompanies', 'Empresas Clientes')} (${empresasLista.length})`, icon: 'la-building' },
            { key: 'documentos', label: `${t('admin.tabs.documentos', 'Arquivo & Balancetes')} (${documentos.length})`, icon: 'la-archive' },
            { key: 'utilizadores', label: `${t('admin.sidebar.users', 'Utilizadores & Acessos')} (${utilizadores.length})`, icon: 'la-users-cog' },
            { key: 'dashboard', label: t('admin.sidebar.globalViewRisks', 'Visão Geral'), icon: 'la-chart-pie' },
            { key: 'configuracoes', label: t('admin.sidebar.settings', 'Configurações Globais'), icon: 'la-sliders-h' },
          ].map((tab) => {
            const isActive = abaAtiva === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className="btn btn-link"
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#5f63f2' : '#8c90a4',
                  borderBottom: isActive ? '2px solid #5f63f2' : '2px solid transparent',
                  borderRadius: 0,
                  textDecoration: 'none',
                }}
                onClick={() => mudarAba(tab.key)}
              >
                <i className={`la ${tab.icon} mr-1`}></i> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* ABA 1: DASHBOARD & ESTATÍSTICAS GLOBAIS              */}
      {/* ==================================================== */}
      {abaAtiva === 'dashboard' && (
        <div>
          {/* TABELA DE QUADRO RESUMO DAS EMPRESAS COM RISCO */}
          <div className="card card-default mb-25">
            <div className="card-header bg-white py-16 px-20 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <h5 className="fw-700 text-dark mb-0">Visão de Risco Fiscal por Empresa</h5>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Empresas ordenadas com os dados do período mais recente e exposição apurada
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link text-primary fw-600 p-0"
                onClick={() => mudarAba('empresas')}
              >
                Ver Todas as Empresas →
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th className="py-12 px-20">Empresa</th>
                    <th>NIF</th>
                    <th>Regime Fiscal</th>
                    <th>Documentos</th>
                    <th>Último Período</th>
                    <th>Inconformidades</th>
                    <th>Risco Estimado</th>
                    <th className="text-right px-20">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasLista.map((emp) => (
                    <tr key={emp.id}>
                      <td className="py-14 px-20">
                        <div className="d-flex align-items-center">
                          <div
                            className="rounded mr-10 d-flex align-items-center justify-content-center"
                            style={{
                              width: 32,
                              height: 32,
                              backgroundColor: '#eef2ff',
                              color: '#5f63f2',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {emp.nome.charAt(0)}
                          </div>
                          <div>
                            <div className="fw-700 text-dark">{emp.nome}</div>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {emp.provincia || 'Angola'} · {emp.telefone || 'Sem telefone'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ color: '#0f172a', fontWeight: 600 }}>{emp.nif}</code>
                      </td>
                      <td>
                        <span className="badge badge-light border" style={{ fontSize: 11 }}>
                          {emp.regime_iva}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-light border" style={{ fontSize: 11 }}>
                          {emp.total_documentos} ficheiros
                        </span>
                      </td>
                      <td className="text-muted">{emp.ultimo_periodo}</td>
                      <td>
                        {emp.erros_contagem > 0 ? (
                          <span className="badge badge-danger" style={{ fontSize: 11 }}>
                            {emp.erros_contagem} divergências
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: 11 }}>
                            Sem erros
                          </span>
                        )}
                      </td>
                      <td>
                        <strong className={Number(emp.em_risco) > 0 ? 'text-danger' : 'text-success'}>
                          {kzComMoeda(emp.em_risco)}
                        </strong>
                      </td>
                      <td className="text-right px-20">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary mr-6"
                          onClick={() => entrarNoEspacoEmpresa(emp.id)}
                          style={{
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontWeight: 600,
                            backgroundColor: '#5f63f2',
                            borderColor: '#5f63f2',
                          }}
                          title="Entrar no espaço operacional de auditoria desta empresa"
                        >
                          <i className="la la-chart-bar mr-4"></i> Auditar
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-secondary"
                          onClick={() => abrirModalEditarEmpresa(emp)}
                          style={{ borderRadius: 6, padding: '4px 8px' }}
                          title="Editar cadastro no Django Admin"
                        >
                          <i className="la la-pencil-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 2: EMPRESAS & CONTRIBUINTES (DJANGO ADMIN CRUD)  */}
      {/* ==================================================== */}
      {abaAtiva === 'empresas' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
                Empresas & Contribuintes
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Cadastro mestre, dados de constituição, regime de IVA, enquadramento fiscal e contactos.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center"
              onClick={abrirModalNovaEmpresa}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                backgroundColor: '#5f63f2',
                borderColor: '#5f63f2',
                padding: '8px 16px',
              }}
            >
              <i className="la la-plus mr-8" style={{ fontSize: 16 }}></i>
              Cadastrar Nova Empresa
            </button>
          </div>

          <div className="card card-default mb-20">
            <div className="card-body p-20">
              {/* FILTROS */}
              <div className="row mb-20 align-items-center">
                <div className="col-md-5 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i
                      className="la la-search position-absolute"
                      style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}
                    ></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Pesquisar por nome, NIF ou província..."
                      value={pesquisaEmpresa}
                      onChange={(e) => setPesquisaEmpresa(e.target.value)}
                      style={{ paddingLeft: 40, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroRegimeEmpresa}
                    onChange={(e) => setFiltroRegimeEmpresa(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todos os Regimes</option>
                    <option value="GERAL">Regime Geral (14%)</option>
                    <option value="SIMPLIFICADO">Regime Simplificado (7%)</option>
                    <option value="EXCLUSAO">Regime de Exclusão</option>
                  </select>
                </div>

                <div className="col-md-2 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroEstadoEmpresa}
                    onChange={(e) => setFiltroEstadoEmpresa(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todos os Estados</option>
                    <option value="ATIVA">Ativa</option>
                    <option value="INATIVA">Inativa</option>
                    <option value="SUSPENSA">Suspensa</option>
                    <option value="ENCERRADA">Encerrada</option>
                  </select>
                </div>

                <div className="col-md-2 text-md-right text-muted" style={{ fontSize: 12 }}>
                  <strong>{empresasFiltradas.length}</strong> de {empresasLista.length} empresas
                </div>
              </div>

              {/* TABELA DE EMPRESAS */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th className="py-12">Empresa</th>
                      <th>NIF</th>
                      <th>Tipo</th>
                      <th>Regime Fiscal</th>
                      <th>Província</th>
                      <th>Volume Anual</th>
                      <th>Contabilista</th>
                      <th>Estado</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-40 text-muted">
                          Nenhuma empresa encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      empresasFiltradas.map((emp) => (
                        <tr key={emp.id}>
                          <td className="py-12">
                            <div className="fw-700 text-dark">{emp.nome}</div>
                            {emp.nome_comercial && (
                              <div className="text-muted" style={{ fontSize: 11 }}>
                                {emp.nome_comercial}
                              </div>
                            )}
                          </td>
                          <td>
                            <code style={{ color: '#0f172a', fontWeight: 600 }}>{emp.nif}</code>
                          </td>
                          <td>
                            <span className="badge badge-light border" style={{ fontSize: 10 }}>
                              {emp.tipo_entidade || 'SQ'}
                            </span>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor:
                                  emp.regime_iva === 'GERAL'
                                    ? '#eef2ff'
                                    : emp.regime_iva === 'SIMPLIFICADO'
                                    ? '#ecfdf5'
                                    : '#fef3c7',
                                color:
                                  emp.regime_iva === 'GERAL'
                                    ? '#5f63f2'
                                    : emp.regime_iva === 'SIMPLIFICADO'
                                    ? '#059669'
                                    : '#b45309',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {emp.regime_iva}
                            </span>
                          </td>
                          <td>{emp.provincia || 'Luanda'}</td>
                          <td className="text-dark fw-600">
                            {Number(emp.volume_negocios_anual) > 0
                              ? kzComMoeda(emp.volume_negocios_anual)
                              : 'Não declarado'}
                          </td>
                          <td className="text-muted" style={{ fontSize: 12 }}>
                            {emp.contabilista_nome || '—'}
                          </td>
                          <td>
                            <select
                              className="form-control form-control-sm"
                              value={emp.estado}
                              onChange={(e) => alterarEstadoRapidoEmpresa(emp, e.target.value)}
                              style={{
                                width: 105,
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 6,
                                padding: '2px 6px',
                                height: 26,
                                backgroundColor: emp.estado === 'ATIVA' ? '#ecfdf5' : '#f1f5f9',
                                color: emp.estado === 'ATIVA' ? '#059669' : '#475569',
                                border: '1px solid #cbd5e1',
                              }}
                              title="Alterar estado da empresa no sistema"
                            >
                              <option value="ATIVA">ATIVA</option>
                              <option value="INATIVA">INATIVA</option>
                              <option value="SUSPENSA">SUSPENSA</option>
                              <option value="ENCERRADA">ENCERRADA</option>
                            </select>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-xs btn-primary mr-6"
                              onClick={() => entrarNoEspacoEmpresa(emp.id)}
                              style={{
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontWeight: 600,
                                backgroundColor: '#5f63f2',
                                borderColor: '#5f63f2',
                              }}
                              title="Auditar empresa"
                            >
                              <i className="la la-chart-bar mr-4"></i> Auditar
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-secondary mr-6"
                              onClick={() => abrirModalEditarEmpresa(emp)}
                              style={{ borderRadius: 6, padding: '4px 8px' }}
                              title="Editar dados"
                            >
                              <i className="la la-pencil-alt"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-danger"
                              onClick={() => excluirEmpresa(emp)}
                              style={{ borderRadius: 6, padding: '4px 8px' }}
                              title="Eliminar empresa"
                            >
                              <i className="la la-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 3: UTILIZADORES & PERMISSÕES (DJANGO USER ADMIN) */}
      {/* ==================================================== */}
      {abaAtiva === 'utilizadores' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
                {t('admin.users.title', 'Gestão de Utilizadores & Permissões')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {t('admin.users.subtitle', 'Controlo de contas de acesso (Django auth.User), atribuição de papéis e vínculos de empresas.')}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center"
              onClick={abrirModalNovoUser}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                backgroundColor: '#5f63f2',
                borderColor: '#5f63f2',
                padding: '8px 16px',
              }}
            >
              <i className="la la-user-plus mr-8" style={{ fontSize: 16 }}></i>
              {t('admin.users.newUser', 'Novo Utilizador')}
            </button>
          </div>

          <div className="card card-default mb-20">
            <div className="card-body p-20">
              {/* FILTROS */}
              <div className="row mb-20 align-items-center">
                <div className="col-md-6 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i
                      className="la la-search position-absolute"
                      style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}
                    ></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('admin.users.searchPlaceholder', 'Pesquisar por nome de utilizador, email ou nome...')}
                      value={pesquisaUser}
                      onChange={(e) => setPesquisaUser(e.target.value)}
                      style={{ paddingLeft: 40, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroPapelUser}
                    onChange={(e) => setFiltroPapelUser(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">{t('admin.users.allRoles', 'Todos os Papéis')}</option>
                    <option value="Super Admin">{t('admin.users.roleSuperAdmin', 'Super Admin')}</option>
                    <option value="Administrador">{t('admin.users.roleAdmin', 'Administrador')}</option>
                    <option value="Auditor">{t('admin.users.roleAuditor', 'Auditor')}</option>
                    <option value="Contabilista">{t('admin.users.roleAccountant', 'Contabilista')}</option>
                    <option value="Fiscalista">{t('admin.users.roleTaxSpecialist', 'Fiscalista')}</option>
                    <option value="Consulta">{t('admin.users.roleReadOnly', 'Consulta')}</option>
                  </select>
                </div>

                <div className="col-md-3 text-md-right text-muted" style={{ fontSize: 12 }}>
                  {t('admin.users.countShowing', '{{count}} de {{total}} utilizadores', { count: usersFiltrados.length, total: utilizadores.length })}
                </div>
              </div>

              {/* TABELA DE UTILIZADORES */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th className="py-12">{t('admin.users.thUser', 'Utilizador')}</th>
                      <th>{t('admin.users.thFullName', 'Nome Completo')}</th>
                      <th>{t('admin.users.thEmail', 'Email')}</th>
                      <th>{t('admin.users.thRole', 'Papel / Grupos')}</th>
                      <th>{t('admin.users.thLinkedCompanies', 'Empresas Vinculadas')}</th>
                      <th>{t('admin.users.thStatus', 'Estado')}</th>
                      <th className="text-right">{t('admin.users.thActions', 'Ações')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-40 text-muted">
                          {t('admin.users.empty', 'Nenhum utilizador encontrado.')}
                        </td>
                      </tr>
                    ) : (
                      usersFiltrados.map((u) => {
                        const papelExibido =
                          (u.grupos && u.grupos[0]) ||
                          (u.is_superuser ? 'Super Admin' : u.is_staff ? 'Administrador' : 'Utilizador');
                        return (
                          <tr key={u.id}>
                            <td className="py-12">
                              <div className="d-flex align-items-center">
                                <div
                                  className="rounded-circle mr-10 d-flex align-items-center justify-content-center"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    backgroundColor: u.is_superuser ? '#fef3c7' : '#eef2ff',
                                    color: u.is_superuser ? '#b45309' : '#5f63f2',
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="fw-700 text-dark">{u.username}</span>
                              </div>
                            </td>
                            <td>
                              {u.first_name || u.last_name
                                ? `${u.first_name || ''} ${u.last_name || ''}`
                                : '—'}
                            </td>
                            <td className="text-muted">{u.email || '—'}</td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: u.is_superuser
                                    ? '#5f63f2'
                                    : papelExibido === 'Administrador'
                                    ? '#3b82f6'
                                    : '#64748b',
                                  color: '#fff',
                                  fontSize: 10,
                                }}
                              >
                                {papelExibido}
                              </span>
                            </td>
                            <td>
                              {u.empresas_vinculadas && u.empresas_vinculadas.length > 0 ? (
                                <div className="d-flex flex-wrap" style={{ gap: 4 }}>
                                  {u.empresas_vinculadas.map((emp) => (
                                    <span
                                      key={emp.id}
                                      className="badge badge-light border"
                                      style={{ fontSize: 10 }}
                                      title={`NIF: ${emp.nif}`}
                                    >
                                      {emp.nome}
                                    </span>
                                  ))}
                                </div>
                              ) : u.is_superuser ? (
                                <span className="text-success fw-600" style={{ fontSize: 11 }}>
                                  {t('admin.users.fullMasterAccess', 'Acesso Total (Master)')}
                                </span>
                              ) : (
                                <span className="text-muted" style={{ fontSize: 11 }}>
                                  {t('admin.users.noCompaniesLinked', 'Nenhuma empresa vinculada')}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-xs p-0"
                                onClick={() => alternarAtivoUser(u)}
                                title={t('admin.users.toggleStatusTooltip', 'Clique para alternar estado')}
                              >
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: u.is_active ? '#10b981' : '#ef4444',
                                    color: '#fff',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {u.is_active ? t('admin.users.active', 'Ativo') : t('admin.users.blocked', 'Bloqueado')}
                                </span>
                              </button>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-secondary mr-6"
                                onClick={() => abrirModalEditarUser(u)}
                                style={{ borderRadius: 6, padding: '4px 8px' }}
                                title={t('admin.users.editTooltip', 'Editar dados e permissões')}
                              >
                                <i className="la la-pencil-alt"></i>
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-danger"
                                onClick={() => excluirUser(u)}
                                style={{ borderRadius: 6, padding: '4px 8px' }}
                                title={t('admin.users.deleteTooltip', 'Eliminar utilizador')}
                              >
                                <i className="la la-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PAINEL DE AUDITORIA DE SEGURANÇA: TENTATIVAS BLOQUEADAS */}
          <div className="card card-default mt-25" style={{ borderRadius: 10, border: '1px solid #fee2e2' }}>
            <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap" style={{ padding: '16px 20px', borderBottom: '1px solid #fecaca' }}>
              <div>
                <h6 style={{ margin: 0, fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center' }}>
                  <i className="la la-shield-alt mr-2" style={{ color: '#ef4444', fontSize: 20 }}></i>
                  Auditoria de Segurança: Tentativas de Acesso de Empresas Bloqueadas
                </h6>
                <small className="text-muted">
                  Registo em tempo real de tentativas de entrada na Área Administrativa por empresas e utilizadores não autorizados.
                </small>
              </div>
              <div className="d-flex align-items-center mt-2 mt-sm-0" style={{ gap: 8 }}>
                <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 700, padding: '5px 10px' }}>
                  {registrosAcesso.total_bloqueados || registrosAcesso.registros?.length || 0} Tentativas Travadas
                </span>
                <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 700, padding: '5px 10px' }}>
                  <i className="la la-lock mr-1"></i> Firewall 100% Ativo
                </span>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table mb-0 table-hover">
                  <thead style={{ backgroundColor: '#fef2f2', fontSize: 11, textTransform: 'uppercase' }}>
                    <tr>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>Data / Hora</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>Utilizador</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>Empresa Vinculada</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>IP de Origem</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>Rota Tentada</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }}>Motivo</th>
                      <th style={{ padding: '10px 16px', color: '#991b1b' }} className="text-center">Resultado</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: 13 }}>
                    {!registrosAcesso.registros || registrosAcesso.registros.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-25 text-muted">
                          <i className="la la-check-circle text-success mr-2" style={{ fontSize: 18 }}></i>
                          Nenhuma tentativa de intrusão detetada. O isolamento entre as empresas e o painel administrativo está 100% operacional.
                        </td>
                      </tr>
                    ) : (
                      registrosAcesso.registros.slice(0, 15).map((r) => (
                        <tr key={r.id}>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }} className="text-muted">
                            {new Date(r.created_at).toLocaleString('pt-AO')}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1f2937' }}>
                            {r.username}
                          </td>
                          <td style={{ padding: '10px 16px' }} className="text-muted">
                            {r.empresa_nome || '—'}
                          </td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                            {r.ip_origem || '127.0.0.1'}
                          </td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: '#6366f1' }}>
                            {r.rota_tentada}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280' }}>
                            {r.motivo}
                          </td>
                          <td style={{ padding: '10px 16px' }} className="text-center">
                            <span
                              className="badge"
                              style={{
                                backgroundColor: r.resultado === 'NEGADO' ? '#fee2e2' : '#ecfdf5',
                                color: r.resultado === 'NEGADO' ? '#dc2626' : '#059669',
                                fontWeight: 700,
                                fontSize: 10,
                                padding: '4px 8px',
                              }}
                            >
                              {r.resultado === 'NEGADO' ? 'BLOQUEADO (403)' : 'PERMITIDO'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 4: MOTORES & REGRAS FISCAIS (RULE ENGINE ADMIN)  */}
      {/* ==================================================== */}
      {abaAtiva === 'regras' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
                Motores de Auditoria & Regras Fiscais
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Configuração ativa do Rule Engine tributário angolano (Lei 7/19 CIVA, Lei 18/14 CIRT, Lei 19/14 CII).
              </p>
            </div>
          </div>

          <div className="card card-default mb-20">
            <div className="card-body p-20">
              {/* FILTROS */}
              <div className="row mb-20 align-items-center">
                <div className="col-md-5 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i
                      className="la la-search position-absolute"
                      style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}
                    ></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Pesquisar por código, nome da regra ou imposto..."
                      value={pesquisaRegra}
                      onChange={(e) => setPesquisaRegra(e.target.value)}
                      style={{ paddingLeft: 40, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroMotorRegra}
                    onChange={(e) => setFiltroMotorRegra(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todos os Motores</option>
                    <option value="M-IVA">Motor IVA</option>
                    <option value="M-IRT">Motor IRT</option>
                    <option value="M-II">Imposto Industrial</option>
                    <option value="M-RET">Retenções</option>
                    <option value="M-SS">Segurança Social</option>
                  </select>
                </div>

                <div className="col-md-2 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroSeveridadeRegra}
                    onChange={(e) => setFiltroSeveridadeRegra(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todas as Severidades</option>
                    <option value="ALTO">Alto</option>
                    <option value="MEDIO">Médio</option>
                    <option value="BAIXO">Baixo</option>
                    <option value="INFORMATIVO">Informativo</option>
                  </select>
                </div>

                <div className="col-md-2 text-md-right text-muted" style={{ fontSize: 12 }}>
                  <strong>{regrasFiltradas.length}</strong> de {regras.length} regras
                </div>
              </div>

              {/* TABELA DE REGRAS */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th className="py-12">Código</th>
                      <th>Nome da Regra</th>
                      <th>Imposto</th>
                      <th>Base Legal (Legislação Angolana)</th>
                      <th>Severidade</th>
                      <th>Validação</th>
                      <th className="text-center">Ativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regrasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-40 text-muted">
                          Nenhuma regra encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      regrasFiltradas.map((r) => (
                        <tr key={r.id}>
                          <td className="py-12">
                            <span className="badge badge-light border fw-700" style={{ color: '#0f172a' }}>
                              {r.codigo}
                            </span>
                          </td>
                          <td>
                            <div className="fw-700 text-dark">{r.nome}</div>
                            {r.descricao && (
                              <div className="text-muted" style={{ fontSize: 11 }}>
                                {r.descricao}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ fontSize: 10 }}>
                              {r.imposto}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {r.base_legal ? (
                              <div>
                                <span className="fw-600 text-dark">{r.base_legal.legislacao}</span>
                                <div className="text-muted" style={{ fontSize: 11 }}>
                                  Art. {r.base_legal.artigo}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <select
                              className="form-control form-control-sm"
                              value={r.severidade}
                              onChange={(e) => mudarSeveridadeRegra(r, e.target.value)}
                              style={{
                                width: 110,
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 6,
                                color:
                                  r.severidade === 'ALTO'
                                    ? '#ef4444'
                                    : r.severidade === 'MEDIO'
                                    ? '#f59e0b'
                                    : '#10b981',
                              }}
                            >
                              <option value="ALTO">ALTO</option>
                              <option value="MEDIO">MÉDIO</option>
                              <option value="BAIXO">BAIXO</option>
                              <option value="INFORMATIVO">INFO</option>
                            </select>
                          </td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 6 }}>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor:
                                    r.estado_validacao === 'VALIDADA'
                                      ? '#ecfdf5'
                                      : r.estado_validacao === 'POR_VALIDAR'
                                      ? '#fef3c7'
                                      : '#fef2f2',
                                  color:
                                    r.estado_validacao === 'VALIDADA'
                                      ? '#059669'
                                      : r.estado_validacao === 'POR_VALIDAR'
                                      ? '#b45309'
                                      : '#dc2626',
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {r.estado_validacao}
                              </span>
                              {r.estado_validacao !== 'VALIDADA' && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-success p-1"
                                  onClick={() => validarRegraHumana(r, 'VALIDADA')}
                                  title="Aprovar e Validar Regra"
                                  style={{ lineHeight: 1 }}
                                >
                                  <i className="la la-check"></i>
                                </button>
                              )}
                              {r.estado_validacao !== 'REJEITADA' && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-danger p-1"
                                  onClick={() => validarRegraHumana(r, 'REJEITADA')}
                                  title="Rejeitar Regra"
                                  style={{ lineHeight: 1 }}
                                >
                                  <i className="la la-times"></i>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="custom-control custom-switch">
                              <input
                                type="checkbox"
                                className="custom-control-input"
                                id={`switch-regra-${r.id}`}
                                checked={Boolean(r.activa)}
                                onChange={() => alternarActivaRegra(r)}
                              />
                              <label
                                className="custom-control-label"
                                htmlFor={`switch-regra-${r.id}`}
                                style={{ cursor: 'pointer' }}
                              ></label>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 5: OCORRÊNCIAS FISCAIS GLOBAIS (AUDITORIA GERAL) */}
      {/* ==================================================== */}
      {abaAtiva === 'ocorrencias' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
                Ocorrências Fiscais Globais
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Alertas, incongruências e divergências detectadas em todas as empresas pelo Rule Engine.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary d-flex align-items-center"
              onClick={() => setModalExecEngine(true)}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              <i className="la la-play mr-8"></i> Executar Motor em Empresa
            </button>
          </div>

          <div className="card card-default mb-20">
            <div className="card-body p-20">
              {/* FILTROS */}
              <div className="row mb-20 align-items-center">
                <div className="col-md-3 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i
                      className="la la-search position-absolute"
                      style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}
                    ></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Pesquisar..."
                      value={pesquisaOcorrencia}
                      onChange={(e) => setPesquisaOcorrencia(e.target.value)}
                      style={{ paddingLeft: 40, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroEmpresaOcorrencia}
                    onChange={(e) => setFiltroEmpresaOcorrencia(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todas as Empresas</option>
                    {empresasLista.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroSeveridadeOcorrencia}
                    onChange={(e) => setFiltroSeveridadeOcorrencia(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todas as Severidades</option>
                    <option value="ALTO">Alto</option>
                    <option value="MEDIO">Médio</option>
                    <option value="BAIXO">Baixo</option>
                    <option value="INFORMATIVO">Informativo</option>
                  </select>
                </div>

                <div className="col-md-2 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroEstadoOcorrencia}
                    onChange={(e) => setFiltroEstadoOcorrencia(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todos os Estados</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="CONFIRMADA">Confirmada</option>
                    <option value="FALSO_POSITIVO">Falso Positivo</option>
                    <option value="RESOLVIDA">Resolvida</option>
                  </select>
                </div>

                <div className="col-md-2 text-md-right text-muted" style={{ fontSize: 12 }}>
                  <strong>{ocorrenciasFiltradas.length}</strong> ocorrências
                </div>
              </div>

              {/* TABELA DE OCORRÊNCIAS */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th className="py-12">#</th>
                      <th>Empresa</th>
                      <th>Regra Fiscal</th>
                      <th>Período</th>
                      <th>Severidade</th>
                      <th>Valor Divergente</th>
                      <th>Estado</th>
                      <th className="text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocorrenciasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-40 text-muted">
                          Nenhuma ocorrência encontrada.
                        </td>
                      </tr>
                    ) : (
                      ocorrenciasFiltradas.map((occ) => (
                        <tr key={occ.id}>
                          <td className="py-12 fw-700 text-muted">#{occ.id}</td>
                          <td>
                            <div className="fw-700 text-dark">{occ.empresa_nome || `Empresa #${occ.empresa}`}</div>
                          </td>
                          <td>
                            <span className="badge badge-light border fw-600 mr-6">
                              {occ.regra_codigo || occ.regra?.codigo || 'REGRA'}
                            </span>
                            <span style={{ fontSize: 12 }}>{occ.regra_nome || occ.regra?.nome}</span>
                          </td>
                          <td>{occ.mes ? `${String(occ.mes).padStart(2, '0')}/${occ.ano}` : '—'}</td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor:
                                  occ.severidade === 'ALTO'
                                    ? '#ef4444'
                                    : occ.severidade === 'MEDIO'
                                    ? '#f59e0b'
                                    : '#10b981',
                                color: '#fff',
                                fontSize: 10,
                              }}
                            >
                              {occ.severidade}
                            </span>
                          </td>
                          <td>
                            <span className="fw-700 text-danger">
                              {occ.diferenca || occ.valor_envolvido ? kzComMoeda(occ.diferenca || occ.valor_envolvido) : '—'}
                            </span>
                          </td>
                          <td>
                            <select
                              className="form-control form-control-sm"
                              value={occ.estado}
                              onChange={(e) => mudarEstadoOcorrencia(occ, e.target.value)}
                              style={{ width: 130, fontSize: 11, borderRadius: 6, fontWeight: 600 }}
                            >
                              <option value="PENDENTE">PENDENTE</option>
                              <option value="CONFIRMADA">CONFIRMADA</option>
                              <option value="FALSO_POSITIVO">FALSO POSITIVO</option>
                              <option value="RESOLVIDA">RESOLVIDA</option>
                            </select>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              onClick={() => entrarNoEspacoEmpresa(occ.empresa)}
                              style={{ borderRadius: 6, padding: '4px 8px' }}
                              title="Auditar no espaço da empresa"
                            >
                              Auditar →
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 6: ARQUIVO CENTRAL DE FICHEIROS (DJANGO UPLOADS) */}
      {/* ==================================================== */}
      {abaAtiva === 'documentos' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
                Arquivo Central de Ficheiros Fiscais
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Gestão consolidada de ficheiros submetidos por todas as empresas (SAF-T, Balancetes, Modelo 7, DARs).
              </p>
            </div>
          </div>

          <div className="card card-default mb-20">
            <div className="card-body p-20">
              {/* FILTROS */}
              <div className="row mb-20 align-items-center">
                <div className="col-md-6 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i
                      className="la la-search position-absolute"
                      style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}
                    ></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Pesquisar por nome de ficheiro ou empresa..."
                      value={pesquisaDoc}
                      onChange={(e) => setPesquisaDoc(e.target.value)}
                      style={{ paddingLeft: 40, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroTipoDoc}
                    onChange={(e) => setFiltroTipoDoc(e.target.value)}
                    style={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  >
                    <option value="TODOS">Todos os Tipos</option>
                    <option value="BALANCETE">Balancete de Verificação</option>
                    <option value="MODELO7">Declaração Modelo 7</option>
                    <option value="SAFT">SAF-T AO (Facturação)</option>
                    <option value="RECIBO_AGT">DAR / Comprovativo AGT</option>
                  </select>
                </div>

                <div className="col-md-3 text-md-right text-muted" style={{ fontSize: 12 }}>
                  <strong>{documentosFiltrados.length}</strong> ficheiros arquivados
                </div>
              </div>

              {/* TABELA DE DOCUMENTOS */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th className="py-12">Ficheiro</th>
                      <th>Empresa</th>
                      <th>Tipo</th>
                      <th>Período</th>
                      <th>Data de Envio</th>
                      <th>Validação Estrita</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-40 text-muted">
                          Nenhum documento arquivado.
                        </td>
                      </tr>
                    ) : (
                      documentosFiltrados.map((doc) => (
                        <tr key={doc.id}>
                          <td className="py-12">
                            <div className="d-flex align-items-center">
                              <i className="la la-file-alt text-primary mr-10" style={{ fontSize: 20 }}></i>
                              <div>
                                <div className="fw-700 text-dark">{doc.nome_arquivo || doc.nome}</div>
                                {doc.tamanho && (
                                  <div className="text-muted" style={{ fontSize: 11 }}>
                                    {Math.round(doc.tamanho / 1024)} KB
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="fw-600 text-dark">{doc.empresa_nome || `Empresa #${doc.empresa}`}</span>
                          </td>
                          <td>
                            <span className="badge badge-light border" style={{ fontSize: 10 }}>
                              {doc.tipo}
                            </span>
                          </td>
                          <td>{doc.mes ? `${String(doc.mes).padStart(2, '0')}/${doc.ano}` : '—'}</td>
                          <td className="text-muted">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-AO') : '—'}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: doc.estado === 'VALIDADO' ? '#ecfdf5' : '#fef2f2',
                                color: doc.estado === 'VALIDADO' ? '#059669' : '#dc2626',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {doc.estado || 'PROCESSADO'}
                            </span>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-danger"
                              onClick={() => excluirDocumento(doc)}
                              style={{ borderRadius: 6, padding: '4px 8px' }}
                              title="Remover ficheiro (Apenas Super Admin)"
                            >
                              <i className="la la-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: CONFIGURAÇÕES GLOBAIS DO SISTEMA                */}
      {/* ==================================================== */}
      {abaAtiva === 'configuracoes' && (
        <form onSubmit={salvarConfiguracoesSistema}>
          {/* CABEÇALHO DA SECÇÃO */}
          <div className="card card-default mb-25">
            <div className="card-body" style={{ padding: '24px' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center">
                <div>
                  <h4 style={{ fontWeight: 700, margin: 0, color: '#272b41', display: 'flex', alignItems: 'center' }}>
                    <i className="la la-sliders-h mr-2" style={{ color: '#5f63f2', fontSize: 24 }}></i>
                    {t('admin.config.title', 'Configurações Gerais do Sistema')}
                  </h4>
                  <p className="text-muted mb-0 mt-1" style={{ fontSize: 13 }}>
                    {t('admin.config.subtitle', 'Definições da plataforma, parâmetros fiscais de referência AGT e alertas de segurança.')}
                  </p>
                </div>
                <div className="d-flex align-items-center mt-3 mt-md-0" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-outline-lighten btn-sm"
                    style={{ borderRadius: 6, fontWeight: 600, color: '#5a5f7d', borderColor: '#edf0f5' }}
                    onClick={restaurarPadroesAgt}
                  >
                    <i className="la la-undo mr-1"></i> Padrões AGT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={salvandoConfig}
                    style={{
                      borderRadius: 6,
                      backgroundColor: '#5f63f2',
                      borderColor: '#5f63f2',
                      fontWeight: 600,
                      padding: '8px 18px',
                    }}
                  >
                    <i className="la la-save mr-1"></i>
                    {salvandoConfig ? t('admin.config.saving', 'A guardar...') : t('admin.config.saveBtn', 'Guardar Configurações')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {/* CARD 1: IDENTIDADE DA PLATAFORMA */}
            <div className="col-lg-6 mb-25">
              <div className="card card-default h-100" style={{ borderRadius: 10 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f2f6' }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: '#272b41', display: 'flex', alignItems: 'center' }}>
                    <i className="la la-laptop-code mr-2" style={{ color: '#5f63f2', fontSize: 20 }}></i>
                    {t('admin.config.platformCardTitle', 'Identidade da Plataforma & Operação')}
                  </h6>
                </div>
                <div className="card-body" style={{ padding: '20px' }}>
                  <div className="form-group mb-3">
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                      {t('admin.config.systemName', 'Nome do Sistema / Plataforma')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={configuracoes.nome_sistema || ''}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, nome_sistema: e.target.value })}
                      placeholder="Ex: SCKJ - Sistema de Reconciliação Contabilística"
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.version', 'Versão / Release')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={configuracoes.versao_sistema || ''}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, versao_sistema: e.target.value })}
                        placeholder="v2.4.0"
                      />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.timezone', 'Fuso Horário Oficial')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={configuracoes.fuso_horario || 'Africa/Luanda (GMT+1)'}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, fuso_horario: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                      {t('admin.config.uploadLimit', 'Limite de Upload por Ficheiro (MB)')}
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        min="5"
                        max="200"
                        className="form-control"
                        value={configuracoes.limite_upload_mb || 50}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, limite_upload_mb: Number(e.target.value) })}
                      />
                      <div className="input-group-append">
                        <span className="input-group-text">MB</span>
                      </div>
                    </div>
                    <small className="text-muted">Aplica-se ao upload de SAF-T, Balancetes e Declarações fiscais.</small>
                  </div>

                  <div
                    className="p-3 mt-3"
                    style={{
                      backgroundColor: configuracoes.modo_manutencao ? '#fff1f0' : '#f8f9fc',
                      border: configuracoes.modo_manutencao ? '1px solid #ffa39e' : '1px solid #edf0f5',
                      borderRadius: 8,
                    }}
                  >
                    <div className="custom-control custom-switch">
                      <input
                        type="checkbox"
                        className="custom-control-input"
                        id="switchModoManutencao"
                        checked={Boolean(configuracoes.modo_manutencao)}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, modo_manutencao: e.target.checked })}
                      />
                      <label
                        className="custom-control-label"
                        htmlFor="switchModoManutencao"
                        style={{ fontWeight: 600, color: configuracoes.modo_manutencao ? '#cf1322' : '#272b41', cursor: 'pointer' }}
                      >
                        {t('admin.config.maintenanceMode', 'Modo de Manutenção do Sistema')}
                      </label>
                    </div>
                    <p className="text-muted mb-0 mt-1" style={{ fontSize: 12 }}>
                      {t('admin.config.maintenanceDesc', 'Quando ativo, restringe acessos a contabilistas para intervenções técnicas.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: PARÂMETROS FISCAIS AGT */}
            <div className="col-lg-6 mb-25">
              <div className="card card-default h-100" style={{ borderRadius: 10 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f2f6' }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: '#272b41', display: 'flex', alignItems: 'center' }}>
                    <i className="la la-landmark mr-2" style={{ color: '#20c997', fontSize: 20 }}></i>
                    {t('admin.config.taxBaselineTitle', 'Parâmetros Fiscais Globais (AGT Angola)')}
                  </h6>
                </div>
                <div className="card-body" style={{ padding: '20px' }}>
                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.vatRate', 'Taxa Geral do IVA (%)')}
                      </label>
                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="form-control"
                          value={configuracoes.taxa_iva_geral || 14.0}
                          onChange={(e) => setConfiguracoes({ ...configuracoes, taxa_iva_geral: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <small className="text-muted">Art. 12.º do Código do IVA (Lei n.º 7/19)</small>
                    </div>

                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.iiRetentionRate', 'Taxa Retenção Fonte Imposto Industrial (%)')}
                      </label>
                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="form-control"
                          value={configuracoes.taxa_retencao_fonte_ii || 6.5}
                          onChange={(e) => setConfiguracoes({ ...configuracoes, taxa_retencao_fonte_ii: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <small className="text-muted">Art. 67.º do Código do Imposto Industrial</small>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.inssCompanyRate', 'INSS Patronal - Empresa (%)')}
                      </label>
                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="form-control"
                          value={configuracoes.taxa_inss_patronal || 8.0}
                          onChange={(e) => setConfiguracoes({ ...configuracoes, taxa_inss_patronal: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <small className="text-muted">Quota entidade patronal (8%)</small>
                    </div>

                    <div className="col-md-6 form-group mb-3">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                        {t('admin.config.inssWorkerRate', 'INSS Trabalhador (%)')}
                      </label>
                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="form-control"
                          value={configuracoes.taxa_inss_trabalhador || 3.0}
                          onChange={(e) => setConfiguracoes({ ...configuracoes, taxa_inss_trabalhador: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <small className="text-muted">Desconto do trabalhador (3%)</small>
                    </div>
                  </div>

                  <div className="p-3" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                    <div className="d-flex align-items-center">
                      <i className="la la-calendar-check mr-2" style={{ color: '#16a34a', fontSize: 20 }}></i>
                      <strong style={{ fontSize: 12, color: '#166534' }}>Prazos Oficiais de Submissão e Liquidação</strong>
                    </div>
                    <ul className="mb-0 mt-2 pl-3" style={{ fontSize: 12, color: '#15803d' }}>
                      <li><strong>Segurança Social (INSS):</strong> Submissão de folha e pagamento até ao <strong>dia 10</strong> do mês seguinte.</li>
                      <li><strong>Declaração Modelo 7 (IVA):</strong> Submissão e liquidação até ao <strong>último dia</strong> do mês seguinte.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: ALERTAS DE RISCO FISCAL */}
            <div className="col-lg-6 mb-25">
              <div className="card card-default h-100" style={{ borderRadius: 10 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f2f6' }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: '#272b41', display: 'flex', alignItems: 'center' }}>
                    <i className="la la-bell mr-2" style={{ color: '#fa8b0c', fontSize: 20 }}></i>
                    {t('admin.config.alertsTitle', 'Monitorização & Alertas de Risco Fiscal')}
                  </h6>
                </div>
                <div className="card-body" style={{ padding: '20px' }}>
                  <div className="form-group mb-3">
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                      {t('admin.config.riskThreshold', 'Limite Crítico de Risco por Empresa (Kz)')}
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        step="100000"
                        min="0"
                        className="form-control"
                        value={configuracoes.limite_alerta_risco_kz || 5000000}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, limite_alerta_risco_kz: parseFloat(e.target.value) || 0 })}
                      />
                      <div className="input-group-append">
                        <span className="input-group-text">Kz</span>
                      </div>
                    </div>
                    <small className="text-muted">
                      Empresas com divergências acumuladas superiores a este valor acionam alerta vermelho de severidade CRÍTICA.
                    </small>
                  </div>

                  <div className="form-group mb-3">
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>
                      {t('admin.config.alertEmail', 'Email para Envio de Alertas e Relatórios')}
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      value={configuracoes.email_alertas_fiscal || ''}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, email_alertas_fiscal: e.target.value })}
                      placeholder="auditoria@sckj.co.ao"
                    />
                  </div>

                  <div className="p-3" style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
                    <div className="custom-control custom-checkbox">
                      <input
                        type="checkbox"
                        className="custom-control-input"
                        id="chkNotificacoesEmail"
                        checked={Boolean(configuracoes.notificacoes_email_ativas)}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, notificacoes_email_ativas: e.target.checked })}
                      />
                      <label
                        className="custom-control-label"
                        htmlFor="chkNotificacoesEmail"
                        style={{ fontWeight: 600, color: '#d46b08', cursor: 'pointer' }}
                      >
                        {t('admin.config.emailAlerts', 'Notificações Automáticas de Incumprimento')}
                      </label>
                    </div>
                    <small className="text-muted d-block mt-1">
                      Dispara alertas quando uma empresa atinge risco crítico ou aproxima-se dos prazos sem declaração enviada.
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: SESSÃO DO ADMINISTRADOR MASTER */}
            <div className="col-lg-6 mb-25">
              <div className="card card-default h-100" style={{ borderRadius: 10 }}>
                <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f2f6' }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: '#272b41', display: 'flex', alignItems: 'center' }}>
                    <i className="la la-user-shield mr-2" style={{ color: '#5f63f2', fontSize: 20 }}></i>
                    {t('admin.config.adminProfileTitle', 'Sessão do Administrador Ativo')}
                  </h6>
                </div>
                <div className="card-body" style={{ padding: '20px' }}>
                  <div className="d-flex align-items-center mb-4">
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        backgroundColor: '#eff0f6',
                        color: '#5f63f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 26,
                        fontWeight: 700,
                        marginRight: 16,
                      }}
                    >
                      <i className="la la-user-tie"></i>
                    </div>
                    <div>
                      <h6 style={{ margin: 0, fontWeight: 700, color: '#272b41', fontSize: 16 }}>
                        {userAtivo.first_name || userAtivo.username || 'Super Administrador'}
                      </h6>
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        {userAtivo.email || 'admin@sistema.local'}
                      </span>
                      <div className="mt-1">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#eff2f7',
                            color: '#5f63f2',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                          }}
                        >
                          <i className="la la-shield-alt mr-1"></i> Super Admin Master
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 mb-3" style={{ backgroundColor: '#f8f9fc', border: '1px solid #edf0f5', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#5a5f7d', lineHeight: 1.6 }}>
                      <i className="la la-info-circle mr-1 text-primary"></i>
                      {t('admin.config.editInUsersTab', 'Para alterar a senha ou dados do seu utilizador, aceda à aba Utilizadores.')}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-block"
                    onClick={() => mudarAba('utilizadores')}
                    style={{ borderRadius: 6, fontWeight: 600 }}
                  >
                    <i className="la la-users-cog mr-1"></i> Gerir Utilizadores & Credenciais
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÃO INFERIOR */}
          <div className="card card-default mb-25">
            <div className="card-body py-16 px-24 d-flex justify-content-end align-items-center" style={{ gap: 12 }}>
              <button
                type="button"
                className="btn btn-outline-lighten"
                style={{ borderRadius: 6, fontWeight: 600, color: '#5a5f7d', borderColor: '#edf0f5' }}
                onClick={restaurarPadroesAgt}
              >
                <i className="la la-undo mr-1"></i> Padrões AGT Angola 2026
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={salvandoConfig}
                style={{
                  borderRadius: 6,
                  backgroundColor: '#5f63f2',
                  borderColor: '#5f63f2',
                  fontWeight: 600,
                  padding: '10px 24px',
                }}
              >
                <i className="la la-save mr-1"></i>
                {salvandoConfig ? t('admin.config.saving', 'A guardar...') : t('admin.config.saveBtn', 'Guardar Configurações')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ==================================================== */}
      {/* ABA: COMPÊNDIO INTEGRAL DO PGC (DECRETO N.º 82/01) */}
      {/* ==================================================== */}
      {abaAtiva === 'pgc' && <PgcView />}

      {/* ==================================================== */}
      {/* MODAL DE EMPRESA (DJANGO ADMIN COMPLETO)             */}
      {/* ==================================================== */}
      {modalEmpresaAberto && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-white border-bottom py-16 px-24">
                <h5 className="modal-title fw-700 text-dark">
                  {empresaEmEdicao ? `Editar Empresa: ${empresaEmEdicao.nome}` : 'Cadastrar Nova Empresa Cliente'}
                </h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => setModalEmpresaAberto(false)}
                  style={{ fontSize: 24 }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={salvarEmpresa}>
                <div className="modal-body p-24" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                  {/* SECÇÃO 1: IDENTIFICAÇÃO FISCAL */}
                  <h6 className="fw-700 text-primary text-uppercase mb-12" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                    1. Identificação Fiscal & Legal
                  </h6>
                  <div className="row mb-15">
                    <div className="col-md-7 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Nome / Razão Social *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA"
                        value={formEmpresa.nome}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, nome: e.target.value })}
                        required
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        NIF (Número de Identificação Fiscal) *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: 5001234567"
                        value={formEmpresa.nif}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, nif: e.target.value })}
                        required
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div className="row mb-20">
                    <div className="col-md-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Nome Comercial / Insígnia
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: Grupo SCKJ Angola"
                        value={formEmpresa.nome_comercial}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, nome_comercial: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Tipo de Entidade
                      </label>
                      <select
                        className="form-control"
                        value={formEmpresa.tipo_entidade}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, tipo_entidade: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        <option value="SQ">Sociedade por Quotas (Lda)</option>
                        <option value="SA">Sociedade Anónima (SA)</option>
                        <option value="UNIPESSOAL">Unipessoal (SU)</option>
                        <option value="ENI">Empresário em Nome Individual</option>
                      </select>
                    </div>
                    <div className="col-md-3 col-sm-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Estado Operacional
                      </label>
                      <select
                        className="form-control"
                        value={formEmpresa.estado}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, estado: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        <option value="ATIVA">Ativa</option>
                        <option value="INATIVA">Inativa</option>
                        <option value="SUSPENSA">Suspensa</option>
                        <option value="ENCERRADA">Encerrada</option>
                      </select>
                    </div>
                  </div>

                  <div className="row mb-20">
                    <div className="col-md-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Data de Constituição (Opcional)
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formEmpresa.data_constituicao || ''}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, data_constituicao: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Data de Início de Atividade (Opcional)
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formEmpresa.data_inicio_atividade || ''}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, data_inicio_atividade: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* SECÇÃO 2: REGIME DE IVA & VOLUME DE NEGÓCIOS */}
                  <h6 className="fw-700 text-primary text-uppercase mb-12" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                    2. Enquadramento no IVA & Volume de Negócios
                  </h6>
                  <div className="row mb-20">
                    <div className="col-md-4 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Regime de IVA
                      </label>
                      <select
                        className="form-control"
                        value={formEmpresa.regime_iva}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, regime_iva: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        <option value="GERAL">Regime Geral (Taxa 14%)</option>
                        <option value="SIMPLIFICADO">Regime Simplificado (Taxa 7%)</option>
                        <option value="EXCLUSAO">Regime de Exclusão (Isento)</option>
                      </select>
                    </div>
                    <div className="col-md-5 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Volume de Negócios Anual (Kz)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: 50000000.00"
                        value={formEmpresa.volume_negocios_anual}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, volume_negocios_anual: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Ano de Referência
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formEmpresa.ano_volume_negocios}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, ano_volume_negocios: Number(e.target.value) })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* SECÇÃO 3: LOCALIZAÇÃO & CONTACTOS */}
                  <h6 className="fw-700 text-primary text-uppercase mb-12" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                    3. Localização & Contactos
                  </h6>
                  <div className="row mb-15">
                    <div className="col-md-4 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Província
                      </label>
                      <select
                        className="form-control"
                        value={formEmpresa.provincia}
                        onChange={(e) => {
                          const novaProv = e.target.value;
                          setFormEmpresa({ ...formEmpresa, provincia: novaProv });
                        }}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        {PROVINCIAS_ANGOLA.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Município
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        list="lista-sugestoes-municipios"
                        placeholder="Ex: Belas / Viana / Luanda"
                        value={formEmpresa.municipio}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, municipio: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                      <datalist id="lista-sugestoes-municipios">
                        {(MUNICIPIOS_POR_PROVINCIA[formEmpresa.provincia] || []).map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Telefone
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="+244 9..."
                        value={formEmpresa.telefone}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, telefone: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div className="row mb-20">
                    <div className="col-md-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Email Corporativo
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="contato@empresa.co.ao"
                        value={formEmpresa.email}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, email: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Endereço / Sede
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Rua, Bairro, Edifício"
                        value={formEmpresa.endereco}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, endereco: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* SECÇÃO 4: DADOS DO CONTABILISTA RESPONSÁVEL */}
                  <h6 className="fw-700 text-primary text-uppercase mb-12" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                    4. Contabilista Responsável (OCPCA)
                  </h6>
                  <div className="row">
                    <div className="col-md-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Nome do Contabilista
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nome do contabilista credenciado"
                        value={formEmpresa.contabilista_nome}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, contabilista_nome: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Contacto do Contabilista
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Telefone / Email"
                        value={formEmpresa.contabilista_contacto}
                        onChange={(e) => setFormEmpresa({ ...formEmpresa, contabilista_contacto: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-12 px-24">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModalEmpresaAberto(false)}
                    disabled={salvandoEmpresa}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={salvandoEmpresa}
                    style={{ backgroundColor: '#5f63f2', borderColor: '#5f63f2', fontWeight: 600 }}
                  >
                    {salvandoEmpresa ? 'A guardar...' : empresaEmEdicao ? 'Guardar Alterações' : 'Criar Empresa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL DE UTILIZADOR (DJANGO USER + ACESSOS)          */}
      {/* ==================================================== */}
      {modalUserAberto && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-white border-bottom py-16 px-24">
                <h5 className="modal-title fw-700 text-dark">
                  {userEmEdicao
                    ? t('admin.users.modalEditTitle', 'Editar Utilizador: {{username}}', { username: userEmEdicao.username })
                    : t('admin.users.modalCreateTitle', 'Criar Novo Utilizador')}
                </h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => setModalUserAberto(false)}
                  style={{ fontSize: 24 }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={salvarUser}>
                <div className="modal-body p-24">
                  <div className="row mb-12">
                    <div className="col-md-6 mb-10 mb-md-0">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        {t('admin.users.firstNameLabel', 'Primeiro Nome')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Primeiro nome"
                        value={formUser.first_name}
                        onChange={(e) => setFormUser({ ...formUser, first_name: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        {t('admin.users.lastNameLabel', 'Sobrenome')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Último nome"
                        value={formUser.last_name}
                        onChange={(e) => setFormUser({ ...formUser, last_name: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div className="mb-12">
                    <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                      {t('admin.users.usernameLabel', 'Nome de Utilizador (Username)')} *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ex: carlos.contabilista"
                      value={formUser.username}
                      onChange={(e) => setFormUser({ ...formUser, username: e.target.value })}
                      required
                      disabled={Boolean(userEmEdicao)}
                      style={{ borderRadius: 6, fontSize: 13 }}
                    />
                  </div>

                  <div className="mb-12">
                    <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                      {t('admin.users.emailLabel', 'Email')}
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="utilizador@empresa.co.ao"
                      value={formUser.email}
                      onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                      style={{ borderRadius: 6, fontSize: 13 }}
                    />
                  </div>

                  <div className="mb-12">
                    <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                      {userEmEdicao
                        ? t('admin.users.passwordKeepBlank', 'Nova Palavra-passe (deixe em branco para não alterar)')
                        : `${t('admin.users.passwordLabel', 'Palavra-passe')} *`}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder={userEmEdicao ? '••••••••' : 'Mínimo 8 caracteres'}
                      value={formUser.password}
                      onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                      required={!userEmEdicao}
                      style={{ borderRadius: 6, fontSize: 13 }}
                    />
                  </div>

                  <div className="mb-15">
                    <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                      {t('admin.users.roleLabel', 'Papel no Sistema')}
                    </label>
                    <select
                      className="form-control"
                      value={formUser.papel}
                      onChange={(e) => setFormUser({ ...formUser, papel: e.target.value })}
                      style={{ borderRadius: 6, fontSize: 13 }}
                    >
                      <option value="Super Admin">Super Admin ({t('admin.users.fullMasterAccess', 'Acesso Total Root')})</option>
                      <option value="Administrador">{t('admin.users.roleAdmin', 'Administrador')}</option>
                      <option value="Auditor">{t('admin.users.roleAuditor', 'Auditor')}</option>
                      <option value="Fiscalista">{t('admin.users.roleTaxSpecialist', 'Fiscalista')}</option>
                      <option value="Contabilista">{t('admin.users.roleAccountant', 'Contabilista')}</option>
                      <option value="Consulta">{t('admin.users.roleReadOnly', 'Consulta')}</option>
                    </select>
                  </div>

                  {/* VÍNCULO A EMPRESAS (EMPRESAUTILIZADOR) */}
                  <div className="mb-10">
                    <label className="form-label fw-600 mb-6 d-block" style={{ fontSize: 12 }}>
                      {t('admin.users.companiesAccessHelp', 'Empresas com Acesso Permitido:')}
                    </label>
                    <div
                      className="border rounded p-10"
                      style={{ maxHeight: 150, overflowY: 'auto', backgroundColor: '#f8fafc' }}
                    >
                      {empresasLista.map((emp) => {
                        const checked = formUser.empresas_ids.includes(emp.id);
                        return (
                          <div key={emp.id} className="custom-control custom-checkbox mb-6">
                            <input
                              type="checkbox"
                              className="custom-control-input"
                              id={`check-emp-${emp.id}`}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormUser({ ...formUser, empresas_ids: [...formUser.empresas_ids, emp.id] });
                                } else {
                                  setFormUser({
                                    ...formUser,
                                    empresas_ids: formUser.empresas_ids.filter((id) => id !== emp.id),
                                  });
                                }
                              }}
                            />
                            <label
                              className="custom-control-label fw-600 text-dark"
                              htmlFor={`check-emp-${emp.id}`}
                              style={{ fontSize: 12, cursor: 'pointer' }}
                            >
                              {emp.nome} <span className="text-muted fw-400">({emp.nif})</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-12 px-24">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModalUserAberto(false)}
                    disabled={salvandoUser}
                  >
                    {t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={salvandoUser}
                    style={{ backgroundColor: '#5f63f2', borderColor: '#5f63f2', fontWeight: 600 }}
                  >
                    {salvandoUser
                      ? t('admin.users.saving', 'A guardar...')
                      : userEmEdicao
                      ? t('common.save', 'Guardar Alterações')
                      : t('admin.users.saveUser', 'Salvar Utilizador')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL DE EXECUÇÃO DE MOTOR DE REGRAS                */}
      {/* ==================================================== */}
      {modalExecEngine && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-white border-bottom py-16 px-24">
                <h5 className="modal-title fw-700 text-dark">
                  Executar Motor de Auditoria Fiscal
                </h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => setModalExecEngine(false)}
                  style={{ fontSize: 24 }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={executarMotorParaEmpresa}>
                <div className="modal-body p-24">
                  <p className="text-muted mb-15" style={{ fontSize: 13 }}>
                    O Rule Engine avaliará as regras ativas de IVA, IRT, Imposto Industrial e Segurança Social sobre os ficheiros e declarações do período.
                  </p>

                  <div className="mb-15">
                    <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                      Empresa Alvo *
                    </label>
                    <select
                      className="form-control"
                      value={formExecEngine.empresa_id}
                      onChange={(e) => setFormExecEngine({ ...formExecEngine, empresa_id: e.target.value })}
                      required
                      style={{ borderRadius: 6, fontSize: 13 }}
                    >
                      <option value="">Selecione a empresa...</option>
                      {empresasLista.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome} (NIF: {e.nif})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row">
                    <div className="col-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Ano
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formExecEngine.ano}
                        onChange={(e) => setFormExecEngine({ ...formExecEngine, ano: Number(e.target.value) })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-600 mb-4" style={{ fontSize: 12 }}>
                        Mês
                      </label>
                      <select
                        className="form-control"
                        value={formExecEngine.mes}
                        onChange={(e) => setFormExecEngine({ ...formExecEngine, mes: Number(e.target.value) })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>
                            {String(m).padStart(2, '0')} - Período {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-12 px-24">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setModalExecEngine(false)}
                    disabled={executandoEngine}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={executandoEngine}
                    style={{ backgroundColor: '#5f63f2', borderColor: '#5f63f2', fontWeight: 600 }}
                  >
                    {executandoEngine ? 'A executar motores...' : 'Iniciar Auditoria'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminGestao;
