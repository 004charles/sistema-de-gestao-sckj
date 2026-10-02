import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from '../layout/Sidebar';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

const MOBILE_QUERY = '(max-width: 991px)';

const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_QUERY).matches;

const MainLayout = ({ children }) => {
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [collapsed, setCollapsed] = useState(isMobileViewport);

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

  const handleNavigate = useCallback(() => {
    if (isMobileViewport()) {
      setCollapsed(true);
    }
  }, []);

  const overlayVisible = isMobile && !collapsed;

  return (
    <>
      <Header onToggleSidebar={handleToggleSidebar} />

      <main className="main-content">
        <Sidebar collapsed={collapsed} onNavigate={handleNavigate} />

        <div className={`contents${collapsed ? ' expanded' : ''}`}>
          <div className="container-fluid">{children}</div>
        </div>

        <Footer />
      </main>

      <div
        className={`overlay-dark-sidebar${overlayVisible ? ' show' : ''}`}
        onClick={() => setCollapsed(true)}
      />
    </>
  );
};

export default MainLayout;
