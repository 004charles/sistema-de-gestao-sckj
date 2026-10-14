/**
 * Endereço da API.
 *
 * A versão anterior forçava a porta 8000 em qualquer host que não fosse
 * localhost e ignorava `REACT_APP_API_URL`. Isso partiu o sistema duas vezes:
 * no deploy Vercel/Render (chamava `https://dominio:8000/api`) e localmente,
 * quando o backend passou a correr na 8080. Estes testes fixam a ordem de
 * precedência para não voltar a acontecer.
 *
 * @jest-environment jsdom
 */

const comHost = (href) => {
  delete window.location;
  const url = new URL(href);
  window.location = {
    href,
    protocol: url.protocol,
    hostname: url.hostname,
    host: url.host,
    origin: url.origin,
  };
};

const carregar = () => {
  let modulo;
  jest.isolateModules(() => {
    modulo = require('../services/api');
  });
  return modulo.getApiBaseUrl;
};

const AMBIENTE = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...AMBIENTE };
  delete process.env.REACT_APP_API_URL;
  delete process.env.REACT_APP_API_PORT;
});

afterAll(() => {
  process.env = AMBIENTE;
});

test('REACT_APP_API_URL ganha sempre, mesmo num host remoto', () => {
  process.env.REACT_APP_API_URL = 'https://api.exemplo.ao/api';
  comHost('https://app.vercel.app/auditoria');
  expect(carregar()()).toBe('https://api.exemplo.ao/api');
});

test('REACT_APP_API_URL ganha também em localhost', () => {
  process.env.REACT_APP_API_URL = 'http://localhost:8080/api';
  comHost('http://localhost:3000/auditoria');
  expect(carregar()()).toBe('http://localhost:8080/api');
});

test('em localhost sem configuração usa a porta de desenvolvimento', () => {
  comHost('http://localhost:3000/auditoria');
  expect(carregar()()).toBe('http://localhost:8000/api');
});

test('a porta de desenvolvimento é configurável', () => {
  process.env.REACT_APP_API_PORT = '8080';
  comHost('http://localhost:3000/auditoria');
  expect(carregar()()).toBe('http://localhost:8080/api');
});

test('num host remoto sem configuração usa a mesma origem, não a porta 8000', () => {
  comHost('https://app.vercel.app/auditoria');
  expect(carregar()()).toBe('https://app.vercel.app/api');
});

test('nunca inventa uma porta num endereço remoto', () => {
  comHost('https://contabilidade.exemplo.ao/auditoria');
  expect(carregar()()).not.toContain(':8000');
  expect(carregar()()).not.toContain(':8080');
});
