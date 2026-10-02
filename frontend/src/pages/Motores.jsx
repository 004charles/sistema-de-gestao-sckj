import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../services/api';
import { ESTADOS_OCORRENCIA_SIMPLES, getMotorAmigavel } from '../utils/motoresExplicados';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';

const MESES = [
  { valor: '1', chave: 'january', nome: 'Janeiro' },
  { valor: '2', chave: 'february', nome: 'Fevereiro' },
  { valor: '3', chave: 'march', nome: 'Março' },
  { valor: '4', chave: 'april', nome: 'Abril' },
  { valor: '5', chave: 'may', nome: 'Maio' },
  { valor: '6', chave: 'june', nome: 'Junho' },
  { valor: '7', chave: 'july', nome: 'Julho' },
  { valor: '8', chave: 'august', nome: 'Agosto' },
  { valor: '9', chave: 'september', nome: 'Setembro' },
  { valor: '10', chave: 'october', nome: 'Outubro' },
  { valor: '11', chave: 'november', nome: 'Novembro' },
  { valor: '12', chave: 'december', nome: 'Dezembro' },
];

const MOTOR_ICONES = {
  M1: 'la la-coins text-primary',
  M2: 'la la-users text-info',
  M3: 'la la-chart-pie text-secondary',
  M4: 'la la-hand-holding-usd text-warning',
  M5: 'la la-shield-alt text-success',
  M6: 'la la-stamp text-purple',
  M7: 'la la-file-invoice text-info',
  M8: 'la la-cash-register text-danger',
  M9: 'la la-university text-primary',
  M10: 'la la-tachometer-alt text-danger',
  M11: 'la la-calendar-check text-warning',
  M12: 'la la-calculator text-dark',
  M13: 'la la-exclamation-circle text-orange',
  M14: 'la la-history text-muted',
  M15: 'la la-clipboard-check text-success',
};

const SEMAFORO_CONFIG = {
  CONFORME: {
    cor: '#20c997',
    bg: '#e8faf4',
    badge: 'badge-success',
    icone: 'la la-check-circle',
    label: 'Tudo Certo (Aprovado)',
  },
  ATENCAO: {
    cor: '#fa8b0c',
    bg: '#fff3e2',
    badge: 'badge-warning',
    icone: 'la la-exclamation-triangle',
    label: 'Atenção (Diferenças)',
  },
  ALERTA: {
    cor: '#ff4d4f',
    bg: '#ffecec',
    badge: 'badge-danger',
    icone: 'la la-times-circle',
    label: 'Crítico (Risco de Multa)',
  },
  NAO_ANALISADO: {
    cor: '#9299b8',
    bg: '#f4f5f7',
    badge: 'badge-secondary',
    icone: 'la la-minus-circle',
    label: 'Ainda Não Verificado',
  },
};

const SEVERIDADE_CONFIG = {
  ALTO: {
    cor: '#ff4d4f',
    bg: '#ffecec',
    badge: 'badge-danger',
    label: 'Crítico (Urgente)',
    icone: <i className="la la-exclamation-triangle" style={{ fontSize: 13 }}></i>,
  },
  MEDIO: {
    cor: '#fa8b0c',
    bg: '#fff3e2',
    badge: 'badge-warning',
    label: 'Atenção (Rever)',
    icone: <i className="la la-exclamation-triangle" style={{ fontSize: 13 }}></i>,
  },
  BAIXO: {
    cor: '#fa8b0c',
    bg: '#fff8ec',
    badge: 'badge-warning',
    label: 'Pequeno Ajuste',
    icone: <i className="la la-info-circle" style={{ fontSize: 13 }}></i>,
  },
  INFORMATIVO: {
    cor: '#20c997',
    bg: '#e8faf4',
    badge: 'badge-success',
    label: 'Em Ordem / Informativo',
    icone: <i className="la la-check-circle" style={{ fontSize: 13 }}></i>,
  },
};

const ESTADOS_OCORRENCIA = ESTADOS_OCORRENCIA_SIMPLES;

const SpinDots = () => (
  <span className="atbd-spin-dots spin-lg">
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
  </span>
);

const formatKz = (val) => {
  if (val === null || val === undefined) return '0,00 Kz';
  const num =
    typeof val === 'number'
      ? val
      : parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
  return `${num.toLocaleString('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kz`;
};

const Motores = () => {
  const { t } = useTranslation();
  const { codigo } = useParams();
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();

  const { empresaId, ano, mes, atualizar, escolherSeAusente } = usePeriodo();
  usePeriodoDaUrl();

  const setEmpresaId = (v) => atualizar({ empresaId: v });
  const setAno = (v) => atualizar({ ano: v });
  const setMes = (v) => atualizar({ mes: v });

  const [empresas, setEmpresas] = useState([]);
  const [motorAtivoCodigo, setMotorAtivoCodigo] = useState(codigo || 'M1');
  const [dadosAuditoria, setDadosAuditoria] = useState(null);
  const [todasRegras, setTodasRegras] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [executando, setExecutando] = useState(false);

  // Filtros de interface
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'alertas' | 'conformes'
  const [busca, setBusca] = useState('');

  // Modais
  const [evidenciaModal, setEvidenciaModal] = useState(null);
  const [novoEstadoOcc, setNovoEstadoOcc] = useState('');
  const [atualizandoOcc, setAtualizandoOcc] = useState(false);

  const getMesNome = useCallback(
    (valor) => {
      const mObj = MESES.find((m) => m.valor === String(valor));
      return mObj ? t(`months.${mObj.chave}`, mObj.nome) : valor;
    },
    [t]
  );

  // Carregar lista de empresas
  useEffect(() => {
    api
      .get('/empresas/')
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setEmpresas(lista);
        if (lista.length > 0) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          escolherSeAusente({ empresaId: String(sckj ? sckj.id : lista[0].id) });
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar empresas:', err);
      });
  }, [escolherSeAusente]);

  // Carregar todas as regras cadastradas
  useEffect(() => {
    api
      .get('/regras/')
      .then((res) => {
        setTodasRegras(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Erro ao buscar regras:', err);
      });
  }, []);

  // Carregar dados de auditoria do período
  const carregarDadosAuditoria = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const res = await api.get(`/auditoria/${empresaId}/${ano}/${mes}/dashboard/`);
      setDadosAuditoria(res.data);
    } catch (err) {
      console.error('Erro ao carregar dados dos motores:', err);
      setDadosAuditoria(null);
    } finally {
      setCarregando(false);
    }
  }, [empresaId, ano, mes]);

  useEffect(() => {
    carregarDadosAuditoria();
  }, [carregarDadosAuditoria]);

  // Sincronizar parâmetro :codigo na URL
  useEffect(() => {
    if (codigo && codigo !== motorAtivoCodigo) {
      setMotorAtivoCodigo(codigo);
    }
  }, [codigo, motorAtivoCodigo]);

  // Executar motor de auditoria no período
  const handleExecutarAuditoria = async () => {
    if (!empresaId) return;
    setExecutando(true);
    try {
      const res = await api.post('/ocorrencias/executar/', {
        empresa: parseInt(empresaId, 10),
        ano: parseInt(ano, 10),
        mes: parseInt(mes, 10),
      });
      const criadas = res.data.ocorrencias_criadas || 0;
      const atualizadas = res.data.ocorrencias_actualizadas || 0;
      toast.success(
        t('enginesPage.auditSuccess', {
          criadas,
          atualizadas,
          defaultValue: `Auditoria executada! ${criadas} novo(s) achado(s), ${atualizadas} atualizado(s).`,
        })
      );
      await carregarDadosAuditoria();
    } catch (err) {
      const msg = err.response?.data?.error || t('enginesPage.auditError', 'Erro ao executar auditoria.');
      toast.error(msg);
    } finally {
      setExecutando(false);
    }
  };

  // Abrir modal de evidência
  const handleAbrirEvidencia = (occ) => {
    setEvidenciaModal(occ);
    setNovoEstadoOcc(occ.estado || 'POR_REVER');
  };

  // Atualizar estado de ocorrência
  const handleSalvarEstadoOcorrencia = async () => {
    if (!evidenciaModal || !novoEstadoOcc) return;
    setAtualizandoOcc(true);
    try {
      await api.patch(`/ocorrencias/${evidenciaModal.id}/`, {
        estado: novoEstadoOcc,
      });
      toast.success(t('enginesPage.modal.statusSavedSuccess', 'Estado atualizado com sucesso.'));
      setEvidenciaModal(null);
      await carregarDadosAuditoria();
    } catch (err) {
      const msg = err.response?.data?.error || t('enginesPage.modal.statusSaveError', 'Erro ao atualizar estado.');
      toast.error(msg);
    } finally {
      setAtualizandoOcc(false);
    }
  };

  // Extrair motores e ocorrências com referências estáveis
  const motores = useMemo(() => dadosAuditoria?.motores || [], [dadosAuditoria]);
  const todasOcorrencias = useMemo(() => dadosAuditoria?.ocorrencias || [], [dadosAuditoria]);
  const mesNome = getMesNome(mes);

  // Motor selecionado
  const motorAtivo = useMemo(() => {
    return (
      motores.find((m) => m.codigo === motorAtivoCodigo) ||
      motores[0] || {
        codigo: motorAtivoCodigo,
        nome: `Motor ${motorAtivoCodigo}`,
        descricao: '',
        status_semaforo: 'NAO_ANALISADO',
        cobertura: 0,
        documentos_requeridos: [],
        documentos_disponiveis: [],
        documentos_em_falta: [],
      }
    );
  }, [motores, motorAtivoCodigo]);

  // Ocorrências deste motor específico
  const ocorrenciasDoMotor = useMemo(() => {
    return todasOcorrencias.filter((o) => o.regra?.motor === motorAtivoCodigo);
  }, [todasOcorrencias, motorAtivoCodigo]);

  // Regras cadastradas para este motor
  const regrasDoMotor = useMemo(() => {
    return todasRegras.filter((r) => r.motor === motorAtivoCodigo);
  }, [todasRegras, motorAtivoCodigo]);

  // Métricas executivas gerais dos 15 motores
  const kpiStats = useMemo(() => {
    let conformes = 0;
    let atencao = 0;
    let alerta = 0;
    let totalRisco = 0;

    motores.forEach((m) => {
      if (m.status_semaforo === 'CONFORME') conformes += 1;
      else if (m.status_semaforo === 'ATENCAO') atencao += 1;
      else if (m.status_semaforo === 'ALERTA') alerta += 1;
    });

    todasOcorrencias.forEach((o) => {
      const val = parseFloat(String(o.valor_envolvido || 0).replace(',', '.'));
      if (!isNaN(val)) totalRisco += val;
    });

    return {
      total: motores.length || 15,
      conformes,
      atencao,
      alerta,
      totalRisco,
    };
  }, [motores, todasOcorrencias]);

  // Filtragem dos módulos para o card grid
  const motoresFiltrados = useMemo(() => {
    return motores.filter((m) => {
      const amigavel = getMotorAmigavel(m.codigo);
      const termo = busca.toLowerCase().trim();

      // Filtro de texto
      const bateTexto =
        !termo ||
        m.codigo.toLowerCase().includes(termo) ||
        (m.nome || '').toLowerCase().includes(termo) ||
        (amigavel.tituloSimples || '').toLowerCase().includes(termo) ||
        (amigavel.subtitulo || '').toLowerCase().includes(termo);

      if (!bateTexto) return false;

      // Filtro de status
      if (filtroStatus === 'alertas') {
        return m.alertas_total > 0 || m.status_semaforo === 'ALERTA' || m.status_semaforo === 'ATENCAO';
      }
      if (filtroStatus === 'conformes') {
        return m.status_semaforo === 'CONFORME';
      }
      return true;
    });
  }, [motores, busca, filtroStatus]);

  const semaforoAtivo = SEMAFORO_CONFIG[motorAtivo?.status_semaforo] || SEMAFORO_CONFIG.NAO_ANALISADO;
  const amigavelAtivo = getMotorAmigavel(motorAtivo.codigo);

  const selecionarMotor = (cod) => {
    setMotorAtivoCodigo(cod);
    navigate(`/motores/${cod}?empresa=${empresaId}&ano=${ano}&mes=${mes}`);
  };

  return (
    <>
      <style>
        {`
        .motor-kpi-card {
          background: #ffffff;
          border: 1px solid #edf0f5;
          border-radius: 10px;
          padding: 14px 18px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .motor-kpi-card:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.04);
        }
        .motor-grid-card {
          background: #ffffff;
          border: 1px solid #edf0f5;
          border-radius: 10px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        .motor-grid-card:hover {
          border-color: #bcc0fa;
          box-shadow: 0 4px 14px rgba(95, 99, 242, 0.08);
          transform: translateY(-2px);
        }
        .motor-grid-card.ativo {
          border-color: #5f63f2;
          background: #fdfdff;
          box-shadow: 0 4px 16px rgba(95, 99, 242, 0.14);
        }
        .motor-filter-pill {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-weight: 600;
          font-size: 12.5px;
          padding: 6px 14px;
          border-radius: 20px;
          color: #5a5f7d;
          transition: all 0.2s ease;
        }
        .motor-filter-pill:hover {
          background: #f4f5f7;
          color: #272b41;
        }
        .motor-filter-pill.active {
          background: #5f63f2;
          border-color: #5f63f2;
          color: #ffffff;
        }
        `}
      </style>

      {/* 1. BARRA SUPERIOR & TÍTULO */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-700 color-dark mb-4" style={{ fontSize: 20 }}>
                <i className="la la-shield-alt text-primary mr-6"></i>{' '}
                {t('enginesPage.title', 'Os 15 Módulos de Verificação Fiscal & Contabilística')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {t(
                  'enginesPage.subtitle',
                  'Raio-X automatizado de todos os impostos, saúde da caixa, folha salarial e conformidade AGT'
                )}
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-default btn-squared"
                onClick={handleExecutarAuditoria}
                disabled={executando || !empresaId}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <i className={`la ${executando ? 'la-spinner la-spin' : 'la-play'} mr-5`}></i>
                {executando
                  ? t('enginesPage.runningAudit', 'A Processar Auditoria...')
                  : t('enginesPage.runAuditBtn', 'Verificar Contas deste Mês')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SELETOR COMPACTO DE EMPRESA E PERÍODO */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-15">
              <div className="d-flex flex-wrap align-items-center" style={{ gap: 14 }}>
                <div style={{ flex: '2 1 260px' }}>
                  <label htmlFor="motor-empresa" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('enginesPage.auditedCompany', 'EMPRESA AUDITADA')}
                  </label>
                  <select
                    id="motor-empresa"
                    className="form-control form-control-default"
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    style={{ height: 40, fontSize: 13, fontWeight: 500 }}
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.nome} (NIF: {emp.nif})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="motor-mes" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('enginesPage.fiscalMonth', 'MÊS FISCAL')}
                  </label>
                  <select
                    id="motor-mes"
                    className="form-control form-control-default"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    style={{ height: 40, fontSize: 13, fontWeight: 500 }}
                  >
                    {MESES.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {t(`months.${m.chave}`, m.nome)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 120px' }}>
                  <label htmlFor="motor-ano" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('enginesPage.fiscalYear', 'EXERCÍCIO')}
                  </label>
                  <select
                    id="motor-ano"
                    className="form-control form-control-default"
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    style={{ height: 40, fontSize: 13, fontWeight: 500 }}
                  >
                    {[anoAtual, anoAtual - 1, 2026, 2025, 2024]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="d-none d-lg-flex align-items-center ml-auto pl-15" style={{ borderLeft: '1px solid #edf0f5' }}>
                  <div className="text-right">
                    <span className="d-block text-muted" style={{ fontSize: 11 }}>
                      {t('enginesPage.kpi.totalRisk', 'VALOR TOTAL EM RISCO')}
                    </span>
                    <strong className="d-block color-danger" style={{ fontSize: 16 }}>
                      {formatKz(kpiStats.totalRisco)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="row mb-25">
          <div className="col-12 text-center p-4">
            <SpinDots />
          </div>
        </div>
      )}

      {/* 3. CARDS DE SÍNTESE EXECUTIVA (KPIS GERAIS DOS 15 MÓDULOS) */}
      {!carregando && (
        <div className="row mb-20" style={{ rowGap: 12 }}>
          <div className="col-6 col-lg-3">
            <div className="motor-kpi-card h-100">
              <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                {t('enginesPage.kpi.totalModules', 'Total de Módulos')}
              </span>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-700 color-dark" style={{ fontSize: 20 }}>15</span>
                <i className="la la-cubes text-primary" style={{ fontSize: 24 }}></i>
              </div>
              <span className="text-muted d-block mt-4" style={{ fontSize: 11.5 }}>
                100% integrados PGC / AGT
              </span>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="motor-kpi-card h-100">
              <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                {t('enginesPage.kpi.compliant', 'Conformes')}
              </span>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-700 color-success" style={{ fontSize: 20 }}>{kpiStats.conformes}</span>
                <i className="la la-check-circle text-success" style={{ fontSize: 24 }}></i>
              </div>
              <span className="text-muted d-block mt-4" style={{ fontSize: 11.5 }}>
                Sem risco fiscal apurado
              </span>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="motor-kpi-card h-100">
              <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                {t('enginesPage.kpi.attention', 'Em Atenção')}
              </span>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-700 color-warning" style={{ fontSize: 20 }}>{kpiStats.atencao}</span>
                <i className="la la-exclamation-triangle text-warning" style={{ fontSize: 24 }}></i>
              </div>
              <span className="text-muted d-block mt-4" style={{ fontSize: 11.5 }}>
                Divergências a verificar
              </span>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="motor-kpi-card h-100">
              <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                {t('enginesPage.kpi.alert', 'Em Alerta')}
              </span>
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-700 color-danger" style={{ fontSize: 20 }}>{kpiStats.alerta}</span>
                <i className="la la-times-circle text-danger" style={{ fontSize: 24 }}></i>
              </div>
              <span className="text-muted d-block mt-4" style={{ fontSize: 11.5 }}>
                Risco imediato de coima
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. BARRA DE FILTRO E PESQUISA DOS 15 MÓDULOS */}
      {!carregando && (
        <div className="row mb-15">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
              <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`motor-filter-pill ${filtroStatus === 'todos' ? 'active' : ''}`}
                  onClick={() => setFiltroStatus('todos')}
                >
                  {t('enginesPage.filter.all', 'Todos os 15 Módulos')}
                </button>
                <button
                  type="button"
                  className={`motor-filter-pill ${filtroStatus === 'alertas' ? 'active' : ''}`}
                  onClick={() => setFiltroStatus('alertas')}
                >
                  <i className="la la-exclamation-circle mr-4"></i>
                  {t('enginesPage.filter.withIssues', 'Com Pendências / Alertas')}
                  {kpiStats.alerta + kpiStats.atencao > 0 && (
                    <span className="badge badge-danger ml-5" style={{ fontSize: 10 }}>
                      {kpiStats.alerta + kpiStats.atencao}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`motor-filter-pill ${filtroStatus === 'conformes' ? 'active' : ''}`}
                  onClick={() => setFiltroStatus('conformes')}
                >
                  <i className="la la-check mr-4"></i>
                  {t('enginesPage.filter.compliant', 'Conformes')}
                </button>
              </div>

              <div style={{ minWidth: 260, maxWidth: 360, flex: 1 }}>
                <div className="input-container icon-left position-relative">
                  <span className="input-icon icon-left la la-search text-muted"></span>
                  <input
                    type="text"
                    className="form-control form-control-default"
                    placeholder={t('enginesPage.filter.searchPlaceholder', 'Pesquisar módulo (ex: IVA, Caixa, IRT, INSS)...')}
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    style={{ height: 38, fontSize: 12.5 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. GRID VISUAL DOS 15 MÓDULOS (CLARO, ACESSÍVEL, CLICÁVEL) */}
      {!carregando && (
        <div className="row mb-25" style={{ rowGap: 10 }}>
          {motoresFiltrados.map((m) => {
            const sem = SEMAFORO_CONFIG[m.status_semaforo] || SEMAFORO_CONFIG.NAO_ANALISADO;
            const amigavel = getMotorAmigavel(m.codigo);
            const ativo = m.codigo === motorAtivoCodigo;
            const iconeClasse = MOTOR_ICONES[m.codigo] || 'la la-shield-alt text-primary';

            return (
              <div className="col-12 col-md-6 col-xl-4" key={m.codigo}>
                <div
                  className={`motor-grid-card h-100 ${ativo ? 'ativo' : ''}`}
                  onClick={() => selecionarMotor(m.codigo)}
                >
                  <div className="d-flex justify-content-between align-items-center mb-6">
                    <div className="d-flex align-items-center" style={{ gap: 8 }}>
                      <i className={iconeClasse} style={{ fontSize: 20 }}></i>
                      <strong className="color-dark" style={{ fontSize: 13.5 }}>
                        {amigavel.tituloSimples || m.nome}
                      </strong>
                    </div>
                    <span className={`badge ${sem.badge}`} style={{ fontSize: 10, fontWeight: 700 }}>
                      <i className={sem.icone} style={{ marginRight: 3 }}></i>
                      {m.codigo}
                    </span>
                  </div>

                  <p className="text-muted mb-8" style={{ fontSize: 11.5, lineHeight: 1.4, minHeight: 32 }}>
                    {amigavel.subtitulo || m.descricao}
                  </p>

                  <div className="d-flex justify-content-between align-items-center pt-8 border-top" style={{ fontSize: 11.5 }}>
                    <span className="text-muted">
                      {m.alertas_total > 0 ? (
                        <span className="color-danger fw-700">
                          ⚠️ {t('enginesPage.card.findings', { count: m.alertas_total, defaultValue: `${m.alertas_total} achado(s)` })}
                        </span>
                      ) : m.status_semaforo === 'CONFORME' ? (
                        <span className="color-success fw-600">
                          ✓ {t('enginesPage.card.noFindings', 'Sem pendências')}
                        </span>
                      ) : (
                        <span>{t('enginesPage.card.notVerified', 'Não verificado')}</span>
                      )}
                    </span>

                    <span className="fw-600 color-primary" style={{ fontSize: 11.5 }}>
                      {ativo ? 'Ver Detalhes ↓' : 'Explorar →'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. PAINEL DE DETALHES DO MÓDULO SELECIONADO */}
      {!carregando && (
        <div className="row mb-30" id={`detalhes-${motorAtivo.codigo}`}>
          <div className="col-12">
            <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              {/* CABEÇALHO DO MÓDULO */}
              <div
                className="card-header py-16 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap"
                style={{ gap: 10, backgroundColor: '#fdfdff' }}
              >
                <div>
                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                    <span className="badge badge-primary px-8 py-3" style={{ fontSize: 12, fontWeight: 700 }}>
                      {motorAtivo.codigo}
                    </span>
                    <h5 className="fw-700 color-dark mb-0" style={{ fontSize: 16 }}>
                      {amigavelAtivo.tituloSimples || motorAtivo.nome}
                    </h5>
                  </div>
                  <span className="d-block text-muted mt-3" style={{ fontSize: 12.5 }}>
                    {amigavelAtivo.subtitulo || motorAtivo.descricao}
                  </span>
                </div>

                <div className="text-right">
                  <span className={`badge ${semaforoAtivo.badge} px-10 py-5`} style={{ fontSize: 12, fontWeight: 700 }}>
                    <i className={semaforoAtivo.icone} style={{ marginRight: 4 }}></i>
                    {semaforoAtivo.label}
                  </span>
                  <span className="d-block text-muted mt-4" style={{ fontSize: 11 }}>
                    {t('enginesPage.detail.situationIn', { mes: mesNome, ano, defaultValue: `Situação em ${mesNome}/${ano}` })}
                  </span>
                </div>
              </div>

              <div className="card-body p-20">
                {/* 3 MÉTRICAS DO MÓDULO */}
                <div className="row mb-20" style={{ rowGap: 10 }}>
                  <div className="col-12 col-md-4">
                    <div className="p-14 rounded" style={{ backgroundColor: '#f8f9fb', border: '1px solid #eef0f3' }}>
                      <span className="text-muted d-block fw-600 mb-4" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        {t('enginesPage.detail.docsChecked', 'DOCUMENTOS VERIFICADOS')}
                      </span>
                      <strong className="d-block color-dark" style={{ fontSize: 18 }}>
                        {motorAtivo.cobertura !== null ? `${motorAtivo.cobertura}%` : 'Geral'}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="p-14 rounded" style={{ backgroundColor: '#f8f9fb', border: '1px solid #eef0f3' }}>
                      <span className="text-muted d-block fw-600 mb-4" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        {t('enginesPage.detail.pointsToFix', 'PONTOS A CORRIGIR')}
                      </span>
                      <strong
                        className={`d-block ${ocorrenciasDoMotor.length > 0 ? 'color-danger' : 'color-success'}`}
                        style={{ fontSize: 18 }}
                      >
                        {ocorrenciasDoMotor.length}{' '}
                        {ocorrenciasDoMotor.length === 1
                          ? t('enginesPage.detail.point', 'ponto')
                          : t('enginesPage.detail.points', 'pontos')}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="p-14 rounded" style={{ backgroundColor: '#f8f9fb', border: '1px solid #eef0f3' }}>
                      <span className="text-muted d-block fw-600 mb-4" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                        {t('enginesPage.detail.rulesApplied', 'REGRAS DA AGT APLICADAS')}
                      </span>
                      <strong className="d-block color-primary" style={{ fontSize: 18 }}>
                        {t('enginesPage.detail.rulesActiveCount', {
                          count: regrasDoMotor.length,
                          defaultValue: `${regrasDoMotor.length} regras ativas`,
                        })}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* CAIXA DIDÁTICA (O QUE FAZ, O QUE EVITA, DICA) */}
                <div
                  className="p-18 mb-20 rounded"
                  style={{ backgroundColor: '#fafbfc', border: '1px solid #edf0f5' }}
                >
                  <div className="row mb-12" style={{ rowGap: 12 }}>
                    <div className="col-12 col-md-6">
                      <span className="d-block fw-700 mb-4 color-primary" style={{ fontSize: 12 }}>
                        {t('enginesPage.detail.whatItChecks', '💡 O que este módulo confere:')}
                      </span>
                      <p className="mb-0 text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        {amigavelAtivo.oQueFaz}
                      </p>
                    </div>

                    <div className="col-12 col-md-6">
                      <span className="d-block fw-700 mb-4 color-danger" style={{ fontSize: 12 }}>
                        {t('enginesPage.detail.whatItPrevents', '🛡️ O que ele evita para a sua empresa:')}
                      </span>
                      <p className="mb-0 text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        {amigavelAtivo.oQueEvita}
                      </p>
                    </div>
                  </div>

                  <div className="pt-10 border-top d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                    <span className="fw-700 color-success" style={{ fontSize: 12 }}>
                      {t('enginesPage.detail.practicalTip', '📋 Dica prática:')}
                    </span>
                    <span style={{ fontSize: 12, color: '#272b41' }}>
                      {amigavelAtivo.dicaSimples}
                    </span>
                  </div>
                </div>

                {/* DOCUMENTOS EXIGIDOS */}
                <div className="mb-25">
                  <span className="d-block fw-700 color-dark mb-8" style={{ fontSize: 13 }}>
                    <i className="la la-folder-open text-primary mr-5"></i>
                    {t('enginesPage.detail.requiredDocsTitle', 'Documentos Necessários para Este Teste')}
                  </span>

                  {!motorAtivo.documentos_requeridos || motorAtivo.documentos_requeridos.length === 0 ? (
                    <p className="text-muted mb-0" style={{ fontSize: 12.5, fontStyle: 'italic' }}>
                      {t(
                        'enginesPage.detail.noRequiredDocs',
                        'Este módulo reúne e calcula dados de todos os outros testes (não precisa de ficheiro novo).'
                      )}
                    </p>
                  ) : (
                    <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                      {motorAtivo.documentos_requeridos.map((docTipo) => {
                        const presente = (motorAtivo.documentos_disponiveis || []).includes(docTipo);
                        const nomeDoc =
                          docTipo === 'BALANCETE'
                            ? 'Balancete da Empresa'
                            : docTipo === 'MODELO7'
                            ? 'Declaração Modelo 7 AGT'
                            : docTipo;

                        return (
                          <div
                            key={docTipo}
                            className="px-12 py-8 rounded d-flex align-items-center"
                            style={{
                              gap: 8,
                              backgroundColor: presente ? '#f0fbf7' : '#fff9f0',
                              border: presente ? '1px solid #b7f4db' : '1px solid #ffeeba',
                            }}
                          >
                            <i
                              className={presente ? 'la la-check-circle text-success' : 'la la-exclamation-triangle text-warning'}
                              style={{ fontSize: 16 }}
                            ></i>
                            <span className="fw-600 color-dark" style={{ fontSize: 12.5 }}>
                              {nomeDoc}
                            </span>
                            <span className={`badge ${presente ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 9.5 }}>
                              {presente
                                ? t('enginesPage.detail.docReceived', 'Recebido')
                                : t('enginesPage.detail.docMissing', 'Falta Enviar')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* INCONSISTÊNCIAS APURADAS */}
                <div className="mb-25">
                  <div className="d-flex justify-content-between align-items-center mb-10 flex-wrap" style={{ gap: 8 }}>
                    <div>
                      <span className="fw-700 color-dark" style={{ fontSize: 13.5 }}>
                        {t('enginesPage.detail.issuesTitle', {
                          codigo: motorAtivo.codigo,
                          count: ocorrenciasDoMotor.length,
                          defaultValue: `O QUE NÃO BATE CERTO NO MÓDULO ${motorAtivo.codigo} (${ocorrenciasDoMotor.length})`,
                        })}
                      </span>
                      <span className="d-block text-muted" style={{ fontSize: 12 }}>
                        {t(
                          'enginesPage.detail.issuesSubtitle',
                          'Veja onde estão as diferenças apuradas e clique em "Como Resolver" para o passo a passo'
                        )}
                      </span>
                    </div>
                  </div>

                  {ocorrenciasDoMotor.length === 0 ? (
                    <div
                      className="p-20 text-center rounded"
                      style={{ backgroundColor: '#f0fbf7', border: '1px solid #c8eedf' }}
                    >
                      <span className="d-block color-success fw-700" style={{ fontSize: 13.5 }}>
                        {t('enginesPage.detail.noIssuesAlert', {
                          codigo: motorAtivo.codigo,
                          mes: mesNome,
                          ano,
                          defaultValue: `Tudo em ordem! Nenhuma inconsistência apurada pelo módulo ${motorAtivo.codigo} para ${mesNome}/${ano}.`,
                        })}
                      </span>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-bordered mb-0" style={{ fontSize: 12.5 }}>
                        <thead style={{ backgroundColor: '#f8f9fa' }}>
                          <tr>
                            <th style={{ width: '15%' }}>{t('enginesPage.detail.thSeverity', 'Gravidade')}</th>
                            <th style={{ width: '12%' }}>{t('enginesPage.detail.thCode', 'Código')}</th>
                            <th style={{ width: '38%' }}>{t('enginesPage.detail.thIssue', 'O Que Não Bate Certo')}</th>
                            <th style={{ width: '12%' }}>{t('enginesPage.detail.thStatus', 'Situação')}</th>
                            <th style={{ textAlign: 'right', width: '12%' }}>{t('enginesPage.detail.thRiskValue', 'Valor em Risco')}</th>
                            <th style={{ textAlign: 'center', width: '11%' }}>{t('enginesPage.detail.thHowToFix', 'Como Resolver')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocorrenciasDoMotor.map((occ) => {
                            const sev = SEVERIDADE_CONFIG[occ.severidade] || SEVERIDADE_CONFIG.MEDIO;
                            return (
                              <tr key={occ.id}>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <span className={`badge ${sev.badge}`} style={{ fontWeight: 700, fontSize: 11 }}>
                                    {sev.icone} {sev.label}
                                  </span>
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <strong className="color-dark">{occ.regra?.codigo}</strong>
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <strong className="color-dark d-block">{occ.regra?.nome}</strong>
                                  <span className="text-muted" style={{ fontSize: 11.5 }}>
                                    {occ.recomendacao}
                                  </span>
                                </td>
                                <td style={{ verticalAlign: 'middle' }}>
                                  <span
                                    className={`badge ${
                                      occ.estado === 'CONFIRMADO'
                                        ? 'badge-danger'
                                        : occ.estado === 'CORRIGIDO'
                                        ? 'badge-success'
                                        : 'badge-secondary'
                                    }`}
                                  >
                                    {occ.estado === 'POR_REVER'
                                      ? 'Pendente'
                                      : occ.estado === 'CONFIRMADO'
                                      ? 'Confirmado'
                                      : occ.estado === 'CORRIGIDO'
                                      ? 'Corrigido'
                                      : occ.estado}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                  <strong className="color-danger" style={{ fontSize: 13 }}>
                                    {formatKz(occ.valor_envolvido)}
                                  </strong>
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm btn-squared"
                                    onClick={() => handleAbrirEvidencia(occ)}
                                    style={{ fontSize: 11.5, fontWeight: 600 }}
                                  >
                                    {t('enginesPage.detail.howToFixBtn', 'Como Resolver →')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* REGRAS & BASE LEGAL DA AGT */}
                <div>
                  <span className="d-block fw-700 color-dark mb-4" style={{ fontSize: 13.5 }}>
                    <i className="la la-gavel text-primary mr-5"></i>
                    {t('enginesPage.detail.rulesTitle', {
                      count: regrasDoMotor.length,
                      defaultValue: `Regras de Verificação & Legislação da AGT (${regrasDoMotor.length})`,
                    })}
                  </span>
                  <span className="d-block text-muted mb-10" style={{ fontSize: 12 }}>
                    {t(
                      'enginesPage.detail.rulesSubtitle',
                      'Bases legais do Código do IVA, IRT, Imposto Industrial e Código Geral Tributário aplicadas neste teste'
                    )}
                  </span>

                  <div className="table-responsive">
                    <table className="table table-bordered mb-0" style={{ fontSize: 12 }}>
                      <thead style={{ backgroundColor: '#f8f9fa' }}>
                        <tr>
                          <th style={{ width: '12%' }}>{t('enginesPage.detail.thRuleCode', 'Código')}</th>
                          <th style={{ width: '40%' }}>{t('enginesPage.detail.thWhatIsTested', 'O que é Testado')}</th>
                          <th style={{ width: '36%' }}>{t('enginesPage.detail.thAgtLaw', 'Legislação da AGT')}</th>
                          <th style={{ textAlign: 'center', width: '12%' }}>{t('enginesPage.detail.thSeverityBadge', 'Gravidade')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regrasDoMotor.map((r) => {
                          const sev = SEVERIDADE_CONFIG[r.severidade] || SEVERIDADE_CONFIG.MEDIO;
                          return (
                            <tr key={r.codigo}>
                              <td>
                                <strong className="color-primary">{r.codigo}</strong>
                              </td>
                              <td>
                                <strong className="color-dark d-block">{r.nome}</strong>
                                <span className="text-muted" style={{ fontSize: 11.5 }}>{r.descricao}</span>
                              </td>
                              <td>
                                <div className="fw-600 color-dark">
                                  {r.base_legal?.legislacao || 'Legislação Tributária Angolana'}
                                </div>
                                <div className="text-muted" style={{ fontSize: 11 }}>
                                  {r.base_legal?.artigo}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${sev.badge}`} style={{ fontWeight: 700, fontSize: 10.5 }}>
                                  {sev.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE COMO RESOLVER */}
      {evidenciaModal && (
        <>
          <div
            className="modal fade show"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            style={{ display: 'block' }}
          >
            <div className="modal-dialog modal-lg" role="document">
              <div className="modal-content" style={{ borderRadius: 10, overflow: 'hidden' }}>
                <div className="modal-header py-15 px-20" style={{ backgroundColor: '#5f63f2' }}>
                  <div>
                    <h6 className="modal-title" style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
                      {t('enginesPage.modal.title', {
                        codigo: evidenciaModal.regra?.codigo,
                        nome: evidenciaModal.regra?.nome,
                        defaultValue: `COMO RESOLVER: ${evidenciaModal.regra?.codigo} — ${evidenciaModal.regra?.nome}`,
                      })}
                    </h6>
                    <span className="d-block" style={{ fontSize: 12, color: '#fff', opacity: 0.9 }}>
                      {t(
                        'enginesPage.modal.subtitle',
                        'Passo a passo prático para colocar as contas da empresa em conformidade com as Finanças (AGT)'
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="close"
                    aria-label="Close"
                    onClick={() => setEvidenciaModal(null)}
                    style={{ color: '#fff' }}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>

                <div className="modal-body p-25">
                  {/* Valores e Cálculo */}
                  <div className="mb-20">
                    <p className="mb-10 fw-700 color-dark" style={{ fontSize: 13.5 }}>
                      {t('enginesPage.modal.sec1Title', '1. O QUE NÃO BATE CERTO (VALOR EM RISCO)')}
                    </p>
                    <div
                      className="p-16 rounded"
                      style={{ backgroundColor: '#f8f9fb', border: '1px solid #eef0f3' }}
                    >
                      <div className="row" style={{ rowGap: 10 }}>
                        <div className="col-12 col-sm-6">
                          <span className="d-block text-muted fw-600" style={{ fontSize: 11 }}>
                            {t('enginesPage.modal.diffDescription', 'DESCRIÇÃO DA DIFERENÇA')}
                          </span>
                          <span className="d-block mt-4 fw-600 color-dark" style={{ fontSize: 13 }}>
                            {evidenciaModal.regra?.descricao || 'Divergência entre a escrituração e a declaração fiscal.'}
                          </span>
                        </div>
                        <div className="col-12 col-sm-6">
                          <span className="d-block text-muted fw-600" style={{ fontSize: 11 }}>
                            {t('enginesPage.modal.riskValue', 'VALOR EM RISCO / DIFERENÇA APURADA')}
                          </span>
                          <span className="d-block mt-4 fw-800 color-danger" style={{ fontSize: 18 }}>
                            {formatKz(evidenciaModal.valor_envolvido)}
                          </span>
                        </div>
                      </div>

                      {evidenciaModal.evidencia?.valores && (
                        <div className="mt-12 pt-12 border-top">
                          <span className="d-block text-muted fw-600 mb-6" style={{ fontSize: 11 }}>
                            {t('enginesPage.modal.extractedDetails', 'DETALHES EXTRAÍDOS DOS DOCUMENTOS')}
                          </span>
                          <div className="d-flex flex-wrap" style={{ gap: 6 }}>
                            {Object.entries(evidenciaModal.evidencia.valores).map(([k, v]) => (
                              <span
                                key={k}
                                className="badge badge-light"
                                style={{ fontFamily: 'monospace', fontSize: 11, border: '1px solid #e3e6ef', color: '#272b41' }}
                              >
                                {`${k}: ${v}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Base Legal */}
                  <div className="mb-20">
                    <p className="mb-10 fw-700 color-dark" style={{ fontSize: 13.5 }}>
                      <i className="la la-gavel text-primary mr-5"></i>
                      {t('enginesPage.modal.sec2Title', '2. O QUE EXIGE A LEGISLAÇÃO ANGOLANA (AGT)')}
                    </p>
                    <div
                      className="p-16 rounded"
                      style={{ backgroundColor: '#fff9f0', border: '1px solid #ffeeba' }}
                    >
                      <p className="mb-6 fw-700 color-dark" style={{ fontSize: 13 }}>
                        {evidenciaModal.regra?.base_legal?.legislacao || 'Legislação Tributária Angolana'}
                      </p>
                      <p className="mb-6 fw-600 text-muted" style={{ fontSize: 12 }}>
                        {evidenciaModal.regra?.base_legal?.artigo}
                      </p>
                      <p className="mb-0 text-muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
                        "{evidenciaModal.regra?.base_legal?.texto || 'Obrigação legal de conformidade e confrontação documental com as declarações entregues.'}"
                      </p>
                    </div>
                  </div>

                  {/* Recomendação */}
                  <div className="mb-20">
                    <p className="mb-10 fw-700 color-dark" style={{ fontSize: 13.5 }}>
                      {t('enginesPage.modal.sec3Title', '3. O QUE DEVE FAZER PARA RESOLVER (AÇÃO PRÁTICA)')}
                    </p>
                    <div
                      className="p-16 rounded"
                      style={{ backgroundColor: '#f0fbf7', border: '1px solid #b7f4db' }}
                    >
                      <p className="mb-8 fw-600" style={{ fontSize: 13, color: '#0f7b61' }}>
                        {evidenciaModal.recomendacao || 'Fale com o contabilista para rever os lançamentos e os documentos de suporte deste mês.'}
                      </p>
                      <p className="mb-0" style={{ fontSize: 11.5, color: '#0f7b61' }}>
                        {t(
                          'enginesPage.modal.practicalTipBox',
                          '💡 Dica: Corrigir esta divergência internamente ou submeter declaração de substituição antes de qualquer notificação da AGT elimina riscos de coimas.'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Gestão de Estado da Ocorrência */}
                  <div>
                    <p className="mb-10 fw-700 color-dark" style={{ fontSize: 13.5 }}>
                      {t('enginesPage.modal.sec4Title', '4. SITUAÇÃO DESTE PONTO NA EMPRESA')}
                    </p>
                    <div className="d-flex flex-wrap align-items-center" style={{ gap: 12 }}>
                      <div style={{ flex: '1 1 240px' }}>
                        <select
                          className="form-control form-control-default"
                          value={novoEstadoOcc}
                          onChange={(e) => setNovoEstadoOcc(e.target.value)}
                          style={{ height: 38, fontSize: 12.5 }}
                        >
                          {ESTADOS_OCORRENCIA.map((est) => (
                            <option key={est.valor} value={est.valor}>
                              {est.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-squared btn-sm"
                        onClick={handleSalvarEstadoOcorrencia}
                        disabled={atualizandoOcc || novoEstadoOcc === evidenciaModal.estado}
                        style={{ height: 38, fontSize: 12.5, fontWeight: 600 }}
                      >
                        <i className={`la ${atualizandoOcc ? 'la-spinner la-spin' : 'la-check-circle'} mr-4`}></i>
                        {atualizandoOcc
                          ? t('enginesPage.modal.savingStatus', 'A guardar...')
                          : t('enginesPage.modal.saveStatusBtn', 'Atualizar Situação')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-12 px-20">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-lighten btn-squared"
                    onClick={() => setEvidenciaModal(null)}
                    style={{ fontSize: 12.5 }}
                  >
                    <i className="la la-times mr-4"></i>
                    {t('enginesPage.modal.closeBtn', 'Fechar')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setEvidenciaModal(null)}
          ></div>
        </>
      )}
    </>
  );
};

export default Motores;
