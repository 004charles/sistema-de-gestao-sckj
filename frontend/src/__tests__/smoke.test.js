/**
 * Smoke test das quatro páginas do sistema.
 *
 * Cobre também os endereços antigos: a consolidação de seis páginas em quatro
 * não pode partir links guardados nem o histórico de quem já usava o sistema.
 *
 * @jest-environment jsdom
 */
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
  API_BASE: 'http://localhost:8000/api',
  authHeaders: () => ({}),
  authService: { login: jest.fn() },
  empresaService: { getAll: jest.fn(), getById: jest.fn() },
  contabilidadeService: { getAll: jest.fn(), create: jest.fn(), importar: jest.fn() },
  declaracaoAgtService: { getAll: jest.fn(), create: jest.fn(), importar: jest.fn() },
  reconciliacaoService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    executar: jest.fn(),
    getDetalhes: jest.fn(),
  },
  dashboardService: { getData: jest.fn() },
  relatorioService: { getResumo: jest.fn() },
  pgcService: { getPgc: jest.fn(() => Promise.resolve({ data: { classes: [], contas: [], principios: [], criterios_valorimetria: [], notas_anexo: [] } })), exportarPgcExcel: jest.fn() },
  legislacaoService: {
    getLegislacao: jest.fn(() => Promise.resolve({ data: { diplomas: [], codigos_disponiveis: [] } })),
    exportarExcel: jest.fn(() => Promise.resolve({ data: new Blob() })),
  },
  lancamentoService: {
    getAll: jest.fn(() => Promise.resolve({ data: [] })),
    create: jest.fn(() => Promise.resolve({ data: {} })),
    getRazao: jest.fn(() => Promise.resolve({ data: { contas: [] } })),
    getBalanceteGerado: jest.fn(() => Promise.resolve({ data: { classes: [], totais: { debito: 0, credito: 0, saldo_devedor: 0, saldo_credor: 0 } } })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
  adminService: { getPgc: jest.fn(() => Promise.resolve({ data: { classes: [], contas: [], principios: [], criterios_valorimetria: [], notas_anexo: [] } })), exportarPgcExcel: jest.fn(), registrarTentativa: jest.fn(() => Promise.resolve()) },
  aiService: {
    analiseReconciliacao: jest.fn(),
    analiseEmpresa: jest.fn(),
    chat: jest.fn(),
  },
}));

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import i18n from '../i18n';
import App from '../App';
import api, {
  authService,
  empresaService,
  contabilidadeService,
  declaracaoAgtService,
  reconciliacaoService,
  dashboardService,
  relatorioService,
  aiService,
  pgcService,
  legislacaoService,
  lancamentoService,
} from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

/** Resposta mínima de `/numeros/`, no formato que a página de Auditoria lê. */
const NUMEROS = {
  empresa: 1,
  empresa_nome: 'Empresa Teste',
  ano: 2026,
  mes: 7,
  em_risco: '61928.16',
  contadores: { erros: 3, ok: 9, faltam: 2, informativos: 0 },
  gravidade: { alto: 1, medio: 2, baixo: 0 },
  linhas: [],
  prazos: { total: 0, obrigacoes: [], proxima: null },
  cobertura: { percentagem: 50, nivel: 'PARCIAL', em_falta: [], disclaimer: '' },
};

const renderAt = async (path) => {
  window.history.pushState({}, '', path);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  return {
    text: container.textContent,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
};

beforeAll(async () => {
  await i18n.changeLanguage('pt');
  localStorage.setItem('user', JSON.stringify({ username: 'tester', is_admin: true }));
});

beforeEach(() => {
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data: String(url).includes('/numeros/') ? NUMEROS : [],
    })
  );
  api.post.mockResolvedValue({ data: { success: true } });
  api.put.mockResolvedValue({ data: { success: true } });
  api.patch.mockResolvedValue({ data: { success: true } });
  api.delete.mockResolvedValue({ data: { success: true } });
  authService.login.mockResolvedValue({ data: { user: { token: 'mock' } } });
  empresaService.getAll.mockResolvedValue({ data: [] });
  empresaService.getById.mockResolvedValue({ data: {} });
  contabilidadeService.getAll.mockResolvedValue({ data: [] });
  declaracaoAgtService.getAll.mockResolvedValue({ data: [] });
  reconciliacaoService.getAll.mockResolvedValue({ data: [] });
  reconciliacaoService.getDetalhes.mockResolvedValue({ data: [] });
  dashboardService.getData.mockResolvedValue({ data: {} });
  relatorioService.getResumo.mockResolvedValue({ data: [] });
  aiService.analiseReconciliacao.mockResolvedValue({ data: {} });
  aiService.analiseEmpresa.mockResolvedValue({ data: {} });
  aiService.chat.mockResolvedValue({ data: {} });
  pgcService.getPgc.mockResolvedValue({ data: { classes: [], contas: [], principios: [], criterios_valorimetria: [], notas_anexo: [] } });
  legislacaoService.getLegislacao.mockResolvedValue({ data: { diplomas: [], codigos_disponiveis: [] } });
  legislacaoService.exportarExcel.mockResolvedValue({ data: new Blob() });
  lancamentoService.getAll.mockResolvedValue({ data: [] });
  lancamentoService.create.mockResolvedValue({ data: {} });
  lancamentoService.getRazao.mockResolvedValue({ data: { contas: [] } });
  lancamentoService.getBalanceteGerado.mockResolvedValue({ data: { classes: [], totais: { debito: 0, credito: 0, saldo_devedor: 0, saldo_credor: 0 } } });
  lancamentoService.delete.mockResolvedValue({ data: {} });
});

test('login renderiza com o template', async () => {
  const page = await renderAt('/login');
  expect(page.text).toContain('Use sua conta para acessar o sistema');
  expect(page.text).toContain('Entrar');
  await page.unmount();
});

test('visitante desautenticado vai para o login', async () => {
  localStorage.removeItem('user');
  try {
    const page = await renderAt('/auditoria');
    expect(page.text).toContain('Use sua conta para acessar o sistema');
    await page.unmount();
  } finally {
    localStorage.setItem('user', JSON.stringify({ username: 'tester', is_admin: true }));
  }
});

test('empresa cliente (nao-admin) e redirecionada para arquivo', async () => {
  localStorage.setItem('user', JSON.stringify({ username: 'empresa_cliente', is_admin: false, is_staff: false }));
  try {
    const page = await renderAt('/auditoria');
    expect(page.text).toContain('Documentos');
    await page.unmount();
  } finally {
    localStorage.setItem('user', JSON.stringify({ username: 'tester', is_admin: true }));
  }
});

test('navegacao mostra o menu das paginas contabilistas', async () => {
  const page = await renderAt('/arquivo');
  expect(page.text).toContain('Documentos');
  expect(page.text).toContain('Confronto');
  expect(page.text).toContain('Plano de Contas');
  expect(page.text).toContain('Legislação Fiscal');
  expect(page.text).toContain('Definições');
  await page.unmount();
});

test.each([
  ['/arquivo'],
  ['/confronto'],
  ['/reconciliacao'],
  ['/diario'],
  ['/razao'],
  ['/balancete'],
  ['/lancamentos'],
  ['/pgc'],
  ['/legislacao'],
  ['/definicoes'],
])('página %s renderiza sem erros', async (path) => {
  const page = await renderAt(path);
  expect(page.text.length).toBeGreaterThan(50);
  await page.unmount();
});

test.each([
  ['/dashboard', 'Documentos'],
  ['/motores', 'Confronto'],
  ['/reconciliacao', 'Confronto'],
  ['/documentos', 'Documentos'],
  ['/plano-contas', 'Plano Geral de Contabilidade'],
  ['/relatorios', 'Confronto'],
  ['/relatorio', 'Confronto'],
  ['/empresas', 'Definições'],
  ['/configuracoes', 'Definições'],
  ['/perfil', 'Definições'],
])('endereço antigo %s continua a abrir', async (path, esperado) => {
  const page = await renderAt(path);
  expect(page.text).toContain(esperado);
  await page.unmount();
});

test('menu traduz em pt, en e zh', async () => {
  await i18n.changeLanguage('en');
  let page = await renderAt('/arquivo');
  expect(page.text).toContain('Documents & Files');
  expect(page.text).toContain('Accounting vs AGT Confrontation');
  await page.unmount();

  await i18n.changeLanguage('zh');
  page = await renderAt('/arquivo');
  expect(page.text).toContain('文件与档案');
  expect(page.text).toContain('会计与AGT税务对账');
  await page.unmount();

  await i18n.changeLanguage('pt');
  page = await renderAt('/arquivo');
  expect(page.text).toContain('Documentos & Ficheiros');
  expect(page.text).toContain('Confronto Contabilidade vs AGT');
  expect(page.text).toContain('Definições da Empresa');
  await page.unmount();
});
