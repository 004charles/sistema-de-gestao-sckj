import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePeriodo } from '../../context/PeriodoContext';

const languages = [
  { code: 'pt', label: 'Português', flag: '/angola_flag.png' },
  { code: 'en', label: 'English', flag: '/template/img/eng.png' },
  { code: 'zh', label: '中文', flag: '/template/img/flag.png' },
];

const AdminHeader = ({ onToggleSidebar, estatisticas }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { empresaAtual, atualizar } = usePeriodo() || {};

  const [openMenu, setOpenMenu] = useState(null);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const navRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const initial = (user.username || user.nome || 'A').charAt(0).toUpperCase();

  const currentLang =
    languages.find((l) => l.code === (i18n.language?.substring(0, 2) || 'pt')) || languages[0];

  const empresas = estatisticas?.empresas || [];
  const empresasFiltradas = empresas.filter(
    (e) =>
      e.nome.toLowerCase().includes(empresaFiltro.toLowerCase()) ||
      e.nif.toLowerCase().includes(empresaFiltro.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelecionarEmpresa = (empresaId) => {
    if (atualizar) atualizar({ empresaId: String(empresaId) });
    setOpenMenu(null);
    navigate('/confronto');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="header-top">
      <nav className="navbar navbar-light">
        <div className="navbar-left">
          <a
            href="#sidebar"
            className="sidebar-toggle"
            onClick={(e) => {
              e.preventDefault();
              onToggleSidebar();
            }}
          >
            <i className="la la-bars"></i>
          </a>

          <a className="navbar-brand" href="#admin" onClick={(e) => e.preventDefault()}>
            <img src="/logo.jpeg" alt="SCKJ" style={{ height: 34, width: 'auto' }} />
            <span className="d-none d-xl-inline-block ml-2 text-capitalize color-primary fw-600">
              {t('admin.globalAdmin', 'Administração Global')}
            </span>
          </a>

          {/* BADGE DE MODO MASTER */}
          <span
            className="badge badge-round d-none d-md-inline-block ml-15"
            style={{
              backgroundColor: 'rgba(95, 99, 242, 0.1)',
              color: '#5f63f2',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
            }}
          >
            <i className="la la-shield-alt mr-4"></i> {t('admin.modeAdmin', 'MODO ADMINISTRADOR')}
          </span>
        </div>

        <div className="navbar-right" ref={navRef}>
          <ul className="navbar-right__menu">
            {/* SELETOR RÁPIDO DE EMPRESA (WORKSPACE SWITCHER) */}
            <li className="mr-15 position-relative">
              <button
                type="button"
                className="btn btn-xs btn-outline-primary d-flex align-items-center"
                onClick={() => setOpenMenu(openMenu === 'empresa' ? null : 'empresa')}
                style={{
                  borderRadius: 20,
                  fontSize: 12,
                  padding: '4px 14px',
                  fontWeight: 600,
                  gap: 6,
                }}
                title={empresaAtual ? `${empresaAtual.nome} (NIF: ${empresaAtual.nif})` : 'Escolha uma empresa'}
              >
                <i className="la la-building"></i>
                <span className="fw-700 text-truncate" style={{ maxWidth: 200 }}>
                  {empresaAtual ? empresaAtual.nome : (empresas.length > 0 ? `${empresas.length} Empresas` : 'Sem Empresa')}
                </span>
                <i className="la la-angle-down" style={{ fontSize: 10 }}></i>
              </button>

              {openMenu === 'empresa' && (
                <div
                  className="dropdown-wrapper shadow-lg position-absolute mt-10"
                  style={{
                    right: 0,
                    width: 320,
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    border: '1px solid #f1f2f6',
                    padding: 14,
                    zIndex: 1050,
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-10 pb-8 border-bottom">
                    <span className="fw-600 color-dark" style={{ fontSize: 12 }}>
                      MUDAR PARA ESPAÇO DE UMA EMPRESA
                    </span>
                    <span className="badge badge-primary badge-round" style={{ fontSize: 10 }}>
                      {empresas.length}
                    </span>
                  </div>

                  <div className="mb-10">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Filtrar por nome ou NIF..."
                      value={empresaFiltro}
                      onChange={(e) => setEmpresaFiltro(e.target.value)}
                      style={{ fontSize: 12 }}
                      autoFocus
                    />
                  </div>

                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {empresasFiltradas.length === 0 ? (
                      <div className="text-center py-15 text-muted" style={{ fontSize: 12 }}>
                        Nenhuma empresa encontrada.
                      </div>
                    ) : (
                      empresasFiltradas.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          className="w-100 text-left btn btn-sm d-flex align-items-center justify-content-between py-8 px-10 mb-4"
                          onClick={() => handleSelecionarEmpresa(emp.id)}
                          style={{
                            backgroundColor: '#f8f9fb',
                            border: '1px solid #edf0f5',
                            borderRadius: 6,
                          }}
                        >
                          <div className="d-flex align-items-center text-truncate mr-10">
                            <i className="la la-building mr-8 color-primary" style={{ fontSize: 15 }}></i>
                            <div className="text-truncate">
                              <div className="fw-600 color-dark text-truncate" style={{ fontSize: 12 }}>
                                {emp.nome}
                              </div>
                              <div className="text-muted" style={{ fontSize: 10 }}>
                                NIF: {emp.nif} · {emp.regime_iva}
                              </div>
                            </div>
                          </div>
                          <span
                            className="badge badge-round"
                            style={{
                              backgroundColor: emp.estado === 'ATIVA' ? '#ebfbf6' : '#f1f2f6',
                              color: emp.estado === 'ATIVA' ? '#20c997' : '#8c90a4',
                              fontSize: 9,
                            }}
                          >
                            {emp.estado}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </li>

            {/* SELETOR DE IDIOMA */}
            <li className="nav-flag-select">
              <div className={`dropdown-custom ${openMenu === 'lang' ? 'show' : ''}`}>
                <a
                  href="#language"
                  className="nav-item-toggle d-flex align-items-center justify-content-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'lang' ? null : 'lang');
                  }}
                  title={currentLang.label}
                  style={{ width: 34, height: 34, flexShrink: 0 }}
                >
                  <img
                    src={currentLang.flag}
                    alt=""
                    aria-label={currentLang.label}
                    className="rounded-circle"
                    style={{ width: 22, height: 22, minWidth: 22, minHeight: 22, objectFit: 'cover', flexShrink: 0 }}
                  />
                </a>
                <div className="dropdown-wrapper dropdown-wrapper--small">
                  {languages.map((lang) => (
                    <a
                      key={lang.code}
                      href="#lang"
                      onClick={(e) => {
                        e.preventDefault();
                        i18n.changeLanguage(lang.code);
                        setOpenMenu(null);
                      }}
                      className={i18n.language?.substring(0, 2) === lang.code ? 'active' : ''}
                    >
                      <img
                        src={lang.flag}
                        alt=""
                        style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: '50%' }}
                      />{' '}
                      {lang.label}
                    </a>
                  ))}
                </div>
              </div>
            </li>

            {/* PERFIL DO ADMINISTRADOR */}
            <li className="nav-author">
              <div className={`dropdown-custom ${openMenu === 'author' ? 'show' : ''}`}>
                <a
                  href="#author"
                  className="nav-item-toggle d-flex align-items-center justify-content-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'author' ? null : 'author');
                  }}
                  style={{ width: 34, height: 34, flexShrink: 0 }}
                >
                  <span className="author-initials">{initial}</span>
                </a>
                <div className="dropdown-wrapper">
                  <div className="nav-author__info">
                    <div className="author-img">
                      <span className="author-initials">{initial}</span>
                    </div>
                    <div>
                      <h6>{user.username || user.nome || 'Administrador'}</h6>
                      <span>{user.is_superuser ? 'Super Administrador' : 'Administrador'}</span>
                    </div>
                  </div>
                  <div className="nav-author__options">
                    <ul>
                      <li>
                        <a
                          href="#configuracoes"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenMenu(null);
                            navigate('/admin-gestao?aba=configuracoes');
                          }}
                        >
                          <i className="la la-sliders-h"></i> {t('admin.sidebar.settings', 'Configurações do Sistema')}
                        </a>
                      </li>
                      <li>
                        <a
                          href="#regras"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenMenu(null);
                            navigate('/admin-gestao?aba=regras');
                          }}
                        >
                          <i className="la la-cogs"></i> {t('admin.sidebar.taxRulesEngines', 'Motores & Regras Fiscais')}
                        </a>
                      </li>
                      <li>
                        <a
                          href="#utilizadores"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenMenu(null);
                            navigate('/admin-gestao?aba=utilizadores');
                          }}
                        >
                          <i className="la la-users-cog"></i> {t('admin.sidebar.users', 'Gestão de Utilizadores')}
                        </a>
                      </li>
                      <li>
                        <a
                          href="#workspace"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpenMenu(null);
                            navigate('/auditoria');
                          }}
                        >
                          <i className="la la-building"></i> {t('admin.sidebar.companySpace', 'Mudar para Espaço da Empresa')}
                        </a>
                      </li>
                    </ul>
                    <a
                      href="#logout"
                      className="nav-author__signout text-danger"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                    >
                      <i className="la la-sign-out-alt"></i> {t('navigation.logout', 'Terminar Sessão')}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default AdminHeader;
