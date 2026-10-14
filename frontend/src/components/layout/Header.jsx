import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { menuItems } from './menuConfig';
import { usePeriodo } from '../../context/PeriodoContext';

const languages = [
  { code: 'pt', label: 'Português', flag: '/angola_flag.png' },
  { code: 'en', label: 'English', flag: '/template/img/eng.png' },
  { code: 'zh', label: '中文', flag: '/template/img/flag.png' },
];

const Header = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [openMenu, setOpenMenu] = useState(null);
  const navRef = useRef(null);
  const { empresaAtual, empresas, atualizar } = usePeriodo() || {};

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Boolean(user.is_admin || user.is_superuser || user.is_staff);
  const initial = (user.username || user.nome || 'U').charAt(0).toUpperCase();

  const currentLang =
    languages.find((l) => l.code === (i18n.language?.substring(0, 2) || 'pt')) || languages[0];

  const matchedItem = menuItems.find((item) => item.path === location.pathname);
  const pageTitle = matchedItem
    ? t(matchedItem.textKey, matchedItem.fallbackText || matchedItem.text)
    : t('navigation.home', 'Painel de Confronto');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

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
          <a className="navbar-brand" href="#home" onClick={(e) => e.preventDefault()}>
            <img src="/logo.jpeg" alt="SCKJ" style={{ height: 34, width: 'auto' }} />
            <span className="d-none d-xl-inline-block ml-2 text-capitalize color-primary fw-600">
              {pageTitle}
            </span>
          </a>
        </div>

        <div className="navbar-right" ref={navRef}>
          <ul className="navbar-right__menu">
            {/* EMPRESA ATIVA IDENTIFICADA NO TOPO */}
            <li className="nav-empresa mr-15">
              <div className={`dropdown-custom ${openMenu === 'empresa' ? 'show' : ''}`}>
                <button
                  type="button"
                  className="nav-item-toggle btn btn-sm d-flex align-items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'empresa' ? null : 'empresa');
                  }}
                  style={{
                    background: empresaAtual ? '#f0f4ff' : '#f8f9fb',
                    border: '1px solid ' + (empresaAtual ? '#c7d2fe' : '#e2e8f0'),
                    borderRadius: 20,
                    padding: '3px 12px',
                    height: 36,
                    gap: 8,
                    cursor: 'pointer',
                  }}
                  title={empresaAtual ? `${empresaAtual.nome} (NIF: ${empresaAtual.nif})` : 'Nenhuma empresa selecionada'}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: empresaAtual ? '#4338ca' : '#94a3b8',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                    }}
                  >
                    <i className="la la-building"></i>
                  </span>
                  <div className="d-flex flex-column text-left" style={{ lineHeight: 1.15 }}>
                    <span
                      className="fw-700 text-truncate"
                      style={{ fontSize: 12, maxWidth: 220, color: empresaAtual ? '#1e1b4b' : '#64748b' }}
                    >
                      {empresaAtual ? empresaAtual.nome : 'Sem Empresa Ativa'}
                    </span>
                    <span className="text-muted" style={{ fontSize: 10 }}>
                      {empresaAtual ? `NIF: ${empresaAtual.nif}` : 'Clique para selecionar'}
                    </span>
                  </div>
                  <i className="la la-angle-down text-muted ml-4" style={{ fontSize: 11 }}></i>
                </button>

                {empresas && empresas.length > 0 && (
                  <div
                    className="dropdown-wrapper dropdown-wrapper--medium p-10"
                    style={{
                      minWidth: 280,
                      maxHeight: 340,
                      overflowY: 'auto',
                      right: 0,
                      left: 'auto',
                    }}
                  >
                    <div className="dropdown-header px-10 py-5 text-muted fw-700" style={{ fontSize: 11 }}>
                      EMPRESAS DISPONÍVEIS ({empresas.length})
                    </div>
                    {empresas.map((emp) => {
                      const ativa = String(emp.id) === String(empresaAtual?.id);
                      return (
                        <a
                          key={emp.id}
                          href="#select-empresa"
                          className={`dropdown-item px-10 py-8 d-flex align-items-center justify-content-between rounded mb-2 ${
                            ativa ? 'bg-primary-lighten text-primary fw-700' : ''
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (atualizar) atualizar({ empresaId: String(emp.id) });
                            setOpenMenu(null);
                          }}
                          style={{ gap: 8, fontSize: 12 }}
                        >
                          <div className="d-flex flex-column text-truncate">
                            <span className="text-truncate">{emp.nome}</span>
                            <small className="text-muted" style={{ fontSize: 10.5 }}>
                              NIF: {emp.nif} {emp.provincia ? `• ${emp.provincia}` : ''}
                            </small>
                          </div>
                          {ativa && <i className="la la-check text-primary fw-700" style={{ fontSize: 15 }}></i>}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>

            {isAdmin && (
              <li className="d-none d-md-inline-block mr-15">
                <button
                  type="button"
                  className={`btn btn-xs ${location.pathname === '/admin-gestao' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
                  onClick={() => navigate('/admin-gestao')}
                  style={{
                    borderRadius: 20,
                    fontSize: 11.5,
                    padding: '4px 12px',
                    fontWeight: 600,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title={t('navigation.admin', 'Administração Global')}
                >
                  <i className="la la-sliders-h"></i> Painel de Gestão
                </button>
              </li>
            )}
            <li className="nav-flag-select">
              <div className={`dropdown-custom ${openMenu === 'lang' ? 'show' : ''}`}>
                <a
                  href="#language"
                  className="nav-item-toggle d-flex align-items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'lang' ? null : 'lang');
                  }}
                  title={currentLang.label}
                >
                  <img
                    src={currentLang.flag}
                    alt={currentLang.label}
                    className="rounded-circle"
                    style={{ width: 22, height: 22, objectFit: 'cover' }}
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

            <li className="nav-author">
              <div className={`dropdown-custom ${openMenu === 'author' ? 'show' : ''}`}>
                <a
                  href="#author"
                  className="nav-item-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'author' ? null : 'author');
                  }}
                >
                  <span className="author-initials">{initial}</span>
                </a>
                <div className="dropdown-wrapper">
                  <div className="nav-author__info">
                    <div className="author-img">
                      <span className="author-initials">{initial}</span>
                    </div>
                    <div>
                      <h6>{user.username || user.nome || 'Utilizador'}</h6>
                      <span>{user.perfil || user.role || 'Sistema IVA'}</span>
                    </div>
                  </div>
                  <div className="nav-author__options">
                    <ul>
                      {isAdmin && (
                        <li>
                          <a
                            href="#admin"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate('/admin-gestao');
                            }}
                            style={{ color: '#5f63f2', fontWeight: 600 }}
                          >
                            <i className="la la-shield-alt" style={{ color: '#5f63f2' }}></i>{' '}
                            {t('navigation.admin', 'Administração Global')}
                          </a>
                        </li>
                      )}
                      <li>
                        <a
                          href="#perfil"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/definicoes');
                          }}
                        >
                          <i className="la la-user"></i> {t('navigation.profile', 'O Meu Perfil')}
                        </a>
                      </li>
                      <li>
                        <a
                          href="#documentos"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/arquivo');
                          }}
                        >
                          <i className="la la-folder-open"></i>{' '}
                          {t('navigation.documents', 'Arquivo de Documentos')}
                        </a>
                      </li>
                      <li>
                        <a
                          href="#configuracoes"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/definicoes');
                          }}
                        >
                          <i className="la la-cog"></i> {t('navigation.settings', 'Configurações')}
                        </a>
                      </li>
                    </ul>
                    <a
                      href="#logout"
                      className="nav-author__signout"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                    >
                      <i className="la la-sign-out-alt"></i>{' '}
                      {t('navigation.logout', 'Terminar Sessão')}
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

export default Header;
