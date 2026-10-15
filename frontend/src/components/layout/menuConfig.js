export const adminMenuItems = [
  {
    key: 'admin',
    textKey: 'navigation.admin',
    fallbackText: 'Administração',
    text: 'Administração',
    icon: 'la la-shield-alt',
    path: '/admin-gestao',
  },
];

export const mainMenuItems = [
  {
    key: 'confronto',
    textKey: 'navigation.confronto',
    fallbackText: 'Confronto Contabilidade vs AGT',
    text: 'Confronto Contabilidade vs AGT',
    icon: 'la la-balance-scale',
    path: '/confronto',
  },
  {
    key: 'facturas',
    textKey: 'navigation.facturas',
    fallbackText: 'Leitor de Facturas (IA)',
    text: 'Leitor de Facturas (IA)',
    icon: 'la la-file-invoice-dollar',
    path: '/facturas',
  },
  {
    key: 'arquivo',
    textKey: 'navigation.arquivo',
    fallbackText: 'Documentos & Arquivo',
    text: 'Documentos & Arquivo',
    icon: 'la la-folder-open',
    path: '/arquivo',
  },
  {
    key: 'pgc',
    textKey: 'navigation.pgc',
    fallbackText: 'Plano de Contas (PGC)',
    text: 'Plano de Contas (PGC)',
    icon: 'la la-book',
    path: '/pgc',
  },
  {
    key: 'legislacao',
    textKey: 'navigation.legislacao',
    fallbackText: 'Legislação Fiscal',
    text: 'Legislação Fiscal',
    icon: 'la la-landmark',
    path: '/legislacao',
  },
  {
    key: 'empresas',
    textKey: 'navigation.empresas',
    fallbackText: 'Empresas & Clientes',
    text: 'Empresas & Clientes',
    icon: 'la la-building',
    path: '/admin-gestao?aba=empresas',
  },
  {
    key: 'definicoes',
    textKey: 'navigation.definicoes',
    fallbackText: 'Definições da Empresa',
    text: 'Definições da Empresa',
    icon: 'la la-cog',
    path: '/definicoes',
  },
];

export const workflowMenuItems = [];
export const referenceMenuItems = [];

export const menuItems = [...adminMenuItems, ...mainMenuItems];



