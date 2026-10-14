import React, { useCallback, useEffect, useState } from 'react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import Footer from '../layout/Footer';
import ConfirmModal from '../common/ConfirmModal';
import { useNavigate } from 'react-router-dom';

const MOBILE_QUERY = '(max-width: 991px)';

const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_QUERY).matches;

const AdminLayout = ({ children, abaAtiva, onMudarAba, estatisticas }) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [collapsed, setCollapsed] = useState(isMobileViewport);
  const [confirmarLogout, setConfirmarLogout] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => {
      setIsMobile(event.matches);
      setCollapsed(event.matches);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleNavigate = useCallback((aba) => {
    onMudarAba(aba);
    if (isMobileViewport()) {
      setCollapsed(true);
    }
  }, [onMudarAba]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setConfirmarLogout(false);
    navigate('/login');
  };

  const overlayVisible = isMobile && !collapsed;

  return (
    <>
      <AdminHeader
        onToggleSidebar={handleToggleSidebar}
        estatisticas={estatisticas}
      />

      <main className="main-content">
        <AdminSidebar
          collapsed={collapsed}
          abaAtiva={abaAtiva}
          onMudarAba={handleNavigate}
          estatisticas={estatisticas}
          onLogout={() => setConfirmarLogout(true)}
        />

        <div className={`contents${collapsed ? ' expanded' : ''}`}>
          <div className="container-fluid">{children}</div>
        </div>

        <Footer />
      </main>

      <div
        className={`overlay-dark-sidebar${overlayVisible ? ' show' : ''}`}
        onClick={() => setCollapsed(true)}
      />

      <ConfirmModal
        show={confirmarLogout}
        onClose={() => setConfirmarLogout(false)}
        onConfirm={handleLogout}
        title="Terminar Sessão de Administrador"
        message="Tem a certeza de que deseja encerrar a sessão de administração global?"
        confirmText="Sim, Terminar Sessão"
        cancelText="Cancelar"
      />
    </>
  );
};

export default AdminLayout;
