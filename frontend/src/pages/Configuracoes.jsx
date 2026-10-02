import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../services/api';
import { usePeriodo } from '../context/PeriodoContext';

const BADGE_REGIME = {
  Geral: 'badge-primary',
  Simplificado: 'badge-info',
  Isenção: 'badge-secondary',
};

const Configuracoes = () => {
  const { t } = useTranslation();
  const { empresaId, atualizar } = usePeriodo();

  const [abaAtiva, setAbaAtiva] = useState('empresa'); // 'empresa' | 'perfil' | 'parametros'
  const [empresas, setEmpresas] = useState([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);

  // Perfil do Utilizador
  const [user, setUser] = useState({});
  const [perfilForm, setPerfilForm] = useState({
    username: '',
    email: '',
    nif: '',
    password: '',
    confirmPassword: '',
  });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // Carregar lista de empresas
  useEffect(() => {
    api
      .get('/empresas/')
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data.results || [];
        setEmpresas(lista);
        if (lista.length > 0 && !empresaId) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          const idInicial = String(sckj ? sckj.id : lista[0].id);
          atualizar({ empresaId: idInicial });
        }
      })
      .catch((err) => console.error('Erro ao carregar empresas:', err));
  }, [empresaId, atualizar]);

  // Carregar dados da empresa ativa
  useEffect(() => {
    if (!empresaId) return;
    setCarregandoEmpresa(true);
    api
      .get(`/empresas/${empresaId}/`)
      .then((res) => {
        setEmpresaSelecionada(res.data);
      })
      .catch((err) => {
        console.error('Erro ao buscar detalhe da empresa:', err);
      })
      .finally(() => setCarregandoEmpresa(false));
  }, [empresaId]);

  // Carregar utilizador do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setPerfilForm({
          username: parsed.username || '',
          email: parsed.email || '',
          nif: parsed.nif || '',
          password: '',
          confirmPassword: '',
        });
      } catch (e) {
        console.error('Erro ao ler utilizador:', e);
      }
    }
  }, []);

  const handleSalvarPerfil = (e) => {
    e.preventDefault();
    if (perfilForm.password && perfilForm.password !== perfilForm.confirmPassword) {
      toast.error(t('configuracoes.toastPassMismatch', 'As palavras-passe não coincidem.'));
      return;
    }
    if (perfilForm.password && perfilForm.password.length < 6) {
      toast.error(t('configuracoes.toastPassMin', 'A palavra-passe deve ter pelo menos 6 caracteres.'));
      return;
    }

    setSalvandoPerfil(true);
    const updated = {
      ...user,
      username: perfilForm.username,
      email: perfilForm.email,
      nif: perfilForm.nif,
    };
    if (perfilForm.password) {
      updated.password = perfilForm.password;
    }

    setTimeout(() => {
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setPerfilForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setSalvandoPerfil(false);
      toast.success(t('configuracoes.toastSaved', 'Perfil atualizado com sucesso!'));
    }, 400);
  };

  return (
    <>
      <style>
        {`
        .config-tab-btn {
          border: none;
          background: transparent;
          font-weight: 600;
          font-size: 13.5px;
          padding: 10px 20px;
          border-radius: 8px;
          color: #5a5f7d;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .config-tab-btn:hover {
          background: #edf0f5;
          color: #272b41;
        }
        .config-tab-btn.active {
          background: #5f63f2;
          color: #ffffff;
          box-shadow: 0 3px 8px rgba(95, 99, 242, 0.25);
        }
        .config-card {
          border: 1px solid #edf0f5;
          border-radius: 10px;
          background: #fff;
        }
        `}
      </style>

      {/* CABEÇALHO */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-700 color-dark mb-4" style={{ fontSize: 20 }}>
                <i className="la la-cog text-primary mr-6"></i>{' '}
                {t('configuracoes.title', 'Configurações do Sistema')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {t(
                  'configuracoes.subtitle',
                  'Gestão cadastral da empresa auditada, credenciais de acesso e parâmetros oficiais da AGT.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="row mb-20">
        <div className="col-12">
          <div
            className="d-flex flex-wrap align-items-center p-6"
            style={{ background: '#f4f5f7', borderRadius: 10, gap: 6 }}
          >
            <button
              type="button"
              className={`config-tab-btn ${abaAtiva === 'empresa' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('empresa')}
            >
              <i className="la la-building"></i> {t('configuracoes.tabs.company', '1. Dados da Empresa')}
            </button>
            <button
              type="button"
              className={`config-tab-btn ${abaAtiva === 'perfil' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('perfil')}
            >
              <i className="la la-user-circle"></i>{' '}
              {t('configuracoes.tabs.profile', '2. O Meu Perfil & Credenciais')}
            </button>
            <button
              type="button"
              className={`config-tab-btn ${abaAtiva === 'parametros' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('parametros')}
            >
              <i className="la la-balance-scale"></i>{' '}
              {t('configuracoes.tabs.params', '3. Parâmetros Fiscais (AGT)')}
            </button>
          </div>
        </div>
      </div>

      {/* ABA 1: DADOS DA EMPRESA */}
      {abaAtiva === 'empresa' && (
        <div className="row">
          <div className="col-12 col-lg-4 mb-20">
            {/* Seletor de Empresa */}
            <div className="card config-card mb-20">
              <div className="card-header py-12 px-20 border-bottom">
                <span className="fw-700 color-dark" style={{ fontSize: 13.5 }}>
                  {t('configuracoes.companyTab.companyInConsultation', 'Empresa em Consulta')}
                </span>
              </div>
              <div className="card-body p-20">
                <label className="fw-600 text-muted mb-6" style={{ fontSize: 11.5 }}>
                  {t('configuracoes.companyTab.selectCompany', 'SELECIONE A EMPRESA')}
                </label>
                <select
                  className="form-control form-control-default"
                  value={empresaId}
                  onChange={(e) => atualizar({ empresaId: e.target.value })}
                  style={{ height: 42, fontSize: 13, fontWeight: 500 }}
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.nome} (NIF: {emp.nif})
                    </option>
                  ))}
                </select>

                {empresaSelecionada && (
                  <div className="mt-20 p-15 rounded" style={{ background: '#f8f9fb', border: '1px solid #eef0f3' }}>
                    <div className="d-flex align-items-center mb-10" style={{ gap: 10 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: '#5f63f2',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          fontWeight: 700,
                        }}
                      >
                        {empresaSelecionada.nome ? empresaSelecionada.nome.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <div>
                        <strong className="color-dark d-block" style={{ fontSize: 13.5 }}>
                          {empresaSelecionada.nome}
                        </strong>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          NIF: {empresaSelecionada.nif}
                        </span>
                      </div>
                    </div>

                    <div className="pt-10 border-top d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: 11.5 }}>
                        {t('configuracoes.companyTab.vatRegime', 'Regime de IVA')}:
                      </span>
                      <span className={`badge ${BADGE_REGIME[empresaSelecionada.regime_iva] || 'badge-primary'}`}>
                        {empresaSelecionada.regime_iva || 'Geral'}
                      </span>
                    </div>

                    <div className="pt-6 d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: 11.5 }}>
                        {t('configuracoes.companyTab.legalStatus', 'Estado Cadastral')}:
                      </span>
                      <span className="badge badge-success">
                        {empresaSelecionada.estado || t('configuracoes.companyTab.active', 'ATIVA')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Aviso de Governança Fiscal */}
            <div className="card config-card" style={{ border: '1px solid #c8eedf', background: '#f6fbf9' }}>
              <div className="card-body p-20">
                <div className="d-flex align-items-center mb-8" style={{ gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🛡️</span>
                  <strong className="color-success" style={{ fontSize: 13 }}>
                    {t('configuracoes.companyTab.taxFramework', 'Enquadramento Fiscal')}
                  </strong>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  {t(
                    'configuracoes.companyTab.registrationSubtitle',
                    'Informações utilizadas na identificação e nos cabeçalhos dos pareceres de reconciliação.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card config-card">
              <div className="card-header py-15 px-25 border-bottom d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
                    {t('configuracoes.companyTab.registration', 'Ficha Cadastral e Identificação Fiscal')}
                  </h5>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    {t(
                      'configuracoes.companyTab.registrationSubtitle',
                      'Dados oficiais registados para efeitos fiscais e contabilísticos em Angola.'
                    )}
                  </span>
                </div>
              </div>

              <div className="card-body p-25">
                {carregandoEmpresa ? (
                  <p className="text-muted text-center py-30">
                    {t('common.loading', 'A carregar dados da empresa...')}
                  </p>
                ) : empresaSelecionada ? (
                  <div className="row" style={{ rowGap: 16 }}>
                    <div className="col-12 col-md-8">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.corporateName', 'RAZÃO SOCIAL / DENOMINAÇÃO')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.nome || ''}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.nifLabel', 'NIF (CONTRIBUINTE)')}
                      </label>
                      <input
                        type="text"
                        className="form-control fw-700 color-dark"
                        readOnly
                        value={empresaSelecionada.nif || ''}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('companies.name', 'NOME COMERCIAL')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.nome_comercial || empresaSelecionada.nome || ''}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('companies.entityType', 'TIPO DE ENTIDADE')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.tipo_entidade_display || empresaSelecionada.tipo_entidade || 'Sociedade por Quotas'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-8">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.caeLabel', 'ACTIVIDADE PRINCIPAL')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.atividade_principal || 'Comércio Geral e Prestação de Serviços'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.caeLabel', 'CÓDIGO CAE')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.cae_principal || '46900'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.cityLabel', 'PROVÍNCIA')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.provincia || 'Luanda'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.cityLabel', 'MUNICÍPIO')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={empresaSelecionada.municipio || 'Luanda'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.companyTab.regimeLabel', 'REGIME DE IVA')}
                      </label>
                      <input
                        type="text"
                        className="form-control fw-600"
                        readOnly
                        value={empresaSelecionada.regime_iva || 'Geral'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-center py-30">{t('companies.noResults', 'Nenhuma empresa selecionada.')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: O MEU PERFIL & CREDENCIAIS */}
      {abaAtiva === 'perfil' && (
        <div className="row">
          <div className="col-12 col-lg-4 mb-20">
            <div className="card config-card text-center p-30">
              <div
                className="mx-auto mb-15"
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: '50%',
                  backgroundColor: '#5f63f2',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                {user.username ? user.username.slice(0, 2).toUpperCase() : 'AU'}
              </div>
              <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 16 }}>
                {user.username || 'Auditor Fiscal'}
              </h5>
              <span className="badge badge-primary px-10 py-4 mb-10" style={{ fontSize: 11 }}>
                {t('profile.title', 'Perfil')}: {user.role || 'Auditor / Contabilista'}
              </span>
              <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
                {user.email || 'utilizador@empresa.ao'}
              </p>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card config-card">
              <div className="card-header py-15 px-25 border-bottom">
                <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
                  {t('configuracoes.profileTab.title', 'Credenciais & Segurança da Conta')}
                </h5>
                <span className="text-muted" style={{ fontSize: 12.5 }}>
                  {t(
                    'configuracoes.profileTab.subtitle',
                    'Atualize o seu nome de utilizador, email e palavra-passe de acesso.'
                  )}
                </span>
              </div>

              <div className="card-body p-25">
                <form onSubmit={handleSalvarPerfil}>
                  <div className="row" style={{ rowGap: 16 }}>
                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.profileTab.username', 'NOME DE UTILIZADOR')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={perfilForm.username}
                        onChange={(e) => setPerfilForm({ ...perfilForm, username: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.profileTab.email', 'EMAIL DE NOTIFICAÇÃO')}
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        value={perfilForm.email}
                        onChange={(e) => setPerfilForm({ ...perfilForm, email: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.profileTab.password', 'NOVA PALAVRA-PASSE (OPCIONAL)')}
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Mínimo de 6 caracteres"
                        value={perfilForm.password}
                        onChange={(e) => setPerfilForm({ ...perfilForm, password: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        {t('configuracoes.profileTab.confirmPassword', 'CONFIRMAR NOVA PALAVRA-PASSE')}
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Repita a nova palavra-passe"
                        value={perfilForm.confirmPassword}
                        onChange={(e) => setPerfilForm({ ...perfilForm, confirmPassword: e.target.value })}
                      />
                    </div>

                    <div className="col-12 pt-10">
                      <button
                        type="submit"
                        className="btn btn-primary btn-squared"
                        disabled={salvandoPerfil}
                        style={{ fontWeight: 600 }}
                      >
                        {salvandoPerfil
                          ? t('configuracoes.profileTab.updatingBtn', 'A Guardar...')
                          : t('configuracoes.profileTab.updateBtn', 'Guardar Alterações do Perfil')}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PARÂMETROS FISCAIS (AGT) */}
      {abaAtiva === 'parametros' && (
        <div className="row">
          <div className="col-12">
            <div className="card config-card">
              <div className="card-header py-15 px-25 border-bottom">
                <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
                  {t('configuracoes.taxRatesTab.title', 'Tabela Oficial de Taxas Tributárias (Angola - AGT)')}
                </h5>
                <span className="text-muted" style={{ fontSize: 12.5 }}>
                  {t(
                    'configuracoes.taxRatesTab.subtitle',
                    'Parâmetros normativos aplicados pelos motores de auditoria na verificação de conformidade.'
                  )}
                </span>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-bordered mb-0" style={{ fontSize: 13 }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ width: '25%', fontWeight: 700 }}>
                          {t('configuracoes.taxRatesTab.tax', 'Imposto / Tributo')}
                        </th>
                        <th style={{ width: '15%', fontWeight: 700 }}>
                          {t('configuracoes.taxRatesTab.baseRate', 'Taxa Legal')}
                        </th>
                        <th style={{ width: '35%', fontWeight: 700 }}>
                          {t('configuracoes.taxRatesTab.legalBasis', 'Enquadramento Legal')}
                        </th>
                        <th style={{ width: '25%', fontWeight: 700 }}>
                          {t('coverage.motorsList.M11', 'Prazo de Cumprimento')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>IVA (Imposto sobre o Valor Acrescentado)</strong></td>
                        <td><span className="badge badge-primary">14% (Geral)</span></td>
                        <td>Código do IVA (Lei n.º 7/19 de 24 de Abril)</td>
                        <td>Último dia do mês seguinte ao do período</td>
                      </tr>
                      <tr>
                        <td><strong>Retenção na Fonte a Prestadores</strong></td>
                        <td><span className="badge badge-warning">6,5%</span></td>
                        <td>Código do Imposto Industrial (Art. 73.º) e Código do IRT</td>
                        <td>Até ao último dia do mês seguinte ao pagamento</td>
                      </tr>
                      <tr>
                        <td><strong>Segurança Social (INSS) - Patronal</strong></td>
                        <td><span className="badge badge-info">8% (Empresa)</span></td>
                        <td>Decreto Presidencial n.º 227/18 de 27 de Setembro</td>
                        <td>Até ao dia 10 do mês seguinte</td>
                      </tr>
                      <tr>
                        <td><strong>Segurança Social (INSS) - Trabalhador</strong></td>
                        <td><span className="badge badge-info">3% (Trabalhador)</span></td>
                        <td>Decreto Presidencial n.º 227/18 de 27 de Setembro</td>
                        <td>Até ao dia 10 do mês seguinte</td>
                      </tr>
                      <tr>
                        <td><strong>Regra de Caixa Negativo</strong></td>
                        <td><span className="badge badge-danger">Saldo Devedor Obrigatório</span></td>
                        <td>Art. 57.º do Código Geral Tributário (Presunção de Proveitos Omitidos)</td>
                        <td>Permanente (Conta 4511 não pode ser credora)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Configuracoes;
