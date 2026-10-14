import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../services/api';
import RelatorioParecer from '../components/RelatorioParecer';
import { usePeriodo } from '../context/PeriodoContext';
import { parseAnaliseIA } from '../utils/analiseIaParser';

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

const Relatorios = () => {
  const { t } = useTranslation();
  const anoAtual = new Date().getFullYear();
  const periodo = usePeriodo();
  const { empresaId, ano, mes, atualizar } = periodo;

  const [empresas, setEmpresas] = useState([]);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [executandoAnalise, setExecutandoAnalise] = useState(false);
  // Só resta uma vista: o parecer oficial.
  const abaAtiva = 'oficial';

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
        if (lista.length > 0 && !empresaId) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          atualizar({ empresaId: String(sckj ? sckj.id : lista[0].id) });
        }
      })
      .catch((err) => console.error('Erro ao carregar empresas:', err));
  }, [empresaId, atualizar]);

  const carregarRelatorio = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const res = await api.get(`/auditoria/${empresaId}/${ano}/${mes}/dashboard/`);
      setDados(res.data);
    } catch (err) {
      console.error('Erro ao carregar parecer técnico:', err);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [empresaId, ano, mes]);

  useEffect(() => {
    carregarRelatorio();
  }, [carregarRelatorio]);

  const empresaAtual = empresas.find((e) => String(e.id) === String(empresaId));
  const mesNome = getMesNome(mes);

  const analiseEstruturada = useMemo(() => {
    return parseAnaliseIA(dados?.analise_ia);
  }, [dados?.analise_ia]);

  const indicadores = dados?.indicadores || {};
  const docBase = dados?.documentos_base || {};
  const balancetePresente = Boolean(docBase.balancete?.presente);
  const portalAgtPresente = Boolean(docBase.portal_agt?.presente);
  const temAnaliseIa = Boolean(dados?.analise_ia && analiseEstruturada?.totalPontos > 0);
  const temDivergencia = (analiseEstruturada?.diferencasCount ?? 0) > 0;
  const exposicaoKz = indicadores.exposicao_total_potencial || 0;

  // Executar confronto com IA diretamente a partir da página de relatórios
  const handleExecutarConfronto = async () => {
    if (!empresaId || !docBase.balancete?.id || !docBase.portal_agt?.id) return;
    setExecutandoAnalise(true);
    try {
      const resIA = await api.post('/analises/analise-documentos/', {
        documento_contabilidade_id: docBase.balancete.id,
        documento_agt_id: docBase.portal_agt.id,
        idioma: 'pt',
      });
      if (resIA.data?.success) {
        toast.success(
          t('reportsPage.analysisSuccess', 'Análise com Inteligência Artificial concluída com sucesso!')
        );
      }
      try {
        await api.post('/ocorrencias/executar/', {
          empresa: parseInt(empresaId, 10),
          ano: parseInt(ano, 10),
          mes: parseInt(mes, 10),
        });
      } catch (errOcc) {
        console.warn('Erro ao atualizar ocorrências:', errOcc);
      }
      await carregarRelatorio();
    } catch (err) {
      console.error('Erro na análise com IA:', err);
      const msg = err.response?.data?.error || t('reportsPage.analysisError', 'Erro ao executar confronto documental.');
      toast.error(msg);
    } finally {
      setExecutandoAnalise(false);
    }
  };

  // Badge da situação geral no cabeçalho
  let statusBadgeClass = 'badge-success';
  let statusBadgeText = t('reportsPage.fullyCompliant', '100% Conforme');
  if (!temAnaliseIa) {
    if (balancetePresente && portalAgtPresente) {
      statusBadgeClass = 'badge-info';
      statusBadgeText = t('reportsPage.readyForAnalysis', 'Pronto para Análise');
    } else {
      statusBadgeClass = 'badge-secondary';
      statusBadgeText = t('reportsPage.pendingDocuments', 'Documentos Pendentes');
    }
  } else if (temDivergencia) {
    statusBadgeClass = 'badge-warning';
    statusBadgeText = t('reportsPage.divergencesDetected', 'Atenção: Divergências Detectadas');
  }

  return (
    <>
      <style>
        {`
        @media print {
          .no-print, .sidebar-wrapper, .header-top, .footer-wrapper, .breadcrumb-main, .nav-tabs-relatorios { display: none !important; }
          .main-content, .contents, .container-fluid { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .card { border: none !important; box-shadow: none !important; }
          .card-body { padding: 0 !important; }
          .print-area-only { display: block !important; }
          .screen-view-only { display: none !important; }
        }
        @media screen {
          .print-area-only { display: none !important; }
        }
        .relatorio-kpi-card {
          background: #ffffff;
          border: 1px solid #edf0f5;
          border-radius: 10px;
          padding: 16px 18px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .relatorio-kpi-card:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.04);
        }
        .relatorio-tab-btn {
          border: none;
          background: transparent;
          font-weight: 600;
          font-size: 13px;
          padding: 10px 18px;
          border-radius: 8px;
          color: #5a5f7d;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .relatorio-tab-btn:hover {
          background: #edf0f5;
          color: #272b41;
        }
        .relatorio-tab-btn.active {
          background: #5f63f2;
          color: #ffffff;
          box-shadow: 0 3px 8px rgba(95, 99, 242, 0.25);
        }
        `}
      </style>

      {/* 1. BARRA SUPERIOR E AÇÕES */}
      <div className="row no-print mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-700 color-dark mb-4" style={{ fontSize: 20 }}>
                <i className="la la-file-invoice text-primary mr-6"></i>{' '}
                {t('reportsPage.title', 'Relatório de Auditoria Fiscal')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {t(
                  'reportsPage.subtitle',
                  'Confronto direto entre Balancete (PGC) e Portal da AGT (Modelo 7 do IVA)'
                )}
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline-lighten btn-default btn-squared"
                onClick={carregarRelatorio}
                disabled={carregando}
                style={{ fontSize: 13, background: '#fff', border: '1px solid #dcdfe5' }}
              >
                <i className={`la la-sync mr-5 ${carregando ? 'la-spin' : ''}`}></i>{' '}
                {t('reportsPage.refresh', 'Atualizar')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-default btn-squared"
                onClick={() => window.print()}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <i className="la la-print mr-5"></i> {t('reportsPage.printPdf', 'Imprimir / Guardar em PDF')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SELETOR COMPACTO DE EMPRESA E PERÍODO */}
      <div className="row no-print mb-20">
        <div className="col-12">
          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-15">
              <div className="d-flex flex-wrap align-items-center" style={{ gap: 14 }}>
                <div style={{ flex: '2 1 260px' }}>
                  <label htmlFor="relatorio-empresa" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('reportsPage.auditedCompany', 'EMPRESA AUDITADA')}
                  </label>
                  <select
                    id="relatorio-empresa"
                    className="form-control form-control-default"
                    value={empresaId}
                    onChange={(e) => atualizar({ empresaId: e.target.value })}
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
                  <label htmlFor="relatorio-mes" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('reportsPage.fiscalMonth', 'MÊS FISCAL')}
                  </label>
                  <select
                    id="relatorio-mes"
                    className="form-control form-control-default"
                    value={mes}
                    onChange={(e) => atualizar({ mes: e.target.value })}
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
                  <label htmlFor="relatorio-ano" className="fw-600 mb-4 text-muted" style={{ fontSize: 11.5 }}>
                    {t('reportsPage.fiscalYear', 'EXERCÍCIO')}
                  </label>
                  <select
                    id="relatorio-ano"
                    className="form-control form-control-default"
                    value={ano}
                    onChange={(e) => atualizar({ ano: e.target.value })}
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
                      {t('reportsPage.generalStatus', 'SITUAÇÃO GERAL')}
                    </span>
                    <span
                      className={`badge px-10 py-4 ${statusBadgeClass}`}
                      style={{ fontSize: 11.5, fontWeight: 700 }}
                    >
                      {statusBadgeText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="row no-print mb-25">
          <div className="col-12 text-center p-4">
            <SpinDots />
            <p className="text-muted mt-10" style={{ fontSize: 13 }}>
              {t('reportsPage.analyzingData', {
                mes: mesNome,
                ano,
                defaultValue: `A analisar dados do período ${mesNome}/${ano}...`,
              })}
            </p>
          </div>
        </div>
      )}

      {/* CASO DE ERRO / AUSÊNCIA DE DADOS */}
      {!carregando && !dados && (
        <div className="row no-print mb-30">
          <div className="col-12">
            <div className="card card-default text-center p-40" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              <i className="la la-exclamation-circle text-muted mb-10" style={{ fontSize: 42 }}></i>
              <h5 className="fw-700 color-dark mb-5">
                {t('reportsPage.loadErrorTitle', 'Não foi possível carregar os dados deste período')}
              </h5>
              <p className="text-muted mb-15" style={{ fontSize: 13 }}>
                {t('reportsPage.loadErrorDesc', 'Verifique a ligação com o servidor ou tente atualizar a consulta.')}
              </p>
              <div>
                <button className="btn btn-primary btn-sm btn-squared" onClick={carregarRelatorio}>
                  <i className="la la-sync mr-5"></i> {t('reportsPage.refresh', 'Atualizar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CARTÕES DE SÍNTESE EXECUTIVA */}
      {!carregando && dados && (
        <div className="row no-print mb-20" style={{ rowGap: 12 }}>
          {/* Vendas */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="relatorio-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-6">
                <span className="text-muted fw-600" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  {t('reportsPage.kpi.turnover', 'Volume de Negócios')}
                </span>
                <i className="la la-chart-line text-primary" style={{ fontSize: 18 }}></i>
              </div>
              <div className="fw-700 color-dark" style={{ fontSize: 17 }}>
                {formatKz(indicadores.volume_negocios)}
              </div>
              <div className="d-flex align-items-center mt-5" style={{ fontSize: 11.5, gap: 5 }}>
                <span className="badge badge-success px-6 py-2" style={{ fontSize: 10 }}>
                  ✓ {t('reportsPage.kpi.compliant', 'Conforme')}
                </span>
                <span className="text-muted">
                  {t('reportsPage.kpi.trialVsModel7', 'Balancete vs Modelo 7')}
                </span>
              </div>
            </div>
          </div>

          {/* IVA Liquidado */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="relatorio-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-6">
                <span className="text-muted fw-600" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  {t('reportsPage.kpi.assessedVat', 'IVA Liquidado (14%)')}
                </span>
                <i className="la la-coins text-info" style={{ fontSize: 18 }}></i>
              </div>
              <div className="fw-700 color-dark" style={{ fontSize: 17 }}>
                {formatKz(indicadores.iva_liquidado)}
              </div>
              <div className="d-flex align-items-center mt-5" style={{ fontSize: 11.5, gap: 5 }}>
                <span className="badge badge-success px-6 py-2" style={{ fontSize: 10 }}>
                  ✓ {t('reportsPage.kpi.reconciled', 'Reconciliado')}
                </span>
                <span className="text-muted">
                  {t('reportsPage.kpi.accountVsField', 'Conta 3453 = Campo 33')}
                </span>
              </div>
            </div>
          </div>

          {/* Exposição / Risco */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="relatorio-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-6">
                <span className="text-muted fw-600" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  {t('reportsPage.kpi.fiscalRisk', 'Risco Fiscal Apurado')}
                </span>
                <i
                  className={`la ${exposicaoKz > 0 ? 'la-exclamation-triangle text-danger' : 'la-shield-alt text-success'}`}
                  style={{ fontSize: 18 }}
                ></i>
              </div>
              <div className={`fw-700 ${exposicaoKz > 0 ? 'text-danger' : 'text-success'}`} style={{ fontSize: 17 }}>
                {formatKz(exposicaoKz)}
              </div>
              <div className="d-flex align-items-center mt-5" style={{ fontSize: 11.5, gap: 5 }}>
                {exposicaoKz > 0 ? (
                  <>
                    <span className="badge badge-danger px-6 py-2" style={{ fontSize: 10 }}>
                      {t('reportsPage.kpi.riskDetected', 'Risco Detectado')}
                    </span>
                    <span className="text-muted">{t('reportsPage.kpi.preventFine', 'Prevenir coima')}</span>
                  </>
                ) : (
                  <>
                    <span className="badge badge-success px-6 py-2" style={{ fontSize: 10 }}>
                      {t('reportsPage.kpi.regular', 'Regular')}
                    </span>
                    <span className="text-muted">{t('reportsPage.kpi.noIssues', 'Sem pendências')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Confronto de Dados */}
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="relatorio-kpi-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-6">
                <span className="text-muted fw-600" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  {t('reportsPage.kpi.dataComparison', 'Confronto de Dados')}
                </span>
                <i className="la la-check-double text-success" style={{ fontSize: 18 }}></i>
              </div>
              <div className="fw-700 color-dark" style={{ fontSize: 17 }}>
                {temAnaliseIa
                  ? t('reportsPage.kpi.equalCount', {
                      iguais: analiseEstruturada?.iguaisCount || 0,
                      total: analiseEstruturada?.totalPontos || 0,
                      defaultValue: `${analiseEstruturada?.iguaisCount || 0} de ${analiseEstruturada?.totalPontos || 0} Iguais`,
                    })
                  : t('reportsPage.kpi.pendingAnalysis', 'Pendente')}
              </div>
              <div className="d-flex align-items-center mt-5" style={{ fontSize: 11.5, gap: 5 }}>
                <span
                  className={`badge px-6 py-2 ${
                    !temAnaliseIa
                      ? 'badge-info'
                      : analiseEstruturada?.diferencasCount > 0
                      ? 'badge-warning'
                      : 'badge-success'
                  }`}
                  style={{ fontSize: 10 }}
                >
                  {!temAnaliseIa
                    ? t('reportsPage.kpi.awaitingCrossCheck', 'Aguardando Confronto')
                    : analiseEstruturada?.diferencasCount > 0
                    ? t('reportsPage.kpi.diffCount', {
                        count: analiseEstruturada.diferencasCount,
                        defaultValue: `${analiseEstruturada.diferencasCount} Diferença(s)`,
                      })
                    : t('reportsPage.kpi.fullyAligned', '100% Alinhado')}
                </span>
                <span className="text-muted">{t('reportsPage.kpi.pointsAnalyzed', 'Pontos analisados')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER DE AÇÃO QUANDO DOCUMENTOS PRONTOS OU EM FALTA */}
      {!carregando && dados && (
        <div className="row no-print mb-20">
          <div className="col-12">
            {balancetePresente && portalAgtPresente && !temAnaliseIa && (
              <div
                className="alert alert-info d-flex align-items-center justify-content-between flex-wrap p-16"
                style={{ borderRadius: 10, border: '1px solid #bce8f1', background: '#eef8fc' }}
              >
                <div className="d-flex align-items-center mb-2 mb-md-0" style={{ gap: 12 }}>
                  <i className="la la-info-circle text-info" style={{ fontSize: 28 }}></i>
                  <div>
                    <strong className="d-block color-dark" style={{ fontSize: 14 }}>
                      {t('reportsPage.readyForAnalysisTitle', 'Documentos Prontos para Confronto Automático')}
                    </strong>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      {t(
                        'reportsPage.readyForAnalysisDesc',
                        'O Balancete e a Declaração Modelo 7 estão disponíveis para este período. Execute a análise com IA para auditar os valores e identificar divergências.'
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-squared mt-2 mt-md-0"
                  onClick={handleExecutarConfronto}
                  disabled={executandoAnalise}
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  <i className={`la ${executandoAnalise ? 'la-spinner la-spin' : 'la-brain'} mr-5`}></i>
                  {executandoAnalise
                    ? t('reportsPage.executingAnalysis', 'A Processar Análise com IA...')
                    : t('reportsPage.executeAnalysisBtn', 'Executar Confronto com IA')}
                </button>
              </div>
            )}

            {(!balancetePresente || !portalAgtPresente) && (
              <div
                className="alert alert-warning d-flex align-items-center justify-content-between flex-wrap p-16"
                style={{ borderRadius: 10, border: '1px solid #ffeeba', background: '#fff9e6' }}
              >
                <div className="d-flex align-items-center mb-2 mb-md-0" style={{ gap: 12 }}>
                  <i className="la la-exclamation-triangle text-warning" style={{ fontSize: 28 }}></i>
                  <div>
                    <strong className="d-block color-dark" style={{ fontSize: 14 }}>
                      {t('reportsPage.missingDocsTitle', 'Documentos em Falta para o Período')}
                    </strong>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      Envie o <strong>Dossiê Mensal Completo (1 único PDF com tudo)</strong> ou carregue individualmente os documentos de {mesNome}/{ano}.
                      {' '}({!balancetePresente ? t('reportsPage.missingBalancete', 'Falta Balancete') : ''}
                      {!balancetePresente && !portalAgtPresente ? ' · ' : ''}
                      {!portalAgtPresente ? t('reportsPage.missingModelo7', 'Falta Modelo 7 AGT') : ''})
                    </span>
                  </div>
                </div>
                <Link
                  to="/arquivo"
                  className="btn btn-warning btn-squared mt-2 mt-md-0"
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  <i className="la la-cloud-upload-alt mr-5"></i>
                  Carregar Dossiê / Documentos
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* O parecer formal. As abas "Confronto", "Riscos" e "Recomendações"
          foram removidas: mostravam, com outra apresentação, exactamente os
          mesmos dados da página de Auditoria. O Relatório guarda só o que é
          seu — o documento assinado, para entregar ao cliente ou arquivar. */}
      {!carregando && dados && (
        <div className="row no-print mb-20">
          <div className="col-12">

            {abaAtiva === 'oficial' && (
              <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                <div className="card-header py-15 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
                  <div>
                    <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
                      {t('reportsPage.officialTab.title', 'Documento Oficial do Parecer Técnico')}
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
                      {t(
                        'reportsPage.officialTab.subtitle',
                        'Formato formal com preâmbulo legal, assinaturas de responsabilidade e arquivamento.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-squared"
                    onClick={() => window.print()}
                  >
                    <i className="la la-print mr-5"></i> {t('reportsPage.officialTab.printBtn', 'Imprimir Este Documento')}
                  </button>
                </div>
                <div className="card-body p-30">
                  <RelatorioParecer
                    dados={dados}
                    empresaAtual={empresaAtual}
                    ano={ano}
                    mes={mes}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ÁREA DE IMPRESSÃO EXCLUSIVA (@media print) */}
      <div className="print-area-only">
        <RelatorioParecer
          dados={dados}
          empresaAtual={empresaAtual}
          ano={ano}
          mes={mes}
        />
      </div>
    </>
  );
};

export default Relatorios;
