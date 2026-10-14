import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AdminSidebar = ({ collapsed, abaAtiva, onMudarAba, estatisticas, onLogout }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const totalEmpresas = estatisticas?.total_empresas || 0;
  const totalUsers = estatisticas?.total_utilizadores || 0;

  const menuItems = [
    {
      key: 'dashboard',
      label: t('admin.sidebar.globalViewRisks', 'Visão Global & Riscos'),
      icon: 'la la-chart-pie',
    },
    {
      key: 'empresas',
      label: `${t('admin.sidebar.registeredCompanies', 'Empresas Registadas')} (${totalEmpresas})`,
      icon: 'la la-building',
    },
    {
      key: 'utilizadores',
      label: `${t('admin.sidebar.users', 'Utilizadores')} (${totalUsers})`,
      icon: 'la la-users-cog',
    },
    {
      key: 'regras',
      label: t('admin.sidebar.taxRulesEngines', 'Motores & Regras Fiscais'),
      icon: 'la la-cogs',
    },
    {
      key: 'pgc',
      label: t('admin.sidebar.pgcCatalog', 'Plano de Contas (PGC)'),
      icon: 'la la-book',
    },
    {
      key: 'ocorrencias',
      label: t('admin.sidebar.taxOccurrences', 'Ocorrências Fiscais'),
      icon: 'la la-exclamation-triangle',
    },
    {
      key: 'documentos',
      label: t('admin.sidebar.generalFileArchive', 'Arquivo Central de Ficheiros'),
      icon: 'la la-archive',
    },
    {
      key: 'configuracoes',
      label: t('admin.sidebar.settings', 'Configurações do Sistema'),
      icon: 'la la-sliders-h',
    },
  ];

  return (
    <aside className="sidebar-wrapper admin-sidebar-wrapper">
      <div id="sidebar" className={`sidebar ${collapsed ? 'collapsed' : 'sidebar-collapse'}`}>
        <div
          className="sidebar__menu-group d-flex flex-column"
          style={{ height: '100%', paddingBottom: 15 }}
        >
          <div>
            <ul className="sidebar_nav">
              <li className="menu-title">
                <span>{t('admin.sidebar.adminManagement', 'ADMINISTRAÇÃO DO SISTEMA')}</span>
              </li>
              {menuItems.map((item) => {
                const isActive = abaAtiva === item.key;
                return (
                  <li key={item.key}>
                    <a
                      href={`#${item.key}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onMudarAba(item.key);
                      }}
                      className={isActive ? 'active' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <span
                        className="nav-icon"
                        style={{
                          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(95, 99, 242, 0.06)',
                        }}
                      >
                        <i
                          className={item.icon}
                          style={{ color: isActive ? '#ffffff' : '#5f63f2' }}
                        ></i>
                      </span>
                      <span className="menu-text">
                        {item.label}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* SECÇÃO INFERIOR: ATALHO PARA OPERACIONAL + LOGOUT */}
          <div className="sidebar__bottom mt-auto pt-15" style={{ borderTop: '1px solid #edf0f5' }}>
            <ul className="sidebar_nav">
              <li className="menu-title">
                <span>{t('admin.sidebar.operationalSpace', 'ESPAÇO OPERACIONAL')}</span>
              </li>
              <li>
                <a
                  href="#workspace"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/auditoria');
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="nav-icon" style={{ backgroundColor: 'rgba(32, 201, 151, 0.1)' }}>
                    <i className="la la-chart-bar" style={{ color: '#20c997' }}></i>
                  </span>
                  <span className="menu-text fw-600" style={{ color: '#20c997' }}>
                    {t('admin.sidebar.companySpace', 'Espaço da Empresa')}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="#logout"
                  onClick={(e) => {
                    e.preventDefault();
                    onLogout();
                  }}
                  className="sidebar-logout-link"
                  style={{ cursor: 'pointer' }}
                >
                  <span className="nav-icon" style={{ backgroundColor: '#fff0f0' }}>
                    <i className="la la-sign-out-alt text-danger"></i>
                  </span>
                  <span className="menu-text text-danger fw-600">
                    {t('navigation.logout', 'Terminar Sessão')}
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
