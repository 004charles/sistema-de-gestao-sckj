import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../services/api';
import { usePeriodo } from '../context/PeriodoContext';
import Taxas from '../components/definicoes/Taxas';

const BADGE_REGIME = {
  GERAL: 'badge-primary',
  SIMPLIFICADO: 'badge-info',
  EXCLUSAO: 'badge-secondary',
};

const Configuracoes = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { empresaId, atualizar } = usePeriodo();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Boolean(currentUser.is_admin || currentUser.is_superuser || currentUser.is_staff);

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
        .step-pill {
          padding: 8px 16px;
          border-radius: 8px;
          background: #f4f6f9;
          font-weight: 700;
          font-size: 12.5px;
          color: #495057;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .step-pill:hover {
          background: #eaedf2;
          color: #1a3353;
        }
        .step-pill.active {
          background: #e8ebfc;
          color: #1a3353;
          border: 1px solid #c2c9f5;
        }
        .confronto-kpi-card {
          border: 1px solid #edf0f5;
          border-radius: 10px;
          background: #ffffff;
          padding: 18px 20px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .confronto-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        }
        `}
      </style>

      {/* CABEÇALHO DA PÁGINA (ESTILO CONFRONTO) */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-800 color-dark mb-4" style={{ fontSize: 22, color: '#1a3353' }}>
                <i className="la la-cog text-primary mr-6"></i>{' '}
                {t('configuracoes.title', 'Definições da Empresa & Configurações')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                Gestão cadastral da empresa auditada, credenciais de acesso e parâmetros oficiais da AGT.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="btn btn-sm btn-primary d-flex align-items-center"
                onClick={() => navigate('/admin-gestao')}
                style={{
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  backgroundColor: '#5f63f2',
                  borderColor: '#5f63f2',
                  padding: '8px 16px',
                }}
              >
                <i className="la la-shield-alt mr-2" style={{ fontSize: 16 }}></i>
                {t('navigation.admin', 'Painel de Administração')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FAIXA DE RESUMO DA EMPRESA */}
      <div className="card card-default mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10, background: '#fff' }}>
        <div className="card-body p-16">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
            <div className="d-flex align-items-center" style={{ gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: '#5f63f2',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 20,
                }}
              >
                {empresaSelecionada?.nome ? empresaSelecionada.nome.charAt(0).toUpperCase() : 'E'}
              </div>
              <div>
                <strong className="color-dark d-block" style={{ fontSize: 14 }}>
                  {empresaSelecionada?.nome || 'Selecione a Empresa'}
                </strong>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  NIF: {empresaSelecionada?.nif || '---'} · Regime de IVA: {empresaSelecionada?.regime_nome || empresaSelecionada?.regime_iva || 'Geral'}
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <select
                className="form-control form-control-sm"
                value={empresaId}
                onChange={(e) => atualizar({ empresaId: e.target.value })}
                style={{ minWidth: 240, height: 38, fontWeight: 600, fontSize: 13 }}
              >
                {empresas.length === 0 ? (
                  <option value="">Nenhuma empresa cadastrada</option>
                ) : (
                  empresas.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.nome} ({emp.nif})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-primary d-flex align-items-center"
                onClick={() => navigate('/admin-gestao?aba=empresas&novaEmpresa=1')}
                style={{
                  height: 38,
                  borderRadius: 8,
                  fontWeight: 700,
                  backgroundColor: '#5f63f2',
                  borderColor: '#5f63f2',
                  padding: '0 14px',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                }}
                title="Cadastrar Nova Empresa"
              >
                <i className="la la-plus" style={{ fontSize: 15 }}></i>
                <span>Nova Empresa</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CARDS KPIS NO FORMATO DO CONFRONTO */}
      <div className="row mb-20" style={{ rowGap: 12 }}>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #5f63f2' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              NIF da Empresa
            </span>
            <div className="fw-800 color-dark" style={{ fontSize: 22 }}>
              {empresaSelecionada?.nif || '---'}
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Contribuinte Fiscal AGT
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #52c41a' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Regime de IVA
            </span>
            <div className="fw-800" style={{ fontSize: 22, color: '#52c41a' }}>
              {empresaSelecionada?.regime_iva || 'GERAL'}
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Taxa Geral 14%
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #1890ff' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Localização
            </span>
            <div className="fw-800" style={{ fontSize: 22, color: '#1890ff' }}>
              {empresaSelecionada?.provincia || 'Luanda'}
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Município de {empresaSelecionada?.municipio || 'Luanda'}
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #fa8b0c' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Atividade Económica
            </span>
            <div className="fw-800 text-truncate" style={{ fontSize: 16, color: '#fa8b0c', marginTop: 6 }} title={empresaSelecionada?.atividade_principal}>
              CAE {empresaSelecionada?.cae_principal || '46900'}
            </div>
            <span className="text-muted text-truncate d-block" style={{ fontSize: 12 }}>
              {empresaSelecionada?.tipo_entidade_display || 'Sociedade por Quotas'}
            </span>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DE ABAS (ESTILO STEP-PILL DO CONFRONTO) */}
      <div className="d-flex align-items-center mb-20 flex-wrap" style={{ gap: 8 }}>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'empresa' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('empresa')}
        >
          <i className="la la-building"></i> 1. Dados da Empresa
        </button>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'perfil' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('perfil')}
        >
          <i className="la la-user-circle"></i> 2. O Meu Perfil & Credenciais
        </button>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'parametros' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('parametros')}
        >
          <i className="la la-balance-scale"></i> 3. Parâmetros Fiscais (AGT)
        </button>
      </div>

      {/* ABA 1: DADOS DA EMPRESA */}
      {abaAtiva === 'empresa' && (
        <div className="row">
          <div className="col-12 col-lg-4 mb-20">
            <div className="card card-default mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              <div className="card-header bg-white py-14 px-20 border-bottom">
                <span className="fw-700 color-dark" style={{ fontSize: 14 }}>
                  Empresa em Consulta
                </span>
              </div>
              <div className="card-body p-20">
                {empresaSelecionada ? (
                  <div className="p-16 rounded" style={{ background: '#f8f9fb', border: '1px solid #eef0f3' }}>
                    <div className="d-flex align-items-center mb-12" style={{ gap: 10 }}>
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
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        Regime de IVA:
                      </span>
                      <span className={`badge ${BADGE_REGIME[empresaSelecionada.regime_iva] || 'badge-primary'}`}>
                        {empresaSelecionada.regime_nome || empresaSelecionada.regime_iva}
                      </span>
                    </div>

                    <div className="pt-8 d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        Estado Cadastral:
                      </span>
                      <span className="badge badge-success">
                        {empresaSelecionada.estado || 'ATIVA'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted mb-0">Nenhuma empresa selecionada.</p>
                )}
              </div>
            </div>

            <div className="card card-default" style={{ border: '1px solid #c8eedf', background: '#f6fbf9', borderRadius: 10 }}>
              <div className="card-body p-20">
                <div className="d-flex align-items-center mb-8" style={{ gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🛡️</span>
                  <strong className="color-success" style={{ fontSize: 13 }}>
                    Enquadramento Fiscal AGT
                  </strong>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  Dados oficiais utilizados no confronto contabilístico e nos relatórios de auditoria e reconciliação.
                </p>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              <div className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
                <div>
                  <h5 className="fw-700 color-dark mb-0" style={{ fontSize: 15 }}>
                    Ficha Cadastral e Identificação Fiscal
                  </h5>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    Dados oficiais registados para efeitos fiscais e contabilísticos em Angola.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-primary d-flex align-items-center"
                  onClick={() => navigate('/admin-gestao?aba=empresas')}
                  style={{ borderRadius: 6, fontWeight: 600, padding: '6px 12px', fontSize: 12 }}
                >
                  <i className="la la-edit mr-1"></i> Gerir / Editar Cadastro
                </button>
              </div>

              <div className="card-body p-20">
                {carregandoEmpresa ? (
                  <p className="text-muted text-center py-30">A carregar dados da empresa...</p>
                ) : empresaSelecionada ? (
                  <div className="row" style={{ rowGap: 16 }}>
                    <div className="col-12 col-md-8">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        RAZÃO SOCIAL / DENOMINAÇÃO
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
                        NIF (CONTRIBUINTE)
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
                        NOME COMERCIAL
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
                        TIPO DE ENTIDADE
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
                        ATIVIDADE PRINCIPAL
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
                        CÓDIGO CAE
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
                        PROVÍNCIA
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
                        MUNICÍPIO
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
                        REGIME DE IVA
                      </label>
                      <input
                        type="text"
                        className="form-control fw-600"
                        readOnly
                        value={empresaSelecionada.regime_nome || empresaSelecionada.regime_iva || '—'}
                        style={{ background: '#f8f9fb' }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-center py-30">Nenhuma empresa selecionada.</p>
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
            <div className="card card-default text-center p-30" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
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
                {user.role || 'Auditor / Contabilista'}
              </span>
              <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
                {user.email || 'utilizador@empresa.ao'}
              </p>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              <div className="card-header bg-white py-15 px-20 border-bottom">
                <h5 className="fw-700 color-dark mb-0" style={{ fontSize: 15 }}>
                  Credenciais & Segurança da Conta
                </h5>
                <span className="text-muted" style={{ fontSize: 12.5 }}>
                  Atualize o seu nome de utilizador, email e palavra-passe de acesso.
                </span>
              </div>

              <div className="card-body p-20">
                <form onSubmit={handleSalvarPerfil}>
                  <div className="row" style={{ rowGap: 16 }}>
                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        NOME DE UTILIZADOR
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
                        EMAIL DE NOTIFICAÇÃO
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
                        NOVA PALAVRA-PASSE (OPCIONAL)
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
                        CONFIRMAR NOVA PALAVRA-PASSE
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
                        className="btn btn-primary"
                        disabled={salvandoPerfil}
                        style={{ fontWeight: 700, backgroundColor: '#5f63f2', borderColor: '#5f63f2', padding: '8px 20px', borderRadius: 8 }}
                      >
                        {salvandoPerfil ? 'A Guardar...' : 'Guardar Alterações do Perfil'}
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
            <Taxas />
          </div>
        </div>
      )}
    </>
  );
};

export default Configuracoes;
