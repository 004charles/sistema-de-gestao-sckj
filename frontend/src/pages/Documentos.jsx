import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { authHeaders, empresaService, API_BASE } from '../services/api';
import ConfirmModal from '../components/common/ConfirmModal';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';

const PASTAS_ORGANIZACIONAIS = [
  { id: 'TODOS', nomePadrao: 'Todos os Documentos', icone: 'la la-folder-open', tipos: [] },
  { id: 'DOSSIES', nomePadrao: 'Dossiês Mensais Completos (Envelopes)', icone: 'la la-archive', tipos: ['DOSSIE_MENSAL'] },
  { id: 'CONTABILIDADE', nomePadrao: 'Balancetes & Diários', icone: 'la la-book', tipos: ['BALANCETE'] },
  { id: 'FISCAL_AGT', nomePadrao: 'Fiscalidade & AGT', icone: 'la la-landmark', tipos: ['MODELO7', 'IMPOSTO_INDUSTRIAL', 'DECLARACAO_IRT'] },
  { id: 'FATURACAO', nomePadrao: 'Faturação & Comercial', icone: 'la la-file-invoice-dollar', tipos: ['FACTURA_VENDA', 'FACTURA_COMPRA'] },
  { id: 'RH_PESSOAL', nomePadrao: 'Recursos Humanos & Salários', icone: 'la la-users', tipos: ['FOLHA_SALARIAL', 'FOLHA_SS'] },
  { id: 'BANCOS', nomePadrao: 'Bancos & Tesouraria', icone: 'la la-university', tipos: ['EXTRACTO_BANCARIO', 'COMPROVATIVOS'] },
  { id: 'SOCIETARIO', nomePadrao: 'Societário, Contratos & Outros', icone: 'la la-file-contract', tipos: ['RETENCOES', 'OUTRO'] },
];

const TIPOS_DOCUMENTO = [
  { valor: 'DOSSIE_MENSAL', pasta: 'DOSSIES', labelPadrao: '📦 Dossiê Mensal Completo (Envelope Fiscal Multi-páginas)' },
  { valor: 'BALANCETE', pasta: 'CONTABILIDADE', labelPadrao: 'Balancete de Verificação (PGC)' },
  { valor: 'MODELO7', pasta: 'FISCAL_AGT', labelPadrao: 'Declaração Modelo 7 da AGT (IVA)' },
  { valor: 'IMPOSTO_INDUSTRIAL', pasta: 'FISCAL_AGT', labelPadrao: 'Declaração de Imposto Industrial' },
  { valor: 'DECLARACAO_IRT', pasta: 'FISCAL_AGT', labelPadrao: 'Declaração de IRT' },
  { valor: 'FACTURA_VENDA', pasta: 'FATURACAO', labelPadrao: 'Fatura de Venda (Emitida)' },
  { valor: 'FACTURA_COMPRA', pasta: 'FATURACAO', labelPadrao: 'Fatura de Compra / Fornecedor' },
  { valor: 'FOLHA_SALARIAL', pasta: 'RH_PESSOAL', labelPadrao: 'Folha Salarial' },
  { valor: 'FOLHA_SS', pasta: 'RH_PESSOAL', labelPadrao: 'Guia da Segurança Social (INSS)' },
  { valor: 'EXTRACTO_BANCARIO', pasta: 'BANCOS', labelPadrao: 'Extracto Bancário' },
  { valor: 'COMPROVATIVOS', pasta: 'BANCOS', labelPadrao: 'Comprovativo de Pagamento / Transferência' },
  { valor: 'RETENCOES', pasta: 'SOCIETARIO', labelPadrao: 'Comprovativo de Retenção na Fonte' },
  { valor: 'OUTRO', pasta: 'SOCIETARIO', labelPadrao: 'Documento Societário / Outro (Alvará, Contrato, etc.)' },
];

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

const TIPO_BADGE = {
  DOSSIE_MENSAL: 'badge-dark',
  BALANCETE: 'badge-primary',
  MODELO7: 'badge-info',
  IMPOSTO_INDUSTRIAL: 'badge-info',
  DECLARACAO_IRT: 'badge-info',
  FACTURA_VENDA: 'badge-success',
  FACTURA_COMPRA: 'badge-success',
  FOLHA_SALARIAL: 'badge-warning',
  FOLHA_SS: 'badge-warning',
  RETENCOES: 'badge-warning',
  EXTRACTO_BANCARIO: 'badge-secondary',
  COMPROVATIVOS: 'badge-secondary',
  OUTRO: 'badge-light text-dark',
};

const SpinDots = () => (
  <span className="atbd-spin-dots spin-lg">
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
  </span>
);

const Documentos = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = { pt: 'pt-BR', en: 'en-US', zh: 'zh-CN' }[i18n.language?.substring(0, 2)] || 'pt-BR';
  const anoAtual = new Date().getFullYear();

  const [documentos, setDocumentos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Pastas e Filtros
  const [pastaAtiva, setPastaAtiva] = useState('TODOS');
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroAno, setFiltroAno] = useState('todos');

  // Upload Form
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadTipo, setUploadTipo] = useState('BALANCETE');
  const [docName, setDocName] = useState('');
  const [docApagar, setDocApagar] = useState(null);

  const { empresaId, ano, mes, atualizar, escolherSeAusente } = usePeriodo();
  usePeriodoDaUrl();

  const getPastaNome = useCallback(
    (id, fallback) => t(`archive.folders.${id}`, fallback),
    [t]
  );

  const getTipoLabel = useCallback(
    (valor, fallback) => t(`archive.docTypes.${valor}`, fallback),
    [t]
  );

  const getMesNome = useCallback(
    (valor) => {
      const mObj = MESES.find((m) => m.valor === String(valor));
      return mObj ? t(`months.${mObj.chave}`, mObj.nome) : valor;
    },
    [t]
  );

  // Carregar lista de empresas
  useEffect(() => {
    empresaService
      .getAll()
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data.results || [];
        setEmpresas(lista);
        if (lista.length > 0) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          escolherSeAusente({ empresaId: String(sckj ? sckj.id : lista[0].id) });
        }
      })
      .catch(() => setEmpresas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/documentos/listar/`, { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setDocumentos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast.error(t('common.serverError', 'Erro ao aceder ao arquivo digital.'));
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      // Filtro por empresa
      if (empresaId && String(doc.empresa) !== String(empresaId)) {
        return false;
      }
      // Filtro por pasta/categoria
      if (pastaAtiva !== 'TODOS') {
        const pastaObj = PASTAS_ORGANIZACIONAIS.find((p) => p.id === pastaAtiva);
        if (pastaObj && !pastaObj.tipos.includes(doc.tipo)) {
          return false;
        }
      }
      // Filtro por ano
      if (filtroAno !== 'todos' && String(doc.ano) !== String(filtroAno)) {
        return false;
      }
      // Filtro por mês
      if (filtroMes !== 'todos' && String(doc.mes) !== String(filtroMes)) {
        return false;
      }
      // Filtro por termo de busca
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase();
        const nome = (doc.nome_arquivo || '').toLowerCase();
        const tipoLabel = (getTipoLabel(doc.tipo, doc.tipo) || '').toLowerCase();
        if (!nome.includes(termo) && !tipoLabel.includes(termo)) {
          return false;
        }
      }
      return true;
    });
  }, [documentos, empresaId, pastaAtiva, filtroAno, filtroMes, termoBusca, getTipoLabel]);

  // Contadores por pasta para a empresa ativa
  const contadoresPastas = useMemo(() => {
    const docsDaEmpresa = empresaId
      ? documentos.filter((d) => String(d.empresa) === String(empresaId))
      : documentos;
    const mapa = { TODOS: docsDaEmpresa.length };
    PASTAS_ORGANIZACIONAIS.forEach((p) => {
      if (p.id !== 'TODOS') {
        mapa[p.id] = docsDaEmpresa.filter((d) => p.tipos.includes(d.tipo)).length;
      }
    });
    return mapa;
  }, [documentos, empresaId]);

  const [detectando, setDetectando] = useState(false);
  const [detecaoInfo, setDetecaoInfo] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name);
      }
      setDetectando(true);
      setDetecaoInfo(null);
      try {
        const formData = new FormData();
        formData.append('arquivo', file);
        const res = await fetch(`${API_BASE}/documentos/detectar/`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setDetecaoInfo(data);
          if (data.tipo) {
            setUploadTipo(data.tipo);
          }
          if (data.empresa_id) {
            atualizar({
              empresaId: String(data.empresa_id),
              ano: data.ano ? String(data.ano) : undefined,
              mes: data.mes ? String(data.mes) : undefined,
            });
          } else if (data.ano && data.mes) {
            atualizar({
              ano: String(data.ano),
              mes: String(data.mes),
            });
          }
          toast.info(
            `⚡ Detetado: ${data.tipo_nome || data.tipo} ${data.empresa_nome ? '· ' + data.empresa_nome : ''} ${data.mes && data.ano ? `(${data.mes}/${data.ano})` : ''}`,
            { autoClose: 5000 }
          );
        }
      } catch (err) {
        console.warn('Erro ao autodetectar ficheiro:', err);
      } finally {
        setDetectando(false);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning(t('archive.notifications.selectFileWarn', 'Por favor selecione um ficheiro para arquivar.'));
      return;
    }
    if (!empresaId) {
      toast.warning(t('archive.notifications.selectCompanyWarn', 'Selecione a empresa associada ao documento.'));
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('arquivo', selectedFile);
    formData.append('tipo', uploadTipo || 'OUTRO');
    formData.append('empresa_id', empresaId);
    formData.append('ano', ano);
    formData.append('mes', mes);
    if (docName) {
      formData.append('nome', docName);
    }

    try {
      const response = await fetch(`${API_BASE}/documentos/upload/`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (response.ok) {
        const resData = await response.json().catch(() => ({}));
        if (resData.is_dossie) {
          const totalDocs = resData.documentos_criados?.length || 0;
          const anoAudit = resData.ano || ano;
          const mesAudit = resData.mes || mes;
          toast.success(
            <div>
              <div style={{ fontWeight: 'bold' }}>📦 Dossiê Mensal Processado!</div>
              <div style={{ fontSize: '12px', marginTop: '3px' }}>
                {totalDocs} documentos organizados e auditoria 360º concluída.
              </div>
              <button
                type="button"
                className="btn btn-xs btn-primary mt-2"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => navigate(`/auditoria-periodo?empresa=${empresaId}&ano=${anoAudit}&mes=${mesAudit}`)}
              >
                Ver Auditoria e Diagnóstico &rarr;
              </button>
            </div>,
            { autoClose: 9000 }
          );
        } else {
          toast.success(t('archive.notifications.uploadSuccess', 'Documento arquivado e processado com sucesso!'));
        }
        setSelectedFile(null);
        setDocName('');
        setMostrarUpload(false);
        fetchDocumentos();
      } else if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('archive.notifications.duplicateError', 'Já existe um documento com este nome para este período.'));
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || t('common.error', 'Erro ao carregar documento.'));
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error(t('common.serverError', 'Erro de comunicação com o servidor.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (doc) => {
    if (!doc.arquivo_url) {
      toast.error(t('documentos.notAvailableDownload', 'Ficheiro não disponível para descarregar.'));
      return;
    }
    const link = document.createElement('a');
    link.href = doc.arquivo_url;
    link.download = doc.nome_arquivo || 'documento';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (doc) => {
    if (!doc.arquivo_url) {
      toast.error(t('documentos.notAvailableView', 'Ficheiro não disponível para visualização.'));
      return;
    }
    window.open(doc.arquivo_url, '_blank');
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/documentos/${id}/`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (response.ok) {
        toast.success(t('archive.notifications.deleteSuccess', 'Documento removido do arquivo com sucesso.'));
        setDocApagar(null);
        fetchDocumentos();
      } else {
        toast.error(t('archive.notifications.deleteError', 'Erro ao eliminar documento.'));
      }
    } catch (error) {
      console.error('Erro ao apagar:', error);
      toast.error(t('common.serverError', 'Erro de ligação ao servidor.'));
    }
  };

  const empresaAtual = empresas.find((e) => String(e.id) === String(empresaId));

  const anosDisponiveis = [anoAtual, anoAtual - 1, 2026, 2025, 2024, 2023]
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <>
      <style>
        {`
        .dms-pasta-pill {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #4a5568;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .dms-pasta-pill:hover {
          background: #edf2f7;
          color: #2d3748;
          border-color: #cbd5e0;
        }
        .dms-pasta-pill.active {
          background: #5f63f2;
          color: #ffffff;
          border-color: #5f63f2;
          box-shadow: 0 3px 8px rgba(95, 99, 242, 0.25);
        }
        .dms-pasta-pill.active .badge-count {
          background: rgba(255, 255, 255, 0.25) !important;
          color: #ffffff !important;
        }
        .dms-metric-card {
          border: 1px solid #edf0f5;
          border-radius: 10px;
          background: #ffffff;
          padding: 16px 20px;
        }
        `}
      </style>

      {/* CABEÇALHO EXECUTIVO */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-700 color-dark mb-4" style={{ fontSize: 20 }}>
                <i className="la la-folder-open text-primary mr-6"></i>{' '}
                {t('archive.title', 'Arquivo Digital & Repositório da Empresa')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {t(
                  'archive.subtitle',
                  'Guarda e salvaguarda permanente de todos os documentos contabilísticos, fiscais e legais da empresa.'
                )}
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline-lighten btn-default btn-squared"
                onClick={fetchDocumentos}
                disabled={loading}
                style={{ fontSize: 13, background: '#fff', border: '1px solid #dcdfe5' }}
              >
                <i className={`la la-sync mr-5 ${loading ? 'la-spin' : ''}`}></i>{' '}
                {t('archive.refresh', 'Atualizar Arquivo')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-default btn-squared"
                onClick={() => setMostrarUpload(!mostrarUpload)}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <i className={`la ${mostrarUpload ? 'la-times' : 'la-cloud-upload-alt'} mr-5`}></i>
                {mostrarUpload
                  ? t('archive.closeUpload', 'Fechar Upload')
                  : t('archive.newDocument', 'Novo Documento no Arquivo')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MÉTRICAS RÁPIDAS DO ARQUIVO */}
      <div className="row mb-20" style={{ rowGap: 12 }}>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="dms-metric-card h-100">
            <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
              {t('archive.totalArchived', 'Total de Ficheiros Arquivados')}
            </span>
            <div className="fw-700 color-dark" style={{ fontSize: 22 }}>
              {documentosFiltrados.length}{' '}
              <span className="fs-13 text-muted fw-normal">{t('archive.docsCount', 'documentos')}</span>
            </div>
            <span className="text-muted" style={{ fontSize: 11.5 }}>
              {t('archive.docsFilterHint', 'Na empresa e filtros atuais')}
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="dms-metric-card h-100">
            <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
              {t('archive.companyInArchive', 'Empresa em Arquivo')}
            </span>
            <div className="fw-700 color-dark text-truncate" style={{ fontSize: 15 }} title={empresaAtual?.nome}>
              {empresaAtual?.nome || t('archive.allCompanies', 'Todas as Empresas')}
            </div>
            <span className="text-muted" style={{ fontSize: 11.5 }}>
              NIF: {empresaAtual?.nif || t('archive.general', 'Geral')}
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="dms-metric-card h-100">
            <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
              {t('archive.thematicFolders', 'Pastas Temáticas')}
            </span>
            <div className="fw-700 color-dark" style={{ fontSize: 22 }}>
              6 <span className="fs-13 text-muted fw-normal">{t('archive.activeCategories', 'categorias ativas')}</span>
            </div>
            <span className="text-muted" style={{ fontSize: 11.5 }}>
              {t('archive.foldersSummary', 'Balancetes, AGT, Faturas, RH, etc.')}
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="dms-metric-card h-100">
            <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
              {t('archive.fiscalYear', 'Exercício Fiscal')}
            </span>
            <div className="fw-700 color-primary" style={{ fontSize: 22 }}>
              {filtroAno === 'todos' ? t('archive.allYears', 'Todos os Anos') : filtroAno}
            </div>
            <span className="text-muted" style={{ fontSize: 11.5 }}>
              {filtroMes === 'todos' ? t('archive.allMonths', 'Todos os Meses') : getMesNome(filtroMes)}
            </span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE UPLOAD ORGANIZADO */}
      {mostrarUpload && (
        <div className="row mb-25">
          <div className="col-12">
            <div className="card card-default" style={{ border: '2px dashed #5f63f2', borderRadius: 10 }}>
              <div className="card-header py-12 px-20 bg-light border-bottom">
                <strong className="color-dark" style={{ fontSize: 14 }}>
                  <i className="la la-cloud-upload-alt text-primary mr-5"></i>{' '}
                  {t('archive.upload.title', 'Arquivar Novo Documento da Empresa')}
                </strong>
              </div>

              <div className="card-body p-20">
                <form onSubmit={handleUploadSubmit}>
                  <div className="row" style={{ rowGap: 14 }}>
                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.company', 'EMPRESA DETENTORA')}
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={empresaId}
                        onChange={(e) => atualizar({ empresaId: e.target.value })}
                        required
                        style={{ height: 40 }}
                      >
                        {empresas.map((emp) => (
                          <option key={emp.id} value={String(emp.id)}>
                            {emp.nome} ({emp.nif})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.category', 'PASTA / CATEGORIA DO DOCUMENTO')}
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={uploadTipo}
                        onChange={(e) => setUploadTipo(e.target.value)}
                        required
                        style={{ height: 40, fontWeight: 600 }}
                      >
                        {TIPOS_DOCUMENTO.map((tItem) => (
                          <option key={tItem.valor} value={tItem.valor}>
                            {getTipoLabel(tItem.valor, tItem.labelPadrao)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.year', 'EXERCÍCIO (ANO)')}
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={ano}
                        onChange={(e) => atualizar({ ano: e.target.value })}
                        style={{ height: 40 }}
                      >
                        {anosDisponiveis.map((y) => (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.month', 'MÊS FISCAL')}
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={mes}
                        onChange={(e) => atualizar({ mes: e.target.value })}
                        style={{ height: 40 }}
                      >
                        {MESES.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {t(`months.${m.chave}`, m.nome)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.file', 'FICHEIRO A ARQUIVAR (PDF, EXCEL, IMAGEM, CSV)')}
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        onChange={handleFileChange}
                        accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                        required
                        style={{ height: 40, padding: 6 }}
                      />
                      {detectando && (
                        <div className="text-primary mt-1" style={{ fontSize: 12 }}>
                          <i className="la la-spinner la-spin mr-1"></i> A identificar automaticamente empresa, período e tipo de documento...
                        </div>
                      )}
                      {detecaoInfo && !detectando && (
                        <div className="text-success mt-1" style={{ fontSize: 12, fontWeight: 600 }}>
                          <i className="la la-check-circle mr-1"></i> Identificado: {detecaoInfo.tipo_nome} {detecaoInfo.empresa_nome ? '· ' + detecaoInfo.empresa_nome : ''} {detecaoInfo.mes && detecaoInfo.ano ? `(${detecaoInfo.mes}/${detecaoInfo.ano})` : ''}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                        {t('archive.upload.description', 'DESCRIÇÃO / REFERÊNCIA DO ARQUIVO (OPCIONAL)')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t('archive.upload.placeholder', 'Ex: Fatura Fornecedor Raimundo Valente - Julho')}
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        style={{ height: 40 }}
                      />
                    </div>

                    <div className="col-12 pt-10 d-flex justify-content-end" style={{ gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-default btn-squared"
                        onClick={() => setMostrarUpload(false)}
                      >
                        {t('common.cancel', 'Cancelar')}
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-squared"
                        disabled={uploading}
                        style={{ fontWeight: 600 }}
                      >
                        {uploading ? (
                          <>
                            <i className="la la-spinner la-spin mr-5"></i> {t('archive.upload.submitting', 'A Arquivar...')}
                          </>
                        ) : (
                          <>
                            <i className="la la-shield-alt mr-5"></i> {t('archive.upload.submit', 'Guardar no Arquivo Permanente')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO POR PASTAS ORGANIZACIONAIS (TABS / PILLS) */}
      <div className="row mb-15">
        <div className="col-12">
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
            {PASTAS_ORGANIZACIONAIS.map((pasta) => {
              const count = contadoresPastas[pasta.id] || 0;
              const isActive = pastaAtiva === pasta.id;
              const nome = getPastaNome(pasta.id, pasta.nomePadrao);
              return (
                <button
                  key={pasta.id}
                  type="button"
                  className={`dms-pasta-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setPastaAtiva(pasta.id)}
                >
                  <i className={pasta.icone} style={{ fontSize: 15 }}></i>
                  <span>{nome}</span>
                  <span
                    className="badge badge-count"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: isActive ? '#fff' : '#4a5568',
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 10,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E PESQUISA RÁPIDA */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-12">
              <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
                {/* Pesquisa por Nome */}
                <div style={{ flex: '2 1 240px' }}>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-right-0" style={{ border: '1px solid #dcdfe5' }}>
                      <i className="la la-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-left-0"
                      placeholder={t('archive.searchPlaceholder', 'Pesquisar por nome de ficheiro ou categoria...')}
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      style={{ height: 38, fontSize: 13 }}
                    />
                  </div>
                </div>

                {/* Filtro Empresa */}
                <div style={{ flex: '1 1 200px' }}>
                  <select
                    className="form-control form-control-default"
                    value={empresaId}
                    onChange={(e) => atualizar({ empresaId: e.target.value })}
                    style={{ height: 38, fontSize: 12.5 }}
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.nome} ({emp.nif})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Ano */}
                <div style={{ minWidth: 120 }}>
                  <select
                    className="form-control form-control-default"
                    value={filtroAno}
                    onChange={(e) => setFiltroAno(e.target.value)}
                    style={{ height: 38, fontSize: 12.5 }}
                  >
                    <option value="todos">{t('archive.allYears', 'Todos os Anos')}</option>
                    {anosDisponiveis.map((y) => (
                      <option key={y} value={String(y)}>
                        {t('common.year', 'Ano')} {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Mês */}
                <div style={{ minWidth: 130 }}>
                  <select
                    className="form-control form-control-default"
                    value={filtroMes}
                    onChange={(e) => setFiltroMes(e.target.value)}
                    style={{ height: 38, fontSize: 12.5 }}
                  >
                    <option value="todos">{t('archive.allMonths', 'Todos os Meses')}</option>
                    {MESES.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {t(`months.${m.chave}`, m.nome)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE DOCUMENTOS ARQUIVADOS */}
      <div className="row">
        <div className="col-12">
          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-40">
                  <SpinDots />
                  <p className="text-muted mt-10" style={{ fontSize: 13 }}>
                    {t('archive.table.loading', 'A aceder ao repositório de ficheiros...')}
                  </p>
                </div>
              ) : documentosFiltrados.length === 0 ? (
                <div className="text-center py-50 px-20">
                  <div style={{ fontSize: 40 }} className="mb-10">📁</div>
                  <h5 className="fw-700 color-dark mb-5" style={{ fontSize: 16 }}>
                    {t('archive.table.emptyTitle', 'Nenhum documento encontrado no arquivo')}
                  </h5>
                  <p className="text-muted mb-15" style={{ fontSize: 13 }}>
                    {pastaAtiva !== 'TODOS'
                      ? t('archive.table.emptyFolder', 'Não existem documentos registados nesta pasta para os filtros selecionados.')
                      : t('archive.table.emptyGeneral', 'Carregue documentos para garantir a salvaguarda e o arquivo digital permanente da empresa.')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-squared"
                    onClick={() => setMostrarUpload(true)}
                  >
                    <i className="la la-cloud-upload-alt mr-5"></i>{' '}
                    {t('archive.table.archiveFirst', 'Arquivar Primeiro Documento')}
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ width: '40%', fontWeight: 700, color: '#495057' }}>
                          {t('archive.table.doc', 'Documento Arquivado')}
                        </th>
                        <th style={{ width: '22%', fontWeight: 700, color: '#495057' }}>
                          {t('archive.table.folder', 'Categoria / Pasta')}
                        </th>
                        <th style={{ width: '12%', fontWeight: 700, color: '#495057', textAlign: 'center' }}>
                          {t('archive.table.period', 'Período')}
                        </th>
                        <th style={{ width: '12%', fontWeight: 700, color: '#495057', textAlign: 'center' }}>
                          {t('archive.table.registeredAt', 'Data de Registo')}
                        </th>
                        <th style={{ width: '14%', fontWeight: 700, color: '#495057', textAlign: 'right' }}>
                          {t('archive.table.actions', 'Ações')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentosFiltrados.map((doc) => {
                        const tipoObj = TIPOS_DOCUMENTO.find((tItem) => tItem.valor === doc.tipo);
                        const labelTipo = tipoObj ? getTipoLabel(tipoObj.valor, tipoObj.labelPadrao) : doc.tipo;
                        const badgeClasse = TIPO_BADGE[doc.tipo] || 'badge-secondary';
                        const mesTexto = getMesNome(doc.mes);

                        const isPdf = (doc.nome_arquivo || '').toLowerCase().endsWith('.pdf');
                        const isExcel =
                          (doc.nome_arquivo || '').toLowerCase().endsWith('.xlsx') ||
                          (doc.nome_arquivo || '').toLowerCase().endsWith('.xls');

                        return (
                          <tr key={doc.id}>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div className="d-flex align-items-center" style={{ gap: 10 }}>
                                <span
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    backgroundColor: isPdf ? '#ffebee' : isExcel ? '#e8f5e9' : '#f0f2fa',
                                    color: isPdf ? '#d32f2f' : isExcel ? '#2e7d32' : '#5f63f2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    flexShrink: 0,
                                  }}
                                >
                                  <i className={isPdf ? 'la la-file-pdf' : isExcel ? 'la la-file-excel' : 'la la-file-alt'}></i>
                                </span>
                                <div>
                                  <strong className="color-dark d-block" style={{ fontSize: 13.5 }}>
                                    {doc.nome_arquivo}
                                  </strong>
                                  <span className="text-muted" style={{ fontSize: 11.5 }}>
                                    {doc.empresa_nome || t('common.name', 'Empresa')}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td style={{ verticalAlign: 'middle' }}>
                              <span className={`badge ${badgeClasse} px-8 py-3`} style={{ fontSize: 11 }}>
                                {labelTipo}
                              </span>
                            </td>

                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <strong className="color-dark" style={{ fontSize: 12.5 }}>
                                {mesTexto} / {doc.ano}
                              </strong>
                            </td>

                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                {doc.created_at
                                  ? new Date(doc.created_at).toLocaleDateString(dateLocale)
                                  : '---'}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <div className="d-inline-flex align-items-center" style={{ gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-lighten btn-sm"
                                  title={t('archive.table.view', 'Visualizar documento')}
                                  onClick={() => handleView(doc)}
                                  style={{ padding: '5px 9px', borderRadius: 6 }}
                                >
                                  <i className="la la-eye text-primary"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-lighten btn-sm"
                                  title={t('archive.table.download', 'Descarregar ficheiro original (recuperar em caso de perda)')}
                                  onClick={() => handleDownload(doc)}
                                  style={{ padding: '5px 9px', borderRadius: 6 }}
                                >
                                  <i className="la la-download text-success"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-lighten btn-sm"
                                  title={t('archive.table.delete', 'Eliminar documento do arquivo')}
                                  onClick={() => setDocApagar(doc)}
                                  style={{ padding: '5px 9px', borderRadius: 6 }}
                                >
                                  <i className="la la-trash text-danger"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO */}
      <ConfirmModal
        show={Boolean(docApagar)}
        onClose={() => setDocApagar(null)}
        onConfirm={() => docApagar && handleDelete(docApagar.id)}
        title={t('archive.deleteModal.title', 'Eliminar Documento do Arquivo')}
        subtitle={t('archive.deleteModal.subtitle', 'Aviso de salvaguarda permanente')}
        confirmLabel={t('archive.deleteModal.confirm', 'Sim, Eliminar Documento')}
        confirmClass="btn-danger"
      >
        <p className="text-muted mb-0" style={{ fontSize: 13 }}>
          {t('archive.deleteModal.message', {
            name: docApagar?.nome_arquivo,
            defaultValue: `Tem certeza de que deseja eliminar o documento "${docApagar?.nome_arquivo}" do repositório? Esta ação apagará a cópia preservada da empresa.`,
          })}
        </p>
      </ConfirmModal>
    </>
  );
};

export default Documentos;
