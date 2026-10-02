import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mainMenuItems, bottomMenuItems } from './menuConfig';
import ConfirmModal from '../common/ConfirmModal';

const Sidebar = ({ collapsed, onNavigate }) => {
  const { t } = useTranslation();
  const [confirmarLogout, setConfirmarLogout] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    setConfirmarLogout(false);
    navigate('/login');
  };

  return (
    <>
      <aside className="sidebar-wrapper">
        <div id="sidebar" className={`sidebar ${collapsed ? 'collapsed' : 'sidebar-collapse'}`}>
          <div
            className="sidebar__menu-group d-flex flex-column justify-content-between"
            style={{ minHeight: '100%', paddingBottom: 25 }}
          >
            <div>
              <ul className="sidebar_nav">
                <li className="menu-title">
                  <span>{t('sidebar.auditSection', 'Auditoria & Fiscalidade')}</span>
                </li>
                {mainMenuItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onNavigate}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      <span className="nav-icon">
                        <i className={item.icon}></i>
                      </span>
                      <span className="menu-text">
                        {t(item.textKey, item.fallbackText || item.text)}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* SEÇÃO INFERIOR: ARQUIVO DOCUMENTAL, CONFIGURAÇÕES E LOGOUT */}
            <div className="sidebar__bottom mt-30 pt-15" style={{ borderTop: '1px solid #edf0f5' }}>
              <ul className="sidebar_nav">
                <li className="menu-title">
                  <span>{t('sidebar.systemSection', 'Arquivo & Sistema')}</span>
                </li>
                {bottomMenuItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onNavigate}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      <span className="nav-icon">
                        <i className={item.icon}></i>
                      </span>
                      <span className="menu-text">
                        {t(item.textKey, item.fallbackText || item.text)}
                      </span>
                    </NavLink>
                  </li>
                ))}
                <li>
                  <a
                    href="#logout"
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmarLogout(true);
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

      <ConfirmModal
        show={confirmarLogout}
        onClose={() => setConfirmarLogout(false)}
        onConfirm={handleLogout}
        title={t('logoutModal.title', 'Terminar Sessão')}
        subtitle={t('logoutModal.subtitle', 'Confirmação de encerramento de acesso')}
        confirmLabel={t('logoutModal.confirm', 'Sim, Terminar Sessão')}
        confirmClass="btn-danger"
      >
        <p className="mb-0 text-muted" style={{ fontSize: 13.5 }}>
          {t(
            'logoutModal.message',
            'Deseja realmente sair da sua conta? Terá de introduzir o seu utilizador e palavra-passe para voltar a aceder ao sistema.'
          )}
        </p>
      </ConfirmModal>
    </>
  );
};

export default Sidebar;
