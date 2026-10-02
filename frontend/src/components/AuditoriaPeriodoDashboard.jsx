import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { ESTADOS_OCORRENCIA_SIMPLES } from '../utils/motoresExplicados';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';
import RelatorioParecer from './RelatorioParecer';
import { parseAnaliseIA } from '../utils/analiseIaParser';

const MESES = [
  { valor: '1', nome: 'Janeiro' },
  { valor: '2', nome: 'Fevereiro' },
  { valor: '3', nome: 'Março' },
  { valor: '4', nome: 'Abril' },
  { valor: '5', nome: 'Maio' },
  { valor: '6', nome: 'Junho' },
  { valor: '7', nome: 'Julho' },
  { valor: '8', nome: 'Agosto' },
  { valor: '9', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
];

const TIPOS_DOCUMENTOS = [
  { tipo: 'DOSSIE_MENSAL', nome: '📦 Dossiê Mensal Completo (Envelope Fiscal Único — Tudo em 1 PDF)', desbloqueia: 'Todos os 15 Motores de Auditoria (Balancete, AGT, Salários, INSS e Retenções)' },
  { tipo: 'BALANCETE', nome: 'Balancete de Verificação / Razão', desbloqueia: 'IVA, PGC e Risco' },
  { tipo: 'MODELO7', nome: 'Declaração Modelo 7 IVA', desbloqueia: 'Reconciliação IVA' },
  { tipo: 'FOLHA_SALARIAL', nome: 'Folha Salarial / Mapa de Vencimentos', desbloqueia: 'IRT e INSS' },
  { tipo: 'EXTRACTO_BANCARIO', nome: 'Extracto Bancário Oficial', desbloqueia: 'Reconciliação Bancária' },
  { tipo: 'FACTURA_VENDA', nome: 'Faturas de Venda / SAF-T (AO)', desbloqueia: 'Faturação e Vendas' },
  { tipo: 'FACTURA_COMPRA', nome: 'Faturas de Compras / Fornecedores', desbloqueia: 'Dedução de IVA e Selo' },
  { tipo: 'RETENCOES', nome: 'Documentos e Mapas de Retenção', desbloqueia: 'Retenções na Fonte' },
  { tipo: 'COMPROVATIVOS', nome: 'Guias DAR e Comprovativos', desbloqueia: 'Prazos de Liquidação' },
  { tipo: 'IMPOSTO_INDUSTRIAL', nome: 'Declaração Modelo 1 II', desbloqueia: 'Lucro Tributável' },
  { tipo: 'FOLHA_SS', nome: 'Guia da Segurança Social', desbloqueia: 'Taxas INSS' },
];





const ESTADOS_OCORRENCIA = ESTADOS_OCORRENCIA_SIMPLES;

const SEVERIDADE_BADGE = {
  ALTO: 'badge-danger',
  MEDIO: 'badge-warning',
  BAIXO: 'badge-warning',
  INFORMATIVO: 'badge-success',
};

const formatKz = (val) => {
  if (val === null || val === undefined) return '0,00 Kz';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
  return `${num.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
};

const AuditoriaPeriodoDashboard = () => {
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();

  const periodo = usePeriodo();
  const { empresaId, ano, mes, atualizar, escolherSeAusente } = periodo;
  usePeriodoDaUrl();

  const setEmpresaId = (v) => atualizar({ empresaId: v });
  const setAno = (v) => atualizar({ ano: v });
  const setMes = (v) => atualizar({ mes: v });

  const [empresas, setEmpresas] = useState([]);
  const [dadosAuditoria, setDadosAuditoria] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [resultadoIA, setResultadoIA] = useState(null);
  const [mostrarTextoBruto, setMostrarTextoBruto] = useState(false);

  const analiseIAEstruturada = useMemo(() => {
    return parseAnaliseIA(resultadoIA);
  }, [resultadoIA]);

  const recomendacoesExibir = useMemo(() => {
    if (analiseIAEstruturada?.recomendacoes && analiseIAEstruturada.recomendacoes.length > 0) {
      return analiseIAEstruturada.recomendacoes;
    }
    if ((analiseIAEstruturada?.diferencasCount || 0) > 0) {
      return [
        {
          numero: 1,
          titulo: 'Reconciliação e Verificação Documental',
          detalhes: ['Verificar os lançamentos da contabilidade e as faturas correspondentes para regularizar a diferença apurada.'],
        },
        {
          numero: 2,
          titulo: 'Submissão de Declaração de Retificação (se aplicável)',
          detalhes: ['Caso a divergência exceda a margem de tolerância/arredondamento, submeter declaração de retificação Modelo 7 à AGT.'],
        },
        {
          numero: 3,
          titulo: 'Arquivo e Conformidade Fiscal',
          detalhes: ['Manter dossiê fiscal com comprovativos para eventual esclarecimento ou fiscalização da AGT.'],
        },
      ];
    }
    return [
      {
        numero: 1,
        titulo: 'Arquivo e Fecho do Período',
        detalhes: ['Arquivar o Balancete e a Declaração Modelo 7 com validação de conformidade total.'],
      },
      {
        numero: 2,
        titulo: 'Monitorização Preventiva',
        detalhes: ['Manter o procedimento de reconciliação contábil mensal antes da entrega de futuras declarações fiscais.'],
      },
    ];
  }, [analiseIAEstruturada]);

  // Modais
  const [evidenciaModal, setEvidenciaModal] = useState(null);
  const [relatorioModal, setRelatorioModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [novoEstadoOcc, setNovoEstadoOcc] = useState('');
  const [atualizandoOcc, setAtualizandoOcc] = useState(false);

  // Upload rápido
  const [tipoUpload, setTipoUpload] = useState('BALANCETE');
  const [arquivoUpload, setArquivoUpload] = useState(null);
  const [enviandoUpload, setEnviandoUpload] = useState(false);
  const [detectandoDoc, setDetectandoDoc] = useState(false);
  const [detecaoDocInfo, setDetecaoDocInfo] = useState(null);

  const handleArquivoModalChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArquivoUpload(file);
    setDetectandoDoc(true);
    setDetecaoDocInfo(null);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await api.post('/documentos/detectar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        const d = res.data;
        setDetecaoDocInfo(d);
        if (d.tipo) {
          setTipoUpload(d.tipo);
        }
        if (d.empresa_id) {
          atualizar({
            empresaId: String(d.empresa_id),
            ano: d.ano ? String(d.ano) : undefined,
            mes: d.mes ? String(d.mes) : undefined,
          });
        } else if (d.ano && d.mes) {
          atualizar({
            ano: String(d.ano),
            mes: String(d.mes),
          });
        }
        toast.info(
          `⚡ Detetado: ${d.tipo_nome || d.tipo} ${d.empresa_nome ? '· ' + d.empresa_nome : ''} ${d.mes && d.ano ? `(${d.mes}/${d.ano})` : ''}`,
          { autoClose: 5000 }
        );
      }
    } catch (err) {
      console.warn('Erro ao autodetectar no modal:', err);
    } finally {
      setDetectandoDoc(false);
    }
  };

  // Carregar lista de empresas
  useEffect(() => {
    api
      .get('/empresas/')
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data.results || [];
        setEmpresas(lista);
        if (lista.length > 0) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          escolherSeAusente({ empresaId: String(sckj ? sckj.id : lista[0].id) });
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar empresas:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar dados de auditoria do período
  const carregarDadosAuditoria = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const res = await api.get(`/auditoria/${empresaId}/${ano}/${mes}/dashboard/`);
      setDadosAuditoria(res.data);
      setResultadoIA(res.data?.analise_ia || null);
    } catch (err) {
      console.error('Erro ao carregar auditoria do período:', err);
      setDadosAuditoria(null);
      setResultadoIA(null);
    } finally {
      setCarregando(false);
    }
  }, [empresaId, ano, mes]);

  useEffect(() => {
    carregarDadosAuditoria();
  }, [carregarDadosAuditoria]);

  // Executar análise com Inteligência Artificial (Groq Llama 3.3)
  const handleAnalisarComIA = async () => {
    if (!empresaId) return;
    const docContab = dadosAuditoria?.documentos_base?.balancete?.id;
    const docAgt = dadosAuditoria?.documentos_base?.portal_agt?.id;

    if (!docContab || !docAgt) {
      toast.warning('Para a IA analisar, por favor envie primeiro o Balancete e a Declaração Modelo 7 da AGT.');
      return;
    }

    setAnalisandoIA(true);
    try {
      // 1. Processa com a IA no backend
      const resIA = await api.post('/analises/analise-documentos/', {
        documento_contabilidade_id: docContab,
        documento_agt_id: docAgt,
        idioma: 'pt',
      });

      if (resIA.data?.success) {
        setResultadoIA(resIA.data.resultado);
        toast.success('🧠 Diagnóstico e Previsão da IA concluídos com sucesso!');
      }

      // 2. Sincroniza as regras fiscais dos motores
      await api.post('/ocorrencias/executar/', {
        empresa: parseInt(empresaId, 10),
        ano: parseInt(ano, 10),
        mes: parseInt(mes, 10),
      });

      await carregarDadosAuditoria();
    } catch (err) {
      console.error('Erro na análise com IA:', err);
      const msg = err.response?.data?.error || 'Erro ao processar análise com IA.';
      toast.error(msg);
    } finally {
      setAnalisandoIA(false);
    }
  };

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
        `Auditoria concluída! ${criadas} novo(s) achado(s), ${atualizadas} atualizado(s).`
      );
      await carregarDadosAuditoria();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao executar o motor de auditoria.';
      toast.error(msg);
    } finally {
      setExecutando(false);
    }
  };

  const handleAbrirEvidencia = (occ) => {
    setEvidenciaModal(occ);
    setNovoEstadoOcc(occ.estado || 'POR_REVER');
  };

  const handleSalvarEstadoOcorrencia = async () => {
    if (!evidenciaModal || !novoEstadoOcc) return;
    setAtualizandoOcc(true);
    try {
      await api.patch(`/ocorrencias/${evidenciaModal.id}/`, {
        estado: novoEstadoOcc,
      });
      toast.success('Estado do achado atualizado.');
      setEvidenciaModal(null);
      await carregarDadosAuditoria();
    } catch (err) {
      toast.error('Erro ao atualizar estado.');
    } finally {
      setAtualizandoOcc(false);
    }
  };

  const handleUploadDocumento = async () => {
    if (!arquivoUpload || !empresaId) {
      toast.warning('Selecione um ficheiro.');
      return;
    }
    setEnviandoUpload(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivoUpload);
      formData.append('empresa', empresaId);
      formData.append('empresa_id', empresaId);
      formData.append('ano', ano);
      formData.append('mes', mes);
      formData.append('tipo', tipoUpload);
      formData.append('substituir', 'true');

      const res = await api.post('/documentos/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.is_dossie) {
        const total = res.data.documentos_criados?.length || 0;
        const anoDetectado = res.data.ano;
        const mesDetectado = res.data.mes;
        toast.success(
          `📦 Dossiê Mensal Processado! ${total} secções documentais extraídas, 15 motores de auditoria executados e reconciliação concluída automaticamente!`,
          { autoClose: 7000 }
        );
        if (anoDetectado && mesDetectado && (String(anoDetectado) !== String(ano) || String(mesDetectado) !== String(mes))) {
          navigate(`/auditoria-periodo?empresa=${empresaId}&ano=${anoDetectado}&mes=${mesDetectado}`);
        }
      } else {
        toast.success('Ficheiro processado! Auditoria e reconciliação atualizadas automaticamente.');
      }
      setUploadModal(false);
      setArquivoUpload(null);
      await carregarDadosAuditoria();
    } catch (err) {
      console.error('Erro no upload de documento:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Erro ao carregar documento.';
      toast.error(msg);
    } finally {
      setEnviandoUpload(false);
    }
  };

  const cobertura = dadosAuditoria?.cobertura;
  const ocorrencias = useMemo(() => dadosAuditoria?.ocorrencias || [], [dadosAuditoria]);
  const indicadores = dadosAuditoria?.indicadores || {};
  const docsDisponiveis = cobertura?.documentos_disponiveis || [];
  const empresaAtual = empresas.find((e) => String(e.id) === String(empresaId));
  const mesNome = MESES.find((m) => m.valor === String(mes))?.nome || mes;

  const docBase = dadosAuditoria?.documentos_base || {
    balancete: { presente: false },
    portal_agt: { presente: false },
  };
  const temBalancete = docBase.balancete?.presente || docsDisponiveis.includes('BALANCETE');
  const temPortalAgt = docBase.portal_agt?.presente || docsDisponiveis.includes('MODELO7') || docsDisponiveis.includes('COMPROVATIVOS');

  return (
    <>
      {/* 1. CABEÇALHO & SELEÇÃO DE PERÍODO UNIFICADO */}
      <div className="row mb-25">
        <div className="col-12">
          <div className="breadcrumb-main d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 16 }}>
            <div>
              <h4 className="text-capitalize breadcrumb-title mb-1">
                <i className="la la-brain color-primary mr-10"></i>
                Painel de Auditoria &amp; Cruzamento com IA
              </h4>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {empresaAtual ? `${empresaAtual.nome} (NIF: ${empresaAtual.nif})` : 'Conferência Fiscal Angolana'} — {mesNome}/{ano}
              </span>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <select
                className="form-control form-control-default"
                style={{ width: 'auto', minWidth: 190 }}
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
              >
                {empresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.nome}
                  </option>
                ))}
              </select>

              <select
                className="form-control form-control-default"
                style={{ width: 'auto', minWidth: 120 }}
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              >
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.nome}
                  </option>
                ))}
              </select>

              <select
                className="form-control form-control-default"
                style={{ width: 'auto', minWidth: 90 }}
                value={ano}
                onChange={(e) => setAno(e.target.value)}
              >
                {[anoAtual, anoAtual - 1, anoAtual - 2, 2026, 2025, 2024]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="btn btn-primary btn-default btn-squared"
                onClick={handleAnalisarComIA}
                disabled={analisandoIA || executando || !empresaId}
              >
                <i className={analisandoIA ? 'la la-spinner la-spin mr-5' : 'la la-brain mr-5'}></i>
                {analisandoIA ? 'A IA está a Analisar...' : 'Analisar com IA'}
              </button>

              <button
                type="button"
                className="btn btn-outline-success btn-default btn-squared"
                onClick={() => setRelatorioModal(true)}
              >
                <i className="la la-file-pdf mr-5"></i> Parecer em PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="row mb-25">
          <div className="col-12">
            <div className="progress" style={{ height: 6, borderRadius: 3, backgroundColor: '#f1f2f6' }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{ width: '100%', backgroundColor: '#5f63f2', borderRadius: 3 }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* 1.5. VISÃO ANUAL DOS 12 MESES (SEMÁFORO DO EXERCÍCIO) */}
      <div className="row mb-25">
        <div className="col-12">
          <div className="card card-default">
            <div className="card-body p-15">
              <div className="d-flex justify-content-between align-items-center mb-10 flex-wrap" style={{ gap: 8 }}>
                <span className="fw-700 color-dark" style={{ fontSize: 13 }}>
                  <i className="la la-calendar mr-5 color-primary"></i>
                  Exercício Fiscal de {ano} — Acompanhamento dos 12 Meses
                </span>
                <span className="text-muted" style={{ fontSize: 11.5 }}>
                  Clique num mês para auditar e confrontar os documentos
                </span>
              </div>

              <div className="d-flex flex-wrap" style={{ gap: 6 }}>
                {MESES.map((m) => {
                  const isAtivo = String(m.valor) === String(mes);
                  const temDados = String(m.valor) === '7' && temBalancete;
                  return (
                    <button
                      key={m.valor}
                      type="button"
                      onClick={() => setMes(m.valor)}
                      className={`btn btn-sm btn-squared ${isAtivo ? 'btn-primary' : 'btn-outline-light'}`}
                      style={{
                        flex: '1 1 80px',
                        padding: '8px 4px',
                        fontSize: 12,
                        fontWeight: isAtivo ? 700 : 500,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: isAtivo ? '2px solid #5f63f2' : '1px solid #eef0f3',
                        backgroundColor: isAtivo ? '#5f63f2' : '#ffffff',
                        color: isAtivo ? '#ffffff' : '#272b41',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{m.nome.substring(0, 3)}</span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          marginTop: 4,
                          backgroundColor: isAtivo
                            ? '#20c997'
                            : temDados
                            ? '#fa8b0c'
                            : '#e2e5ec',
                        }}
                      ></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CARREGAMENTO DO MÊS: DOSSIÊ COMPLETO (RECOMENDADO) OU SEPARADO */}
      <div className="row mb-20">
        <div className="col-12">
          <div
            className="card card-default p-20 d-flex flex-row justify-content-between align-items-center flex-wrap shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
              border: '1.5px dashed #5f63f2',
              borderRadius: 12,
              gap: 16,
            }}
          >
            <div className="d-flex align-items-center" style={{ gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: '#5f63f2',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  boxShadow: '0 4px 10px rgba(95, 99, 242, 0.25)',
                }}
              >
                📦
              </div>
              <div>
                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                  <h5 className="mb-0 fw-600 color-dark" style={{ fontSize: 16 }}>
                    Dossiê Mensal Completo (Envelope Fiscal Único)
                  </h5>
                  <span className="badge badge-primary font-weight-bold" style={{ fontSize: 11, padding: '4px 8px' }}>
                    ⭐ Opção 1 (Recomendada)
                  </span>
                </div>
                <p className="mb-0 text-muted mt-4" style={{ fontSize: 13 }}>
                  Envie 1 único PDF com tudo (Balancete, Declarações AGT, Folhas de Salário, INSS e Retenções). O sistema divide, organiza e audita automaticamente!
                </p>
              </div>
            </div>
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline-secondary btn-squared"
                style={{ fontWeight: 600, padding: '10px 16px', fontSize: 13 }}
                title="Forçar reavaliação de todos os motores fiscais deste período"
                disabled={executando}
                onClick={handleExecutarAuditoria}
              >
                <i className={`la ${executando ? 'la-spinner la-spin' : 'la-sync-alt'} mr-6`}></i>
                {executando ? 'A Auditar...' : 'Reavaliar Motores'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-squared"
                style={{ fontWeight: 600, padding: '10px 22px', fontSize: 13.5 }}
                onClick={() => {
                  setTipoUpload('DOSSIE_MENSAL');
                  setUploadModal(true);
                }}
              >
                <i className="la la-cloud-upload-alt mr-6" style={{ fontSize: 18 }}></i>
                Carregar Dossiê do Mês (1 Ficheiro)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center mb-12" style={{ gap: 8 }}>
        <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
          Ou envie os documentos separadamente (caso não estejam agrupados num único PDF):
        </span>
      </div>

      <div className="row mb-25">
        {/* Pilar 1: Balancete */}
        <div className="col-12 col-md-6 mb-15 mb-md-0">
          <div className="card h-100 card-default" style={{ border: temBalancete ? '1px solid #20c997' : '1px solid #eef0f3' }}>
            <div className="card-body p-20 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
              <div className="d-flex align-items-center" style={{ gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: temBalancete ? '#e8faf4' : '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  📘
                </div>
                <div>
                  <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 14 }}>
                    1. Balancete da Empresa (Contabilidade)
                  </h6>
                  <p className="mb-0 text-muted text-truncate" style={{ fontSize: 12, maxWidth: 260 }}>
                    {temBalancete
                      ? (docBase.balancete?.nome || 'Balancete do Mês Validado')
                      : 'Vendas, compras, caixa e contas da empresa'}
                  </p>
                </div>
              </div>

              <div className="d-flex align-items-center" style={{ gap: 8 }}>
                <span className={`badge ${temBalancete ? 'badge-success' : 'badge-warning'}`}>
                  {temBalancete ? 'Carregado & Pronto' : 'Falta Enviar'}
                </span>
                <button
                  type="button"
                  className={`btn btn-sm ${temBalancete ? 'btn-default btn-white' : 'btn-primary btn-squared'}`}
                  onClick={() => {
                    setTipoUpload('BALANCETE');
                    setUploadModal(true);
                  }}
                >
                  <i className="la la-upload mr-5"></i>
                  {temBalancete ? 'Substituir' : 'Subir Balancete'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pilar 2: Declaração AGT */}
        <div className="col-12 col-md-6">
          <div className="card h-100 card-default" style={{ border: temPortalAgt ? '1px solid #20c997' : '1px solid #eef0f3' }}>
            <div className="card-body p-20 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
              <div className="d-flex align-items-center" style={{ gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: temPortalAgt ? '#e8faf4' : '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  🏛️
                </div>
                <div>
                  <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 14 }}>
                    2. Dados do Portal da AGT (Finanças)
                  </h6>
                  <p className="mb-0 text-muted text-truncate" style={{ fontSize: 12, maxWidth: 260 }}>
                    {temPortalAgt
                      ? (docBase.portal_agt?.nome || 'Declaração Modelo 7 da AGT')
                      : 'Declaração oficial submetida à AGT'}
                  </p>
                </div>
              </div>

              <div className="d-flex align-items-center" style={{ gap: 8 }}>
                <span className={`badge ${temPortalAgt ? 'badge-success' : 'badge-warning'}`}>
                  {temPortalAgt ? 'Carregado & Pronto' : 'Falta Enviar'}
                </span>
                <button
                  type="button"
                  className={`btn btn-sm ${temPortalAgt ? 'btn-default btn-white' : 'btn-primary btn-squared'}`}
                  onClick={() => {
                    setTipoUpload('MODELO7');
                    setUploadModal(true);
                  }}
                >
                  <i className="la la-upload mr-5"></i>
                  {temPortalAgt ? 'Substituir' : 'Subir Modelo 7'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 4 NÚMEROS CHAVE (KPIS) */}
      <div className="row mb-25">
        <div className="col-12 col-sm-6 col-xl-3 mb-15 mb-xl-0">
          <div className="card card-default h-100">
            <div className="card-body p-20">
              <span className="text-muted d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Total Faturado no Mês
              </span>
              <h3 className="mt-5 mb-0 fw-800 color-dark" style={{ fontSize: 22 }}>
                {formatKz(indicadores.volume_negocios)}
              </h3>
              <span className="d-block mt-5 text-muted" style={{ fontSize: 11 }}>
                Vendas e serviços registados (61/62)
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3 mb-15 mb-xl-0">
          <div className="card card-default h-100">
            <div className="card-body p-20">
              <span className="text-muted d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                IVA Declarado à AGT
              </span>
              <h3 className="mt-5 mb-0 fw-800 color-primary" style={{ fontSize: 22 }}>
                {formatKz(indicadores.iva_liquidado)}
              </h3>
              <span className="d-block mt-5 text-muted" style={{ fontSize: 11 }}>
                Imposto das vendas (Modelo 7 AGT)
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3 mb-15 mb-xl-0">
          <div
            className="card card-default h-100"
            style={{
              backgroundColor: indicadores.caixa_credor_anormal ? '#ffecec' : '#ffffff',
              border: indicadores.caixa_credor_anormal ? '1px solid #ff4d4f' : '1px solid #eef0f3',
            }}
          >
            <div className="card-body p-20">
              <div className="d-flex justify-content-between align-items-center">
                <span className="d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase', color: indicadores.caixa_credor_anormal ? '#ff4d4f' : '#9299b8' }}>
                  Dinheiro em Caixa (Cofre)
                </span>
                {indicadores.caixa_credor_anormal && (
                  <span className="badge badge-danger" style={{ fontSize: 9, fontWeight: 800 }}>
                    Alerta
                  </span>
                )}
              </div>
              <h3 className="mt-5 mb-0 fw-800" style={{ fontSize: 22, color: indicadores.caixa_credor_anormal ? '#ff4d4f' : '#272b41' }}>
                {formatKz(indicadores.caixa_saldo_credor)}
              </h3>
              <span className="d-block mt-5" style={{ fontSize: 11, color: indicadores.caixa_credor_anormal ? '#ff4d4f' : '#9299b8' }}>
                {indicadores.caixa_credor_anormal ? '🚨 Saída sem registo prévio' : 'Saldo físico de dinheiro da empresa'}
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="card card-default h-100"
            style={{
              backgroundColor: parseFloat(indicadores.exposicao_total_potencial || 0) > 0 ? '#fff8ec' : '#ffffff',
              border: parseFloat(indicadores.exposicao_total_potencial || 0) > 0 ? '1px solid #fa8b0c' : '1px solid #eef0f3',
            }}
          >
            <div className="card-body p-20">
              <span className="text-muted d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Valor em Risco / Possíveis Multas
              </span>
              <h3 className="mt-5 mb-0 fw-800 color-warning" style={{ fontSize: 22 }}>
                {formatKz(indicadores.exposicao_total_potencial)}
              </h3>
              <span className="d-block mt-5 text-muted" style={{ fontSize: 11 }}>
                Impostos não retidos ou diferenças da AGT
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CONFRONTO DIRETO DOS 2 DOCUMENTOS: IGUAIS vs DIFERENÇAS */}
      <div className="row mb-25">
        <div className="col-12">
          <div className="card card-default" style={{ borderTop: '3px solid #20c997' }}>
            <div className="card-header py-15 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
              <div className="d-flex align-items-center" style={{ gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚖️</span>
                <div>
                  <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 15 }}>
                    Confronto Documental Direto: Balancete vs Modelo 7 AGT
                  </h6>
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    {analiseIAEstruturada?.documentosConfrontados ||
                      'Confronto exclusivo entre o que consta na Contabilidade e o que foi entregue às Finanças'}
                  </span>
                </div>
              </div>

              <div className="d-flex align-items-center" style={{ gap: 8 }}>
                <span className="badge badge-success px-10 py-5" style={{ fontSize: 11, fontWeight: 700 }}>
                  <i className="la la-check mr-5"></i>{' '}
                  {analiseIAEstruturada ? `${analiseIAEstruturada.iguaisCount} Dados Iguais` : '0 Conformes'}
                </span>
                <span
                  className={`badge px-10 py-5 ${
                    (analiseIAEstruturada?.diferencasCount ?? 0) > 0 ? 'badge-danger' : 'badge-light text-muted'
                  }`}
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  <i className="la la-exclamation-triangle mr-5"></i>{' '}
                  {analiseIAEstruturada
                    ? `${analiseIAEstruturada.diferencasCount} Diferença(s)`
                    : '0 Divergências'}
                </span>
              </div>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-basic mb-0">
                  <thead>
                    <tr>
                      <th>Ponto Confrontado</th>
                      <th>Contabilidade (Balancete)</th>
                      <th>Portal da AGT (Modelo 7)</th>
                      <th style={{ textAlign: 'center', width: 130 }}>Situação</th>
                      <th style={{ textAlign: 'right', width: 180 }}>Diferença Apurada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiseIAEstruturada?.itensConfronto && analiseIAEstruturada.itensConfronto.length > 0 ? (
                      analiseIAEstruturada.itensConfronto.map((item, idx) => {
                        const isIgual = item.status === 'IGUAIS' || item.status === 'OK' || item.status === 'CONFORME';
                        const isDiferenca = item.status === 'DIFERENÇA' || item.status === 'DIFERENCA';
                        return (
                          <tr key={idx}>
                            <td>
                              <strong className="d-block color-dark" style={{ fontSize: 13 }}>
                                {item.campo}
                              </strong>
                            </td>
                            <td>
                              <strong className="color-dark" style={{ fontSize: 13 }}>
                                {item.contabilidade}
                              </strong>
                            </td>
                            <td>
                              <strong className="color-dark" style={{ fontSize: 13 }}>
                                {item.agt}
                              </strong>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className={`badge px-10 py-5 ${
                                  isIgual ? 'badge-success' : isDiferenca ? 'badge-danger' : 'badge-warning'
                                }`}
                                style={{ fontSize: 11, fontWeight: 700 }}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong
                                className={
                                  isIgual ? 'color-success' : isDiferenca ? 'color-danger' : 'color-warning'
                                }
                                style={{ fontSize: 13 }}
                              >
                                {item.diferenca}
                              </strong>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center p-40" style={{ backgroundColor: '#fafafb' }}>
                          <div className="py-25">
                            <i className="la la-balance-scale color-primary mb-10" style={{ fontSize: 36, opacity: 0.85, display: 'inline-block' }}></i>
                            <h6 className="fw-600 color-dark mb-5" style={{ fontSize: 15 }}>
                              Nenhum confronto documental realizado para este período
                            </h6>
                            <p className="text-muted mb-15" style={{ fontSize: 13, maxWidth: 520, margin: '0 auto' }}>
                              Para visualizar o confronto exato entre a Contabilidade e a AGT, envie os ficheiros oficiais válidos (Balancete de Verificação e Declaração Modelo 7) e clique em "Analisar com IA".
                            </p>
                            {dadosAuditoria?.documentos_base?.balancete?.presente && dadosAuditoria?.documentos_base?.portal_agt?.presente ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm btn-squared"
                                onClick={handleAnalisarComIA}
                                disabled={analisandoIA}
                              >
                                <i className="la la-brain mr-5"></i> Executar Confronto com Inteligência Artificial
                              </button>
                            ) : (
                              <span className="badge badge-light text-muted px-15 py-8" style={{ fontSize: 12 }}>
                                <i className="la la-info-circle mr-5"></i> Aguardando upload dos 2 documentos válidos
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {analiseIAEstruturada?.observacao && (
                <div className="p-15 border-top" style={{ backgroundColor: '#fcfdfe', fontSize: 12, color: '#5a5f7d' }}>
                  <i className="la la-info-circle mr-5 color-primary"></i>
                  <strong>Nota Técnica:</strong> {analiseIAEstruturada.observacao}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. PARECER & PREVISÃO DA INTELIGÊNCIA ARTIFICIAL (IA) */}
      {analisandoIA && (
        <div className="row mb-25">
          <div className="col-12">
            <div className="card card-default text-center p-30" style={{ border: '1px solid #dcdffd' }}>
              <div className="card-body">
                <span className="atbd-spin-dots spin-lg mb-15">
                  <span className="spin-dot badge-dot dot-primary"></span>
                  <span className="spin-dot badge-dot dot-primary"></span>
                  <span className="spin-dot badge-dot dot-primary"></span>
                  <span className="spin-dot badge-dot dot-primary"></span>
                </span>
                <h5 className="fw-600 color-dark mb-10">A Inteligência Artificial está a ler e a cruzar os documentos...</h5>
                <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                  A extrair os campos do Balancete e da Declaração Modelo 7, prevendo divergências e calculando o risco fiscal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {resultadoIA && !analisandoIA && (
        <>
          {/* Card 1: ANÁLISE TÉCNICA DAS DIFERÊNCIAS E PONTOS CONFORMES */}
          <div className="row mb-25">
            <div className="col-12">
              <div className="card card-default card-md" style={{ borderTop: '3px solid #5f63f2' }}>
                <div className="card-header py-15 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                  <div className="d-flex align-items-center" style={{ gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🧠</span>
                    <div>
                      <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 15 }}>
                        Diagnóstico Técnico &amp; Parecer da Inteligência Artificial
                      </h6>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        Análise automatizada de causas, enquadramento fiscal e conformidade documental
                      </span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                    <span className="badge badge-success px-10 py-5" style={{ fontSize: 11, fontWeight: 700 }}>
                      <i className="la la-check mr-5"></i> Diagnóstico Concluído
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary btn-squared"
                      style={{ fontSize: 11 }}
                      onClick={() => setMostrarTextoBruto(!mostrarTextoBruto)}
                      title="Ver ou ocultar os detalhes técnicos do relatório da IA"
                    >
                      <i className={`la ${mostrarTextoBruto ? 'la-eye-slash' : 'la-terminal'} mr-5`}></i>
                      {mostrarTextoBruto ? 'Ocultar Log Técnico' : 'Log Técnico da IA'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary btn-squared"
                      onClick={handleAnalisarComIA}
                      disabled={analisandoIA}
                    >
                      <i className="la la-sync mr-5"></i> Reanalisar com IA
                    </button>
                  </div>
                </div>

                <div className="card-body p-25">
                  {/* Resumo Executivo em Cards Visuais */}
                  <div className="row mb-25">
                    <div className="col-12 col-md-4 mb-10 mb-md-0">
                      <div className="p-15 rounded h-100" style={{ backgroundColor: '#f8f9fb', border: '1px solid #eef0f3' }}>
                        <span className="text-muted d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                          Pontos Confrontados
                        </span>
                        <h4 className="mt-5 mb-0 fw-700 color-dark" style={{ fontSize: 20 }}>
                          {analiseIAEstruturada?.totalPontos || 0} Campos
                        </h4>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Balancete Contabilidade vs Modelo 7
                        </span>
                      </div>
                    </div>
                    <div className="col-12 col-md-4 mb-10 mb-md-0">
                      <div className="p-15 rounded h-100" style={{ backgroundColor: '#f6fbf9', border: '1px solid #c8eedf' }}>
                        <span className="color-success d-block fw-600" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                          Conformes (Iguais)
                        </span>
                        <h4 className="mt-5 mb-0 fw-700 color-success" style={{ fontSize: 20 }}>
                          {analiseIAEstruturada?.iguaisCount || 0} Conformidades
                        </h4>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Valores validados sem divergência
                        </span>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div
                        className="p-15 rounded h-100"
                        style={{
                          backgroundColor: (analiseIAEstruturada?.diferencasCount || 0) > 0 ? '#fff8ec' : '#f6fbf9',
                          border: (analiseIAEstruturada?.diferencasCount || 0) > 0 ? '1px solid #ffd8a8' : '1px solid #c8eedf',
                        }}
                      >
                        <span
                          className={`d-block fw-600 ${(analiseIAEstruturada?.diferencasCount || 0) > 0 ? 'color-warning' : 'color-success'}`}
                          style={{ fontSize: 11, textTransform: 'uppercase' }}
                        >
                          {(analiseIAEstruturada?.diferencasCount || 0) > 0 ? 'Divergências' : 'Risco Fiscal'}
                        </span>
                        <h4
                          className={`mt-5 mb-0 fw-700 ${(analiseIAEstruturada?.diferencasCount || 0) > 0 ? 'color-warning' : 'color-success'}`}
                          style={{ fontSize: 20 }}
                        >
                          {(analiseIAEstruturada?.diferencasCount || 0) > 0
                            ? `${analiseIAEstruturada.diferencasCount} Ponto(s)`
                            : 'Zero Divergências'}
                        </h4>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {(analiseIAEstruturada?.diferencasCount || 0) > 0
                            ? 'Avaliadas perante o Código do IVA'
                            : 'Total conformidade com o Código do IVA'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Diferenças Detalhadas */}
                  {analiseIAEstruturada?.diferencasDetalhadas && analiseIAEstruturada.diferencasDetalhadas.length > 0 ? (
                    <div className="mb-25">
                      <h6 className="fw-700 color-dark mb-15 d-flex align-items-center" style={{ fontSize: 14 }}>
                        <i className="la la-exclamation-circle color-danger mr-8" style={{ fontSize: 18 }}></i>
                        Diferenças Apuradas no Confronto e Exposição Fiscal:
                      </h6>

                      <div className="row">
                        {analiseIAEstruturada.diferencasDetalhadas.map((dif, idx) => (
                          <div className="col-12 mb-15" key={idx}>
                            <div
                              style={{
                                backgroundColor: '#fff9f9',
                                border: '1px solid #ffd6d6',
                                borderRadius: 8,
                                padding: '16px 20px',
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-center flex-wrap mb-12">
                                <span className="badge badge-danger px-10 py-5" style={{ fontSize: 12, fontWeight: 700 }}>
                                  Ponto #{idx + 1}: {dif.titulo}
                                </span>
                              </div>

                              <div className="row mb-12" style={{ fontSize: 13 }}>
                                <div className="col-12 col-md-6 mb-8 mb-md-0">
                                  <div className="p-10 rounded" style={{ backgroundColor: '#ffffff', border: '1px solid #ffe3e3' }}>
                                    <span className="text-muted d-block" style={{ fontSize: 11 }}>No Balancete da Contabilidade:</span>
                                    <strong className="color-dark">{dif.balancete || 'Verificar balancete'}</strong>
                                  </div>
                                </div>
                                <div className="col-12 col-md-6">
                                  <div className="p-10 rounded" style={{ backgroundColor: '#ffffff', border: '1px solid #ffe3e3' }}>
                                    <span className="text-muted d-block" style={{ fontSize: 11 }}>Declarado no Modelo 7 AGT:</span>
                                    <strong className="color-dark">{dif.agt || 'Verificar declaração'}</strong>
                                  </div>
                                </div>
                              </div>

                              {dif.causas && dif.causas.length > 0 && (
                                <div className="mb-10">
                                  <strong className="d-block color-dark mb-5" style={{ fontSize: 12 }}>
                                    <i className="la la-search color-primary mr-5"></i> Causa Provável:
                                  </strong>
                                  <ul className="mb-0 pl-20" style={{ fontSize: 12.5, color: '#495057' }}>
                                    {dif.causas.map((c, cIdx) => (
                                      <li key={cIdx} className="mb-3">{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {dif.riscos && dif.riscos.length > 0 && (
                                <div
                                  style={{
                                    backgroundColor: '#fff',
                                    borderRadius: 6,
                                    padding: '10px 14px',
                                    border: '1px solid #ffe3e3',
                                    marginTop: 10,
                                  }}
                                >
                                  <strong className="d-block color-danger mb-5" style={{ fontSize: 12 }}>
                                    <i className="la la-shield-alt mr-5"></i> Enquadramento &amp; Risco Fiscal Perante a AGT:
                                  </strong>
                                  <ul className="mb-0 pl-20" style={{ fontSize: 12.5, color: '#721c24' }}>
                                    {dif.riscos.map((r, rIdx) => (
                                      <li key={rIdx} className="mb-3">{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Bloco de Pontos Conformados */}
                  {analiseIAEstruturada?.pontosIguais && analiseIAEstruturada.pontosIguais.length > 0 && (
                    <div
                      style={{
                        backgroundColor: '#f6fbf9',
                        border: '1px solid #c8eedf',
                        borderRadius: 8,
                        padding: '16px 20px',
                      }}
                    >
                      <h6 className="fw-700 color-success mb-10 d-flex align-items-center" style={{ fontSize: 13 }}>
                        <i className="la la-check-circle color-success mr-8" style={{ fontSize: 18 }}></i>
                        Pontos em Perfeita Conformidade (Sem Risco):
                      </h6>
                      <ul className="mb-0 pl-20" style={{ fontSize: 12.5, color: '#272b41' }}>
                        {analiseIAEstruturada.pontosIguais.map((p, pIdx) => (
                          <li key={pIdx} className="mb-4">
                            <strong>{p}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Log Técnico Retrátil (apenas exibido se solicitado pelo usuário) */}
                  {mostrarTextoBruto && (
                    <div
                      className="mt-20 p-20"
                      style={{
                        backgroundColor: '#1b1d28',
                        color: '#d6d9e0',
                        borderRadius: 8,
                        border: '1px solid #2e3346',
                        fontSize: 12,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-10 pb-5 border-bottom" style={{ borderColor: '#2e3346' }}>
                        <strong className="color-white" style={{ fontSize: 12 }}>
                          <i className="la la-terminal mr-5 color-primary"></i> Saída Técnica da IA (Log)
                        </strong>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-light"
                          style={{ fontSize: 11 }}
                          onClick={() => setMostrarTextoBruto(false)}
                        >
                          Fechar
                        </button>
                      </div>
                      {resultadoIA}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: PLANO DE AÇÃO E COMO RESOLVER (RECOMENDAÇÕES) */}
          {recomendacoesExibir && recomendacoesExibir.length > 0 && (
            <div className="row mb-25">
              <div className="col-12">
                <div className="card card-default" style={{ borderTop: '3px solid #20c997' }}>
                  <div className="card-header py-15 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                    <div className="d-flex align-items-center" style={{ gap: 10 }}>
                      <span style={{ fontSize: 22 }}>📋</span>
                      <div>
                        <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 15 }}>
                          Como Resolver: Plano de Ação Passo a Passo
                        </h6>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Orientações práticas para regularizar os registos contábeis e fiscais
                        </span>
                      </div>
                    </div>
                    <span className="badge badge-primary px-10 py-5" style={{ fontSize: 11, fontWeight: 700 }}>
                      {recomendacoesExibir.length} Ações Recomendadas
                    </span>
                  </div>

                  <div className="card-body p-25">
                    <div className="row">
                      {recomendacoesExibir.map((rec) => (
                        <div className="col-12 col-lg-6 mb-15" key={rec.numero}>
                          <div
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #eef0f3',
                              borderRadius: 8,
                              padding: 16,
                              height: '100%',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            }}
                          >
                            <div className="d-flex align-items-center mb-10" style={{ gap: 10 }}>
                              <span
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  backgroundColor: '#5f63f2',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {rec.numero}
                              </span>
                              <strong className="color-dark" style={{ fontSize: 13 }}>
                                {rec.titulo}
                              </strong>
                            </div>

                            {rec.detalhes.length > 0 && (
                              <ul className="mb-0 pl-25" style={{ fontSize: 12, color: '#5a5f7d', lineHeight: 1.6 }}>
                                {rec.detalhes.map((det, dIdx) => (
                                  <li key={dIdx} className="mb-3">{det}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {analiseIAEstruturada?.resultadoEsperado && analiseIAEstruturada.resultadoEsperado.length > 0 && (
                      <div
                        className="mt-15 p-15"
                        style={{
                          backgroundColor: '#f0fbf7',
                          borderRadius: 8,
                          border: '1px solid #b7f4db',
                        }}
                      >
                        <strong className="d-block color-success mb-5" style={{ fontSize: 12.5 }}>
                          <i className="la la-check-circle mr-5"></i> Resultado Esperado:
                        </strong>
                        <ul className="mb-0 pl-20" style={{ fontSize: 12, color: '#1f684e' }}>
                          {analiseIAEstruturada.resultadoEsperado.map((res, rIdx) => (
                            <li key={rIdx}>{res}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-20 pt-15 border-top d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                      <span className="text-muted" style={{ fontSize: 11.5 }}>
                        Confronto emitido com base no Balancete de Verificação e na Declaração Modelo 7 da AGT
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-muted p-0"
                        style={{ fontSize: 12, textDecoration: 'none' }}
                        onClick={() => setMostrarTextoBruto(!mostrarTextoBruto)}
                      >
                        <i className={`la ${mostrarTextoBruto ? 'la-eye-slash' : 'la-eye'} mr-5`}></i>
                        {mostrarTextoBruto ? 'Ocultar Texto Integral da IA' : 'Ver Texto Integral da IA'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!resultadoIA && !analisandoIA && (
        <div className="row mb-25">
          <div className="col-12">
            <div className="card card-default" style={{ backgroundColor: '#fdfdff', border: '1px dashed #dcdffd' }}>
              <div className="card-body p-20 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                <div className="d-flex align-items-center" style={{ gap: 12 }}>
                  <span style={{ fontSize: 28 }}>🧠</span>
                  <div>
                    <h6 className="mb-0 fw-600 color-dark">Previsão e Diagnóstico com Inteligência Artificial</h6>
                    <p className="mb-0 text-muted" style={{ fontSize: 12 }}>
                      Suba os dois documentos acima e clique em <strong>Analisar com IA</strong> para cruzar os dados da contabilidade e da AGT.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-default btn-squared"
                  disabled={!temBalancete || !temPortalAgt || analisandoIA}
                  onClick={handleAnalisarComIA}
                >
                  <i className="la la-brain mr-5"></i>
                  Analisar com IA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. O QUE NÃO BATE CERTO (DIVERGÊNCIAS DETETADAS) */}
      <div className="row mb-25">
        <div className="col-12">
          <div className="card card-default">
            <div className="card-header py-15 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
              <div>
                <h6 className="mb-0 fw-600 color-dark">
                  O QUE NÃO BATE CERTO NESTE MÊS ({ocorrencias.length})
                </h6>
                <span className="text-muted" style={{ fontSize: 11 }}>
                  Divergências encontradas entre os registos internos e as finanças
                </span>
              </div>

              {ocorrencias.length > 0 && (
                <span className="badge badge-danger">
                  {ocorrencias.length} item(ns) a resolver
                </span>
              )}
            </div>

            <div className="card-body p-20">
              {ocorrencias.length === 0 ? (
                <div className="text-center p-30" style={{ backgroundColor: '#e8faf4', borderRadius: 8, border: '1px solid #b7f4db' }}>
                  <i className="la la-check-circle" style={{ fontSize: 36, color: '#20c997' }}></i>
                  <h6 className="mt-10 mb-5 fw-600" style={{ color: '#0f7b61' }}>
                    Tudo em ordem! Nenhuma inconsistência encontrada para este mês.
                  </h6>
                  <p className="mb-0 text-muted" style={{ fontSize: 12 }}>
                    Os valores registados pela empresa batem com o que foi entregue no Portal da AGT.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-basic mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>Gravidade</th>
                        <th style={{ width: 90 }}>Código</th>
                        <th>O Que Não Bate Certo</th>
                        <th style={{ textAlign: 'right', width: 160 }}>Valor em Risco</th>
                        <th style={{ textAlign: 'center', width: 140 }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocorrencias.map((occ) => (
                        <tr key={occ.id}>
                          <td>
                            <span className={`badge ${SEVERIDADE_BADGE[occ.severidade] || 'badge-warning'}`}>
                              {occ.severidade === 'ALTO' ? 'Crítico' : occ.severidade === 'MEDIO' ? 'Atenção' : 'Ajuste'}
                            </span>
                          </td>
                          <td>
                            <strong className="color-primary" style={{ fontSize: 12 }}>
                              {occ.regra?.codigo}
                            </strong>
                          </td>
                          <td>
                            <strong className="d-block color-dark" style={{ fontSize: 13 }}>
                              {occ.regra?.nome}
                            </strong>
                            <span className="text-muted d-block" style={{ fontSize: 11.5 }}>
                              {occ.recomendacao}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong className="color-dark" style={{ fontSize: 13.5 }}>
                              {formatKz(occ.valor_envolvido)}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary btn-squared"
                              onClick={() => handleAbrirEvidencia(occ)}
                            >
                              Como Resolver <i className="la la-arrow-right ml-1"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. BANNER COMPACTO DE ACESSO AOS 15 MOTORES */}
      <div className="row mb-25">
        <div className="col-12">
          <div className="card card-default" style={{ border: '1px solid #eef0f3' }}>
            <div className="card-body p-20 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
              <div className="d-flex align-items-center" style={{ gap: 12 }}>
                <span style={{ fontSize: 26 }}>🛡️</span>
                <div>
                  <h6 className="mb-0 fw-600 color-dark" style={{ fontSize: 14 }}>
                    Conformidade dos 15 Módulos Fiscais da AGT
                  </h6>
                  <p className="mb-0 text-muted" style={{ fontSize: 12 }}>
                    Consulte as regras individuais de IVA, Salários (IRT), Imposto Industrial, Retenções e PGC.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm btn-squared"
                onClick={() => navigate(`/motores?empresa=${empresaId}&ano=${ano}&mes=${mes}`)}
              >
                Ver os 15 Módulos Detalhados <i className="la la-arrow-right ml-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. MODAL DE COMO RESOLVER O PONTO IDENTIFICADO */}
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
              <div className="modal-content">
                <div className="modal-header" style={{ backgroundColor: '#5f63f2' }}>
                  <div>
                    <h6 className="modal-title" style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>
                      COMO RESOLVER: {evidenciaModal.regra?.codigo} — {evidenciaModal.regra?.nome}
                    </h6>
                    <span className="d-block" style={{ fontSize: 12.5, color: '#fff', opacity: 0.9 }}>
                      Passo a passo prático para colocar as contas da empresa em conformidade com as Finanças (AGT)
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
                  {/* 1. O que não bate certo */}
                  <div className="mb-25">
                    <p className="mb-15 fw-600" style={{ fontSize: 14, color: '#272b41' }}>
                      1. O QUE NÃO BATE CERTO (VALOR EM RISCO)
                    </p>
                    <div className="p-25" style={{ backgroundColor: '#f8f9fb', border: '1px solid #f1f2f6', borderRadius: 6 }}>
                      <div className="row">
                        <div className="col-12 col-sm-6 mb-15">
                          <span className="d-block text-muted" style={{ fontSize: 11, fontWeight: 600 }}>
                            DESCRIÇÃO DA DIFERENÇA
                          </span>
                          <span className="d-block mt-10" style={{ fontSize: 13, fontWeight: 600, color: '#272b41' }}>
                            {evidenciaModal.regra?.descricao || 'Divergência entre a escrituração e a declaração fiscal.'}
                          </span>
                        </div>
                        <div className="col-12 col-sm-6 mb-15">
                          <span className="d-block text-muted" style={{ fontSize: 11, fontWeight: 600 }}>
                            VALOR EM RISCO / DIFERENÇA APURADA
                          </span>
                          <span className="d-block mt-10" style={{ fontSize: 18, fontWeight: 800, color: '#ff4d4f' }}>
                            {formatKz(evidenciaModal.valor_envolvido)}
                          </span>
                        </div>
                      </div>

                      {evidenciaModal.evidencia?.valores && (
                        <div className="mt-15 pt-15" style={{ borderTop: '1px solid #f1f2f6' }}>
                          <span className="d-block text-muted mb-10" style={{ fontSize: 11, fontWeight: 600 }}>
                            DETALHES EXTRAÍDOS DOS DOCUMENTOS
                          </span>
                          <div className="d-flex flex-wrap" style={{ gap: 8 }}>
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

                  {/* 2. O que a lei exige */}
                  <div className="mb-25">
                    <p className="mb-15 fw-600 d-flex align-items-center" style={{ fontSize: 14, color: '#272b41', gap: 8 }}>
                      <i className="la la-gavel" style={{ fontSize: 18, color: '#5f63f2' }}></i>
                      2. O QUE EXIGE A LEGISLAÇÃO ANGOLANA (AGT)
                    </p>
                    <div className="p-25" style={{ backgroundColor: '#fff8ec', border: '1px solid rgba(250,139,12,0.35)', borderRadius: 6 }}>
                      <p className="mb-10 fw-600" style={{ fontSize: 13, color: '#272b41' }}>
                        {evidenciaModal.regra?.base_legal?.legislacao || 'Legislação Tributária Angolana'}
                      </p>
                      <p className="mb-10" style={{ fontSize: 12, fontWeight: 600, color: '#5a5f7d' }}>
                        {evidenciaModal.regra?.base_legal?.artigo}
                      </p>
                      <p className="mb-0" style={{ fontSize: 12, color: '#868eae', fontStyle: 'italic' }}>
                        "{evidenciaModal.regra?.base_legal?.texto || 'Obrigação legal de conformidade e confrontação documental com as declarações entregues.'}"
                      </p>
                    </div>
                  </div>

                  {/* 3. Documentos Analisados */}
                  <div className="mb-25">
                    <p className="mb-15 fw-600" style={{ fontSize: 14, color: '#272b41' }}>
                      3. DOCUMENTOS DE ONDE SAÍRAM ESTES DADOS
                    </p>
                    <div className="p-15" style={{ border: '1px solid #f1f2f6', borderRadius: 6 }}>
                      {(evidenciaModal.evidencia?.fontes || []).map((f, i) => (
                        <div key={i} className="d-flex align-items-center py-10" style={{ gap: 8 }}>
                          <i className="la la-check-circle" style={{ fontSize: 16, color: '#20c997' }}></i>
                          <span style={{ fontSize: 12, color: '#5a5f7d' }}>
                            <strong>{f.tipo === 'BALANCETE' ? 'Balancete da Empresa' : (f.tipo === 'MODELO7' ? 'Declaração Modelo 7 da AGT' : f.tipo)}:</strong> {f.nome}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. O que fazer para resolver */}
                  <div className="mb-25">
                    <p className="mb-15 fw-600" style={{ fontSize: 14, color: '#272b41' }}>
                      4. O QUE DEVE FAZER PARA RESOLVER (AÇÃO PRÁTICA)
                    </p>
                    <div className="p-25" style={{ backgroundColor: '#e8faf4', border: '1px solid rgba(32,201,151,0.35)', borderRadius: 6 }}>
                      <p className="mb-10" style={{ fontSize: 13, color: '#0f7b61', fontWeight: 600 }}>
                        {evidenciaModal.recomendacao || 'Fale com o contabilista para rever os lançamentos e os documentos de suporte deste mês.'}
                      </p>
                      <p className="mb-0" style={{ fontSize: 11.5, color: '#0f7b61' }}>
                        💡 Dica: Corrigir esta divergência internamente ou submeter declaração de substituição antes de qualquer notificação da AGT elimina riscos de coimas.
                      </p>
                    </div>
                  </div>

                  {/* 5. Gestão de Estado */}
                  <div>
                    <p className="mb-15 fw-600" style={{ fontSize: 14, color: '#272b41' }}>
                      5. SITUAÇÃO DESTE PONTO NA EMPRESA
                    </p>
                    <div className="d-flex flex-wrap align-items-center" style={{ gap: 16 }}>
                      <div className="form-group mb-0" style={{ minWidth: 280 }}>
                        <select
                          className="form-control form-control-default"
                          value={novoEstadoOcc}
                          onChange={(e) => setNovoEstadoOcc(e.target.value)}
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
                        className="btn btn-primary btn-default btn-squared btn-sm"
                        onClick={handleSalvarEstadoOcorrencia}
                        disabled={atualizandoOcc || novoEstadoOcc === evidenciaModal.estado}
                      >
                        <i className={atualizandoOcc ? 'la la-spinner' : 'la la-check-circle'}></i>
                        {atualizandoOcc ? ' A guardar...' : ' Atualizar Situação'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-sm btn-default btn-white"
                    onClick={() => setEvidenciaModal(null)}
                  >
                    <i className="la la-times"></i> Fechar
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

      {/* 7. MODAL DE UPLOAD RÁPIDO */}
      {uploadModal && (
        <>
          <div
            className="modal fade show"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            style={{ display: 'block' }}
          >
            <div className="modal-dialog modal-md" role="document">
              <div className="modal-content">
                <div className="modal-header" style={{ backgroundColor: '#5f63f2' }}>
                  <h6 className="modal-title" style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                    Carregar Documento — {mesNome}/{ano}
                  </h6>
                  <button
                    type="button"
                    className="close"
                    aria-label="Close"
                    onClick={() => setUploadModal(false)}
                    style={{ color: '#fff' }}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div className="modal-body p-25">
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Empresa: <strong>{empresaAtual?.nome}</strong> | Período: <strong>{mesNome}/{ano}</strong>
                  </p>

                  <div className="form-group mb-25">
                    <label className="text-capitalize">Tipo de Documento</label>
                    <select
                      className="form-control form-control-default"
                      value={tipoUpload}
                      onChange={(e) => setTipoUpload(e.target.value)}
                    >
                      {TIPOS_DOCUMENTOS.map((t) => (
                        <option key={t.tipo} value={t.tipo}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className="text-center p-25 mb-20"
                    style={{ border: '2px dashed #e3e6ef', borderRadius: 8, backgroundColor: '#f8f9fb' }}
                  >
                    <input
                      type="file"
                      id="file-upload-input-dashboard"
                      accept=".pdf,.xlsx,.csv,.xml"
                      onChange={handleArquivoModalChange}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="file-upload-input-dashboard" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                      <i className="la la-upload" style={{ fontSize: 40, color: '#2c99ff' }}></i>
                      <p className="mb-0 mt-10 fw-600" style={{ fontSize: 14, color: '#272b41' }}>
                        {arquivoUpload ? arquivoUpload.name : 'Clique para selecionar o ficheiro'}
                      </p>
                      <span className="d-block mt-10 text-muted" style={{ fontSize: 12 }}>
                        PDF, Excel (.xlsx), CSV, XML
                      </span>
                    </label>
                    {detectandoDoc && (
                      <div className="text-primary mt-2" style={{ fontSize: 12.5, fontWeight: 600 }}>
                        <i className="la la-spinner la-spin mr-1"></i> A detetar tipo de documento, empresa e período...
                      </div>
                    )}
                    {detecaoDocInfo && !detectandoDoc && (
                      <div className="alert alert-success mt-2 mb-0 py-2 px-3 text-left" style={{ fontSize: 12 }}>
                        <i className="la la-check-circle mr-1"></i>
                        <strong>Detetado:</strong> {detecaoDocInfo.tipo_nome} {detecaoDocInfo.empresa_nome ? '· ' + detecaoDocInfo.empresa_nome : ''} {detecaoDocInfo.mes && detecaoDocInfo.ano ? `(${detecaoDocInfo.mes}/${detecaoDocInfo.ano})` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-sm btn-default btn-white"
                    onClick={() => setUploadModal(false)}
                  >
                    <i className="la la-times"></i> Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-default btn-squared btn-sm"
                    onClick={handleUploadDocumento}
                    disabled={enviandoUpload || !arquivoUpload}
                  >
                    <i className={enviandoUpload ? 'la la-spinner' : 'la la-upload'}></i>
                    {enviandoUpload ? ' A Carregar...' : ' Confirmar e Auditar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setUploadModal(false)}
          ></div>
        </>
      )}

      {/* 8. MODAL DE PARECER TÉCNICO EXECUTIVO */}
      {relatorioModal && (
        <>
          <div
            className="modal fade show"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            style={{ display: 'block' }}
          >
            <div className="modal-dialog modal-xl" role="document">
              <div className="modal-content">
                <div className="modal-header" style={{ backgroundColor: '#272b41' }}>
                  <div className="d-flex align-items-center" style={{ gap: 10 }}>
                    <i className="la la-chart-bar" style={{ color: '#fff', fontSize: 20 }}></i>
                    <h6 className="modal-title" style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                      PARECER TÉCNICO DE AUDITORIA CONTABILÍSTICA E FISCAL
                    </h6>
                  </div>
                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary btn-default btn-squared"
                      onClick={() => window.print()}
                    >
                      <i className="la la-print"></i> Imprimir Parecer
                    </button>
                    <button
                      type="button"
                      className="close"
                      aria-label="Close"
                      onClick={() => setRelatorioModal(false)}
                      style={{ color: '#fff' }}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                </div>
                <div className="modal-body p-25" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <RelatorioParecer
                    dados={dadosAuditoria}
                    empresaAtual={empresaAtual}
                    ano={ano}
                    mes={mes}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-sm btn-default btn-white"
                    onClick={() => setRelatorioModal(false)}
                  >
                    <i className="la la-times"></i> Fechar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-default btn-squared btn-sm"
                    onClick={() => window.print()}
                  >
                    <i className="la la-print"></i> Imprimir Parecer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            onClick={() => setRelatorioModal(false)}
          ></div>
        </>
      )}
    </>
  );
};

export default AuditoriaPeriodoDashboard;
