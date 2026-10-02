import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: 'ZH' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const features = [
    {
      icon: 'la la-chart-bar',
      title: t('landing.feature1Title'),
      desc: t('landing.feature1Desc'),
    },
    {
      icon: 'la la-bolt',
      title: t('landing.feature2Title'),
      desc: t('landing.feature2Desc'),
    },
    {
      icon: 'la la-chart-line',
      title: t('landing.feature3Title'),
      desc: t('landing.feature3Desc'),
    },
  ];

  return (
    <main className="main-content" style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      {/* Nav */}
      <header className="header-top">
        <nav className="navbar navbar-light">
          <div className="navbar-left">
            <a
              className="navbar-brand"
              href="#landing"
              onClick={(e) => e.preventDefault()}
              style={{ marginRight: 12 }}
            >
              <img src="/logo.jpeg" alt="AGT" style={{ height: 32, width: 'auto' }} />
            </a>
          </div>
          <div className="navbar-right">
            <ul className="navbar-right__menu">
              <li style={{ padding: '13px 6px' }}>
                <div className="d-flex align-items-center" style={{ gap: 6 }}>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`btn btn-sm btn-squared ${
                        i18n.language === lang.code
                          ? 'btn-primary btn-default'
                          : 'btn-default btn-white'
                      }`}
                      style={{ fontSize: 11, padding: '5px 9px', minWidth: 32 }}
                      onClick={() => i18n.changeLanguage(lang.code)}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </li>
              <li style={{ padding: '13px 6px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-default btn-squared"
                  onClick={() => navigate('/login')}
                >
                  {t('landing.navEnter')} <i className="la la-arrow-right ml-10"></i>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ padding: '120px 0 90px', backgroundColor: '#ffffff' }}>
        <div className="container">
          <div className="row justify-content-center text-center">
            <div className="col-lg-10">
              <div
                className="d-flex align-items-center justify-content-center flex-wrap mb-40"
                style={{ gap: 24 }}
              >
                <div style={{ width: 140 }}>
                  <img src="/logo.jpeg" alt="AGT" className="img-fluid" />
                </div>
                <div
                  style={{
                    width: 220,
                    height: 130,
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 8px 30px rgba(95,99,242,0.18)',
                  }}
                >
                  <img
                    src="/contabilidade.jpeg"
                    alt="Contabilidade"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              </div>

              <p
                className="color-primary text-uppercase fw-600 mb-20"
                style={{ fontSize: 13, letterSpacing: '1.5px' }}
              >
                {t('landing.heroTag')}
              </p>

              <h1
                className="color-dark fw-700 mb-25"
                style={{
                  fontSize: 'clamp(34px, 5vw, 64px)',
                  lineHeight: 1.06,
                  letterSpacing: '-1.5px',
                }}
              >
                {t('landing.heroTitle1')}
                <br />
                {t('landing.heroTitle2')}{' '}
                <span className="color-primary">{t('landing.heroTitleHighlight')}</span>
              </h1>

              <p
                className="text-muted mx-auto mb-40"
                style={{ maxWidth: 540, fontSize: 18, lineHeight: 1.65 }}
              >
                {t('landing.heroDescription')}
              </p>

              <button
                type="button"
                className="btn btn-primary btn-default btn-squared px-50 py-15"
                onClick={() => navigate('/login')}
              >
                {t('landing.heroCta')} <i className="la la-arrow-right ml-10"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 0', backgroundColor: '#f4f5f7' }}>
        <div className="container">
          <div className="row justify-content-center text-center mb-50">
            <div className="col-lg-8">
              <p
                className="color-primary text-uppercase fw-600 mb-15"
                style={{ fontSize: 13, letterSpacing: '1.5px' }}
              >
                {t('landing.featuresTitle')}
              </p>
              <h2
                className="color-dark fw-700 mb-0"
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 44px)',
                  lineHeight: 1.15,
                  letterSpacing: '-1px',
                }}
              >
                {t('landing.featuresSubtitle')}{' '}
                <span className="color-primary">{t('landing.featuresSubtitleHighlight')}</span>
              </h2>
            </div>
          </div>

          <div className="row">
            {features.map((f, i) => (
              <div className="col-md-4 mb-30" key={i}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="card-body p-30 text-center">
                    <div
                      className="d-flex align-items-center justify-content-center mx-auto mb-20"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        backgroundColor: 'rgba(95,99,242,0.10)',
                        color: '#5f63f2',
                      }}
                    >
                      <i className={`la ${f.icon}`} style={{ fontSize: 26 }}></i>
                    </div>
                    <h5 className="color-dark fw-600 mb-10">{f.title}</h5>
                    <p className="text-muted mb-0" style={{ fontSize: 15, lineHeight: 1.65 }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', backgroundColor: '#ffffff' }}>
        <div className="container">
          <div className="row justify-content-center text-center">
            <div className="col-lg-9">
              <div className="card" style={{ border: '1px solid #f1f2f6' }}>
                <div className="card-body p-40">
                  <div
                    className="d-flex align-items-center justify-content-center mx-auto mb-20"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: 'rgba(32,201,151,0.12)',
                      color: '#20c997',
                    }}
                  >
                    <i className="la la-rocket" style={{ fontSize: 26 }}></i>
                  </div>
                  <h3
                    className="color-dark fw-700 mb-15"
                    style={{
                      fontSize: 'clamp(24px, 3vw, 40px)',
                      lineHeight: 1.2,
                      letterSpacing: '-1px',
                    }}
                  >
                    {t('landing.ctaTitle')}
                  </h3>
                  <p
                    className="text-muted mx-auto mb-30"
                    style={{ maxWidth: 460, fontSize: 16.5, lineHeight: 1.65 }}
                  >
                    {t('landing.ctaDescription')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-default btn-squared px-50 py-15"
                    onClick={() => navigate('/login')}
                  >
                    {t('landing.ctaButton')} <i className="la la-arrow-right ml-10"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="footer-wrapper"
        style={{
          position: 'relative',
          left: 'auto',
          bottom: 'auto',
          padding: '20px 0',
          boxShadow: 'none',
          borderTop: '1px solid #f1f2f6',
        }}
      >
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-6">
              <div
                className="footer-copyright d-flex align-items-center"
                style={{ paddingLeft: 0, gap: 10 }}
              >
                <img
                  src="/logo.jpeg"
                  alt="AGT"
                  style={{ height: 20, width: 'auto', opacity: 0.4 }}
                />
                <p className="mb-0" style={{ fontSize: 12.5, color: '#9299b8' }}>
                  {t('landing.footer')}
                </p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="footer-menu text-right">
                <p className="mb-0" style={{ fontSize: 12, color: '#9299b8' }}>
                  {t('landing.madeBy')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
