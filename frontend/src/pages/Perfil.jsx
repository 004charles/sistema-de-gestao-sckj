import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/common/ConfirmModal';

const inputComIcone = { paddingLeft: 40 };

const Perfil = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    nif: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setFormData({
        username: parsed.username || '',
        email: parsed.email || '',
        nif: parsed.nif || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
    setSuccess('');
  };

  const handleSave = () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError(t('profile.passwordsDontMatch'));
      return;
    }
    if (formData.password && formData.password.length < 6) {
      setError(t('profile.passwordMinLength'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const updatedUser = {
      ...user,
      username: formData.username,
      email: formData.email,
      nif: formData.nif,
    };

    if (formData.password) {
      updatedUser.password = formData.password;
    }

    setTimeout(() => {
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setFormData({ ...formData, password: '', confirmPassword: '' });
      setLoading(false);
      setSuccess(t('profile.updateSuccess'));
    }, 500);
  };

  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="breadcrumb-main">
            <h4 className="text-capitalize breadcrumb-title">
              {t('profile.title') || 'Meu Perfil'}
            </h4>
            <div className="breadcrumb-action justify-content-end flex-wrap">
              {/* ações */}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <div className="alert-content d-flex align-items-center" style={{ gap: 8 }}>
                <i className="la la-exclamation-triangle"></i>
                <p className="mb-0">{error}</p>
              </div>
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={() => setError('')}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              <div className="alert-content d-flex align-items-center" style={{ gap: 8 }}>
                <i className="la la-check-circle"></i>
                <p className="mb-0">{success}</p>
              </div>
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={() => setSuccess('')}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-12">
          <div className="edit-profile mt-25">
            <div className="card">
              <div className="card-header px-sm-25 px-3">
                <div className="edit-profile__title">
                  <h6>{t('profile.personalInfo') || 'Informações Pessoais'}</h6>
                  <span className="fs-13 color-light fw-400">
                    {t('profile.subtitle') ||
                      'Gerencie suas informações pessoais e configurações da conta'}
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="edit-profile__body mx-lg-20">
                  <div
                    className="d-flex align-items-center flex-wrap mb-25"
                    style={{ gap: 20 }}
                  >
                    <span
                      className="avatar avatar-circle fw-600"
                      style={{
                        width: 80,
                        height: 80,
                        fontSize: 28,
                        margin: 0,
                        background: 'linear-gradient(135deg, #5f63f2, #2c99ff)',
                      }}
                    >
                      {getInitials(user.username)}
                    </span>
                    <div>
                      <h5 className="mb-10 fw-600">
                        {user.username || t('profile.defaultUser')}
                      </h5>
                      <p className="mb-10 fs-14 text-muted">
                        {user.email || t('profile.noEmail')}
                      </p>
                      <span className="badge badge-primary">
                        {user.role || t('profile.defaultUser')}
                      </span>
                    </div>
                  </div>

                  <hr className="mb-25" />

                  <div className="row">
                    <div className="col-12 col-md-6 mb-20">
                      <div className="form-group mb-0">
                        <label htmlFor="perfil-username">
                          {t('profile.username') || 'Nome de Usuário'}
                        </label>
                        <div className="input-container icon-left position-relative">
                          <span className="input-icon icon-left">
                            <i className="la la-user"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control form-control-default"
                            id="perfil-username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            style={inputComIcone}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-md-6 mb-20">
                      <div className="form-group mb-0">
                        <label htmlFor="perfil-email">
                          {t('profile.email') || 'Email'}
                        </label>
                        <div className="input-container icon-left position-relative">
                          <span className="input-icon icon-left">
                            <i className="la la-envelope"></i>
                          </span>
                          <input
                            type="email"
                            className="form-control form-control-default"
                            id="perfil-email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            style={inputComIcone}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-md-6 mb-20">
                      <div className="form-group mb-0">
                        <label htmlFor="perfil-nif">{t('profile.nif') || 'NIF'}</label>
                        <div className="input-container icon-left position-relative">
                          <span className="input-icon icon-left">
                            <i className="la la-user"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control form-control-default"
                            id="perfil-nif"
                            name="nif"
                            value={formData.nif}
                            onChange={handleChange}
                            style={inputComIcone}
                          />
                        </div>
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
          <div className="edit-profile mt-25">
            <div className="card">
              <div className="card-header px-sm-25 px-3">
                <div className="edit-profile__title">
                  <h6>{t('profile.changePassword') || 'Alterar Senha'}</h6>
                </div>
              </div>
              <div className="card-body">
                <div className="edit-profile__body mx-lg-20">
                  <div className="row">
                    <div className="col-12 col-md-6 mb-20">
                      <div className="form-group mb-0">
                        <label htmlFor="perfil-password">
                          {t('profile.newPassword') || 'Nova Senha'}
                        </label>
                        <div className="input-container icon-left position-relative">
                          <span className="input-icon icon-left">
                            <i className="la la-lock"></i>
                          </span>
                          <input
                            type="password"
                            className="form-control form-control-default"
                            id="perfil-password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            style={inputComIcone}
                          />
                        </div>
                        <small className="d-block mt-10 fs-13 text-muted">
                          {t('profile.passwordHint') || 'Deixe em branco para não alterar'}
                        </small>
                      </div>
                    </div>

                    <div className="col-12 col-md-6 mb-20">
                      <div className="form-group mb-0">
                        <label htmlFor="perfil-confirm-password">
                          {t('profile.confirmPassword') || 'Confirmar Nova Senha'}
                        </label>
                        <div className="input-container icon-left position-relative">
                          <span className="input-icon icon-left">
                            <i className="la la-lock"></i>
                          </span>
                          <input
                            type="password"
                            className="form-control form-control-default"
                            id="perfil-confirm-password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            style={inputComIcone}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end pt-10">
                    <button
                      type="button"
                      className="btn btn-primary btn-default btn-squared"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      <i className={`la ${loading ? 'la-spinner' : 'la-save'}`}></i>{' '}
                      {loading
                        ? t('profile.saving')
                        : t('profile.save') || 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card mt-25 mb-25">
            <div className="card-header color-dark fw-500">
              <i className="la la-exclamation-triangle text-danger"></i>{' '}
              {t('profile.dangerZone') || 'Zona de Perigo'}
            </div>
            <div className="card-body">
              <p className="mb-20 text-muted">
                {t('profile.dangerDescription') || 'Ações irreversíveis. Use com cautela.'}
              </p>
              <button
                type="button"
                className="btn btn-default btn-squared btn-outline-danger"
                onClick={() => setConfirmarSaida(true)}
              >
                <i className="la la-lock"></i> {t('profile.logoutAccount')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={confirmarSaida}
        onClose={() => setConfirmarSaida(false)}
        onConfirm={() => {
          localStorage.removeItem('user');
          window.location.href = '/login';
        }}
        title={t('profile.dangerZone') || 'Zona de Perigo'}
        subtitle={t('profile.logoutAccount')}
        confirmLabel={t('profile.logoutAccount')}
        confirmClass="btn-danger"
      >
        <p className="mb-0 text-muted" style={{ fontSize: 14 }}>
          {t('profile.confirmLogout')}
        </p>
      </ConfirmModal>
    </>
  );
};

export default Perfil;
