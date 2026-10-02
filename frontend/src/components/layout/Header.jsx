import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { menuItems } from './menuConfig';

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

  const user = JSON.parse(localStorage.getItem('user') || '{}');
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
                      <li>
                        <a
                          href="#perfil"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/configuracoes');
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
                            navigate('/documentos');
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
                            navigate('/configuracoes');
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
