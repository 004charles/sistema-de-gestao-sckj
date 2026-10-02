/**
 * Smoke test: verifica que as rotas renderizam com o novo template
 * (StrikingDash/Bootstrap) sem erros.
 *
 * @jest-environment jsdom
 */
jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
  authHeaders: () => ({}),
  authService: {
    login: jest.fn(),
  },
  empresaService: {
    getAll: jest.fn(),
    getById: jest.fn(),
  },
  contabilidadeService: {
    getAll: jest.fn(),
    create: jest.fn(),
    importar: jest.fn(),
  },
  declaracaoAgtService: {
    getAll: jest.fn(),
    create: jest.fn(),
    importar: jest.fn(),
  },
  reconciliacaoService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    executar: jest.fn(),
    getDetalhes: jest.fn(),
  },
  dashboardService: {
    getData: jest.fn(),
  },
  relatorioService: {
    getResumo: jest.fn(),
  },
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
} from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

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
  localStorage.setItem('user', JSON.stringify({ username: 'tester' }));
});

beforeEach(() => {
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: { success: true } });
  api.put.mockResolvedValue({ data: { success: true } });
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
});

test('login renderiza com o template', async () => {
  const page = await renderAt('/login');
  expect(page.text).toContain('Use sua conta para acessar o sistema');
  expect(page.text).toContain('Entrar');
  await page.unmount();
});

test('login redireciona visitante desautenticado', async () => {
  localStorage.removeItem('user');
  try {
    const page = await renderAt('/dashboard');
    expect(page.text).toContain('Use sua conta para acessar o sistema');
    await page.unmount();
  } finally {
    localStorage.setItem('user', JSON.stringify({ username: 'tester' }));
  }
});

test('dashboard renderiza o shell do template', async () => {
  const page = await renderAt('/dashboard');
  expect(page.text).toContain('Painel de Auditoria');
  expect(page.text).toContain('Conformidade dos 15 Módulos');
  await page.unmount();
});

test.each([
  ['/empresas'],
  ['/documentos'],
  ['/motores'],
  ['/relatorios'],
  ['/perfil'],
  ['/configuracoes'],
])('rota %s renderiza sem erros', async (path) => {
  const page = await renderAt(path);
  expect(page.text.length).toBeGreaterThan(50);
  await page.unmount();
});

test('alternância de idiomas (pt, en, zh) traduz elementos do menu e páginas', async () => {
  await i18n.changeLanguage('en');
  let page = await renderAt('/dashboard');
  expect(page.text).toContain('Reconciliation Dashboard');
  expect(page.text).toContain('Document Archive');
  expect(page.text).toContain('Settings');
  await page.unmount();

  await i18n.changeLanguage('zh');
  page = await renderAt('/dashboard');
  expect(page.text).toContain('对账控制台');
  expect(page.text).toContain('文档归档');
  expect(page.text).toContain('系统设置');
  await page.unmount();

  await i18n.changeLanguage('pt');
  page = await renderAt('/dashboard');
  expect(page.text).toContain('Painel de Confronto');
  expect(page.text).toContain('Arquivo de Documentos');
  expect(page.text).toContain('Configurações');
  await page.unmount();
});
