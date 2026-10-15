import axios from 'axios';

/**
 * Endereço da API.
 *
 * A versão anterior forçava a porta 8000 sempre que o host não fosse
 * localhost, ignorando `REACT_APP_API_URL`. Isso partia dois cenários: o
 * deploy Vercel/Render descrito no README (o frontend chamava
 * `https://dominio:8000/api`, que não existe) e qualquer backend local
 * noutra porta — como o `runserver 0.0.0.0:8080` usado aqui.
 *
 * Ordem agora: configuração explícita > porta de desenvolvimento > mesma
 * origem. Nunca se inventa uma porta num host remoto.
 */
const PORTA_DEV_PADRAO = process.env.REACT_APP_API_PORT || '8000';

export const getApiBaseUrl = () => {
  // 1. Configuração explícita ganha sempre — inclusive em produção.
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    const { protocol, hostname, port, origin } = window.location;
    // 2. Em desenvolvimento local ou em rede local (LAN), o backend Django está na porta 8000
    const isLocalOrLAN =
      port === '3000' ||
      port === '3001' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isLocalOrLAN) {
      return `${protocol}//${hostname}:${PORTA_DEV_PADRAO}/api`;
    }
    // 3. Em produção na nuvem com reverse proxy ou mesma origem
    return `${origin}/api`;
  }

  return 'http://127.0.0.1:8000/api';
};

export const API_URL = getApiBaseUrl();
export const API_BASE = API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      if (userData.token) {
        config.headers.Authorization = `Token ${userData.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authHeaders = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user && user.token ? { Authorization: `Token ${user.token}` } : {};
  } catch {
    return {};
  }
};

export const authService = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
};

export const empresaService = {
  getAll: (params) => api.get('/empresas/', { params }),
  getById: (id) => api.get(`/empresas/${id}/`),
  create: (data) => api.post('/empresas/', data),
  update: (id, data) => api.put(`/empresas/${id}/`, data),
  patch: (id, data) => api.patch(`/empresas/${id}/`, data),
  delete: (id) => api.delete(`/empresas/${id}/`),
};

export const adminService = {
  getEstatisticas: () => api.get('/admin/estatisticas/'),
  getUtilizadores: () => api.get('/admin/utilizadores/'),
  createUtilizador: (data) => api.post('/admin/utilizadores/', data),
  updateUtilizador: (id, data) => api.put(`/admin/utilizadores/${id}/`, data),
  patchUtilizador: (id, data) => api.patch(`/admin/utilizadores/${id}/`, data),
  deleteUtilizador: (id) => api.delete(`/admin/utilizadores/${id}/`),
  getRegras: (params) => api.get('/regras/', { params }),
  updateRegra: (id, data) => api.patch(`/regras/${id}/`, data),
  getOcorrencias: (params) => api.get('/ocorrencias/', { params }),
  updateOcorrencia: (id, data) => api.patch(`/ocorrencias/${id}/`, data),
  executarOcorrencias: (data) => api.post('/ocorrencias/executar/', data),
  getDocumentos: (params) => api.get('/documentos/listar/', { params }),
  deleteDocumento: (id) => api.delete(`/documentos/${id}/`),
  getConfiguracoes: () => api.get('/admin/configuracoes/'),
  updateConfiguracoes: (data) => api.post('/admin/configuracoes/', data),
  registrarTentativa: (data) => api.post('/admin/registro-tentativa/', data),
  getRegistrosAcesso: () => api.get('/admin/registros-acesso/'),
  getPgc: (params) => api.get('/admin/pgc/', { params }),
  exportarPgcExcel: () => api.get('/admin/pgc/exportar-excel/', { responseType: 'blob' }),
};

export const pgcService = {
  getPgc: (params) => api.get('/pgc/', { params }),
  exportarPgcExcel: () => api.get('/pgc/exportar-excel/', { responseType: 'blob' }),
};

export const legislacaoService = {
  getLegislacao: (params) => api.get('/legislacao/', { params }),
  exportarExcel: () => api.get('/legislacao/exportar-excel/', { responseType: 'blob' }),
};

export const lancamentoService = {
  getAll: (params) => api.get('/contabilidade/lancamentos/', { params }),
  getById: (id) => api.get(`/contabilidade/lancamentos/${id}/`),
  create: (data) => api.post('/contabilidade/lancamentos/', data),
  update: (id, data) => api.put(`/contabilidade/lancamentos/${id}/`, data),
  patch: (id, data) => api.patch(`/contabilidade/lancamentos/${id}/`, data),
  delete: (id) => api.delete(`/contabilidade/lancamentos/${id}/`),
  getRazao: (params) => api.get('/contabilidade/razao/', { params }),
  getBalanceteGerado: (params) => api.get('/contabilidade/balancete-gerado/', { params }),
};

export const contabilidadeService = {
  getAll: (params) => api.get('/contabilidade/', { params }),
  create: (data) => api.post('/contabilidade/', data),
  importar: (data) => api.post('/contabilidade/importar/', data),
};

export const declaracaoAgtService = {
  getAll: (params) => api.get('/declaracoes-agt/', { params }),
  create: (data) => api.post('/declaracoes-agt/', data),
  importar: (data) => api.post('/declaracoes-agt/importar/', data),
};

export const reconciliacaoService = {
  getAll: (params) => api.get('/reconciliacoes/', { params }),
  getById: (id) => api.get(`/reconciliacoes/${id}/`),
  executar: (data) => api.post('/reconciliacoes/executar/', data),
  getDetalhes: (reconciliacaoId) => api.get('/reconciliacao-detalhes/', { params: { reconciliacao_id: reconciliacaoId } }),
};

export const dashboardService = {
  getData: (empresaId) => api.get(`/dashboard/${empresaId}/`),
};

export const relatorioService = {
  getResumo: () => api.get('/relatorios/resumo/'),
};

export const aiService = {
  analiseReconciliacao: (reconciliacaoId) =>
    api.post('/ai/analise-reconciliacao/', { reconciliacao_id: reconciliacaoId }),
  analiseEmpresa: (empresaId, ano, mes) =>
    api.post('/ai/analise-empresa/', { empresa_id: empresaId, ano, mes }),
  chat: (mensagem, contextoTipo, contextoId) =>
    api.post('/ai/chat/', { mensagem, contexto_tipo: contextoTipo, contexto_id: contextoId }),
};

export const auditoriaService = {
  getRasto: (empresaId, ano, mes) => api.get(`/auditoria/${empresaId}/${ano}/${mes}/rasto/`),
  getParecer: (empresaId, ano, mes) => api.get(`/auditoria/${empresaId}/${ano}/${mes}/parecer/`),
  gerarParecer: (empresaId, ano, mes) => api.post(`/auditoria/${empresaId}/${ano}/${mes}/parecer/`),
};

export const analiseService = {
  analisarDocumentos: (docContabId, docAgtId, idioma = 'pt') =>
    api.post('/analises/analise-documentos/', {
      documento_contabilidade_id: docContabId,
      documento_agt_id: docAgtId,
      idioma,
    }),
  getHistorico: () => api.get('/analises/historico/'),
  deleteAnalise: (id) => api.delete(`/analises/historico/${id}/`),
  exportarExcel: (analiseId, payload = {}) => {
    if (analiseId) {
      return api.get(`/analises/${analiseId}/exportar-excel/`, { responseType: 'blob' });
    }
    return api.post('/analises/exportar-excel/', payload, { responseType: 'blob' });
  },
};

export const consolidacaoService = {
  getConsolidacao: (empresaId, ano) => api.get(`/consolidacao-anual/${empresaId}/${ano}/`),
  exportarExcel: (empresaId, ano) =>
    api.get(`/consolidacao-anual/${empresaId}/${ano}/exportar-excel/`, { responseType: 'blob' }),
};

export const facturaService = {
  scanFactura: (formData) =>
    api.post('/facturas/scan/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listar: (params = {}) => api.get('/facturas/', { params }),
  lancarNoDiario: (facturaId) => api.post(`/facturas/${facturaId}/lancar/`),
  excluir: (facturaId) => api.delete(`/facturas/${facturaId}/`),
  exportarExcel: (params = {}) =>
    api.get('/facturas/exportar-excel/', { params, responseType: 'blob' }),
};

export default api;

