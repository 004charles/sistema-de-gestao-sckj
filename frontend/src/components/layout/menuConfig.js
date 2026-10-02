export const mainMenuItems = [
  {
    key: 'dashboard',
    textKey: 'navigation.dashboard',
    fallbackText: 'Painel de Confronto',
    text: 'Painel de Confronto',
    icon: 'la la-balance-scale',
    path: '/dashboard',
  },
  {
    key: 'reports',
    textKey: 'navigation.reports',
    fallbackText: 'Pareceres & Relatórios',
    text: 'Pareceres & Relatórios',
    icon: 'la la-file-invoice',
    path: '/relatorios',
  },
  {
    key: 'companies',
    textKey: 'navigation.companies',
    fallbackText: 'Empresas',
    text: 'Empresas',
    icon: 'la la-building',
    path: '/empresas',
  },
  {
    key: 'motors',
    textKey: 'navigation.motors',
    fallbackText: 'Motores de Auditoria',
    text: 'Motores de Auditoria',
    icon: 'la la-shield-alt',
    path: '/motores',
  },
];

export const bottomMenuItems = [
  {
    key: 'documents',
    textKey: 'navigation.documents',
    fallbackText: 'Arquivo de Documentos',
    text: 'Arquivo de Documentos',
    icon: 'la la-folder-open',
    path: '/documentos',
  },
  {
    key: 'settings',
    textKey: 'navigation.settings',
    fallbackText: 'Configurações',
    text: 'Configurações',
    icon: 'la la-cog',
    path: '/configuracoes',
  },
];

export const menuItems = [...mainMenuItems, ...bottomMenuItems];
