import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
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

export const authService = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
};

export const empresaService = {
  getAll: (params) => api.get('/empresas/', { params }),
  getById: (id) => api.get(`/empresas/${id}/`),
  create: (data) => api.post('/empresas/', data),
  update: (id, data) => api.put(`/empresas/${id}/`, data),
  delete: (id) => api.delete(`/empresas/${id}/`),
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

export default api;
