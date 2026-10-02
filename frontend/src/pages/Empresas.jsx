import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { empresaService } from '../services/api';

const BADGE_ESTADO = {
  ATIVA: 'badge-success',
  INATIVA: 'badge-secondary',
  SUSPENSA: 'badge-warning',
  ENCERRADA: 'badge-danger',
};

const SpinDots = () => (
  <span className="atbd-spin-dots spin-lg">
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
  </span>
);

const Empresas = () => {
  const { t } = useTranslation();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const carregarEmpresas = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const response = await empresaService.getAll();
      const dados = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setEmpresas(dados);
    } catch (err) {
      setErro(
        err.response?.status === 401
          ? t('common.error')
          : t('companies.loadError')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  const empresasFiltradas = empresas.filter((empresa) => {
    const texto = busca.toLowerCase();
    const correspondeBusca =
      !texto ||
      (empresa.nome || '').toLowerCase().includes(texto) ||
      (empresa.nif || '').includes(texto);
    const correspondeEstado = !estadoFiltro || empresa.estado === estadoFiltro;
    return correspondeBusca && correspondeEstado;
  });

  const rotuloEstado = (estado) => {
    const map = {
      ATIVA: t('companies.active'),
      INATIVA: t('companies.inactive'),
      SUSPENSA: t('companies.suspended'),
      ENCERRADA: t('companies.closed'),
    };
    return map[estado] || estado;
  };

  const rotuloTipo = (tipo) => {
    const map = {
      PS: t('companies.entityTypes.ps'),
      ENI: t('companies.entityTypes.eni'),
      SQ: t('companies.entityTypes.sq'),
      SA: t('companies.entityTypes.sa'),
      COOP: t('companies.entityTypes.coop'),
      ASS: t('companies.entityTypes.ass'),
      FUND: t('companies.entityTypes.fund'),
      OUTRO: t('companies.entityTypes.outro'),
    };
    return map[tipo] || '—';
  };

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="breadcrumb-main">
            <h4 className="text-capitalize breadcrumb-title">
              {t('navigation.companies')}
            </h4>
          </div>
        </div>
      </div>

      {erro && (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-danger" role="alert">
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={() => setErro('')}
              >
                <span aria-hidden="true">&times;</span>
              </button>
              {erro}
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header color-dark fw-500">
              {t('navigation.companies')}
            </div>
            <div className="card-body">
              <div
                className="d-flex flex-wrap mb-25"
                style={{ gap: 12, alignItems: 'center' }}
              >
                <div className="form-group mb-0" style={{ flex: '1 1 260px' }}>
                  <div className="input-container icon-left position-relative">
                    <span className="input-icon icon-left">
                      <i className="la la-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control form-control-default"
                      placeholder={t('companies.searchPlaceholder')}
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group mb-0" style={{ minWidth: 180 }}>
                  <select
                    className="form-control form-control-default"
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                  >
                    <option value="">{t('common.filter')}</option>
                    <option value="ATIVA">{t('companies.active')}</option>
                    <option value="INATIVA">{t('companies.inactive')}</option>
                    <option value="SUSPENSA">{t('companies.suspended')}</option>
                    <option value="ENCERRADA">{t('companies.closed')}</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center p-4">
                  <SpinDots />
                </div>
              ) : (
                <div className="table4 bg-white mb-10">
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead>
                        <tr className="userDatatable-header">
                          <th>
                            <span className="userDatatable-title">
                              {t('companies.name')}
                            </span>
                          </th>
                          <th>
                            <span className="userDatatable-title">
                              {t('profile.nif')}
                            </span>
                          </th>
                          <th>
                            <span className="userDatatable-title">
                              {t('companies.entityType')}
                            </span>
                          </th>
                          <th>
                            <span className="userDatatable-title">
                              {t('companies.regimeIva')}
                            </span>
                          </th>
                          <th>
                            <span className="userDatatable-title">
                              {t('dashboard.status')}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {empresasFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted p-4">
                              {t('companies.noResults')}
                            </td>
                          </tr>
                        ) : (
                          empresasFiltradas.map((empresa) => (
                            <tr key={empresa.id}>
                              <td>
                                <div className="userDatatable-content fw-600">
                                  {empresa.nome}
                                </div>
                              </td>
                              <td>
                                <div
                                  className="userDatatable-content"
                                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                                >
                                  {empresa.nif}
                                </div>
                              </td>
                              <td>
                                <div className="userDatatable-content">
                                  {rotuloTipo(empresa.tipo_entidade)}
                                </div>
                              </td>
                              <td>
                                <div className="userDatatable-content">
                                  {empresa.regime_iva || '—'}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    BADGE_ESTADO[empresa.estado] || 'badge-primary'
                                  }`}
                                >
                                  {rotuloEstado(empresa.estado)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Empresas;
