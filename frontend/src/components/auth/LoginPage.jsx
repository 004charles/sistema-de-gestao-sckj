import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/api';
import { toast } from 'react-toastify';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      setFormData((prev) => ({ ...prev, username: remembered }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.login(formData.username, formData.password);
      if (response.data.success) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        if (rememberMe) {
          localStorage.setItem('rememberedUser', formData.username);
        } else {
          localStorage.removeItem('rememberedUser');
        }
        toast.success(t('login.success'));
        onLogin();
        navigate('/home');
      }
    } catch (err) {
      setError(
        err.response?.status === 401
          ? t('login.errorInvalidCredentials')
          : t('login.errorServer')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content">
      <div className="login-lang-switch">
        {[
          { code: 'pt', label: 'PT' },
          { code: 'en', label: 'EN' },
          { code: 'zh', label: 'ZH' },
        ].map((lang) => (
          <button
            key={lang.code}
            type="button"
            className={i18n.language?.substring(0, 2) === lang.code ? 'active' : ''}
            onClick={() => i18n.changeLanguage(lang.code)}
          >
            {lang.label}
          </button>
        ))}
      </div>

      <div className="signUP-admin">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-xl-4 col-lg-5 col-md-5 p-0">
              <div className="signUP-admin-left signIn-admin-left position-relative">
                <div className="signUP-admin-left__content">
                  <div className="text-capitalize mb-md-30 mb-15 d-flex align-items-center justify-content-md-start justify-content-center">
                    <img
                      src="/logo.jpeg"
                      alt="SCKJ"
                      style={{ height: 44, width: 'auto', marginRight: 12 }}
                    />
                  </div>
                  <h1>{t('login.systemName')}</h1>
                  <p className="mt-15 text-muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                    {t('login.systemDescription')}
                  </p>
                </div>
                <div className="signUP-admin-left__img">
                  <img
                    className="img-fluid svg"
                    src="/template/img/svg/signupIllustration.svg"
                    alt="img"
                  />
                </div>
              </div>
            </div>

            <div className="col-xl-8 col-lg-7 col-md-7 col-sm-8">
              <div className="signUp-admin-right signIn-admin-right p-md-40 p-10">
                <div className="row justify-content-center">
                  <div className="col-xl-7 col-lg-8 col-md-12">
                    <div className="edit-profile mt-md-25 mt-0">
                      <div className="card border-0">
                        <div className="card-header border-0 pb-md-15 pb-10 pt-md-20 pt-10">
                          <div className="edit-profile__title">
                            <h6>
                              {t('login.title')}{' '}
                              <span className="color-primary">Sistema IVA</span>
                            </h6>
                          </div>
                        </div>
                        <div className="card-body">
                          <div className="edit-profile__body">
                            <p className="text-muted mb-20" style={{ fontSize: 13.5 }}>
                              {t('login.subtitle')}
                            </p>

                            {error && (
                              <div className="alert alert-danger" role="alert">
                                {error}
                              </div>
                            )}

                            <form onSubmit={handleSubmit} noValidate>
                              <div className="form-group mb-20">
                                <label htmlFor="username">{t('login.emailPlaceholder')}</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  id="username"
                                  name="username"
                                  placeholder={t('login.emailPlaceholder')}
                                  value={formData.username}
                                  onChange={handleChange}
                                  required
                                  autoComplete="username"
                                />
                              </div>

                              <div className="form-group mb-15">
                                <label htmlFor="password-field">
                                  {t('login.passwordPlaceholder')}
                                </label>
                                <div className="position-relative">
                                  <input
                                    id="password-field"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-control"
                                    name="password"
                                    placeholder={t('login.passwordPlaceholder')}
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    autoComplete="current-password"
                                  />
                                  <i
                                    className={`la la-fw ${
                                      showPassword ? 'la-eye-slash' : 'la-eye'
                                    } text-light fs-16 field-icon toggle-password2`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                  ></i>
                                </div>
                              </div>

                              <div className="signUp-condition signIn-condition">
                                <div className="checkbox-theme-default custom-checkbox">
                                  <input
                                    className="checkbox"
                                    type="checkbox"
                                    id="check-remember"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                  />
                                  <label htmlFor="check-remember">
                                    <span className="checkbox-text">{t('login.rememberMe')}</span>
                                  </label>
                                </div>
                                <a
                                  href="#forget"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toast.info(
                                      'Contacte o suporte da SCKJ para redefinir as suas credenciais.'
                                    );
                                  }}
                                >
                                  {t('login.forgotPassword')}
                                </a>
                              </div>

                              <div className="button-group d-flex pt-1 justify-content-md-start justify-content-center">
                                <button
                                  type="submit"
                                  className="btn btn-primary btn-default btn-squared text-capitalize lh-normal px-50 py-15 signIn-createBtn"
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <>
                                      <i className="la la-spinner fa-spin mr-10"></i>
                                      {t('login.submitting')}
                                    </>
                                  ) : (
                                    t('login.submit')
                                  )}
                                </button>
                              </div>
                            </form>

                            <p className="text-center mt-25 mb-0 text-muted" style={{ fontSize: 13 }}>
                              {t('login.noAccount')}{' '}
                              <a
                                href="#admin"
                                className="color-primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  toast.info(
                                    'Por favor contacte o Administrador da sua organização.'
                                  );
                                }}
                              >
                                {t('login.contactAdmin')}
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <p
                className="text-center text-muted mt-30 mb-20"
                style={{ fontSize: 12.5 }}
              >
                {t('login.footer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
