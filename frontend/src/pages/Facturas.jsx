import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { facturaService } from '../services/api';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';
import ConfirmModal from '../components/common/ConfirmModal';

const MESES = [
  { valor: 'todos', nome: 'Todos os Meses' },
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

const formatarKz = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
};

const Facturas = () => {
  const fileInputRef = useRef(null);
  const { empresaId, ano, mes, empresaAtual, atualizar } = usePeriodo();
  usePeriodoDaUrl();

  const [facturas, setFacturas] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgresso, setScanProgresso] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Filtros
  const [filtroMes, setFiltroMes] = useState(mes ? String(mes) : 'todos');
  const [filtroConformidade, setFiltroConformidade] = useState('todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [facturaDetalhe, setFacturaDetalhe] = useState(null);
  const [facturaApagar, setFacturaApagar] = useState(null);
  const [lancandoId, setLancandoId] = useState(null);
  const [exportando, setExportando] = useState(false);

  // Sincronizar filtro de mês com o contexto global se mudar
  useEffect(() => {
    if (mes) setFiltroMes(String(mes));
  }, [mes]);

  const carregarFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        empresa_id: empresaId || undefined,
        ano: ano || undefined,
        mes: filtroMes !== 'todos' ? filtroMes : undefined,
        conformidade: filtroConformidade !== 'todos' ? filtroConformidade : undefined,
        search: busca || undefined,
      };
      const res = await facturaService.listar(params);
      setFacturas(res.data.facturas || []);
      setEstatisticas(res.data.estatisticas || null);
    } catch (err) {
      console.error('Erro ao listar facturas:', err);
      toast.error('Não foi possível carregar as facturas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, ano, filtroMes, filtroConformidade, busca]);

  useEffect(() => {
    carregarFacturas();
  }, [carregarFacturas]);

  // Processamento do Scan de Fatura com IA
  const handleUploadFile = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanProgresso('A ler documento e a extrair texto com motor óptico...');

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (empresaId) formData.append('empresa_id', empresaId);

      setScanProgresso('A IA da AGT está a auditar o NIF, taxas de IVA, retenções e regras do CIVA...');
      const res = await facturaService.scanFactura(formData);

      if (res.data?.success) {
        toast.success(`✨ ${res.data.mensagem || 'Fatura processada com sucesso!'}`);
        if (res.data.factura) {
          setFacturaDetalhe(res.data.factura);
          // Se identificou empresa diferente, sugere seleção
          if (res.data.factura.empresa && String(res.data.factura.empresa) !== String(empresaId)) {
            atualizar({ empresaId: String(res.data.factura.empresa) });
          }
        }
        await carregarFacturas();
      }
    } catch (err) {
      console.error('Erro no scan da fatura:', err);
      const msg = err.response?.data?.error || err.message || 'Falha ao processar fatura com IA.';
      toast.error(`❌ ${msg}`);
    } finally {
      setScanning(false);
      setScanProgresso('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Lançar no Diário de Compras
  const handleLancarNoDiario = async (factura) => {
    if (!factura || factura.lancado_na_contabilidade) return;
    setLancandoId(factura.id);
    try {
      const res = await facturaService.lancarNoDiario(factura.id);
      toast.success(`📘 ${res.data?.mensagem || 'Fatura escriturada no Diário de Compras!'}`);
      if (facturaDetalhe && facturaDetalhe.id === factura.id) {
        setFacturaDetalhe(res.data?.factura || { ...facturaDetalhe, lancado_na_contabilidade: true });
      }
      await carregarFacturas();
    } catch (err) {
      console.error('Erro ao lançar fatura:', err);
      toast.error(err.response?.data?.error || 'Erro ao escriturar fatura.');
    } finally {
      setLancandoId(null);
    }
  };

  // Excluir fatura
  const handleConfirmarExclusao = async () => {
    if (!facturaApagar) return;
    try {
      await facturaService.excluir(facturaApagar.id);
      toast.success('Fatura eliminada com sucesso.');
      setFacturas((prev) => prev.filter((f) => f.id !== facturaApagar.id));
      if (facturaDetalhe?.id === facturaApagar.id) setFacturaDetalhe(null);
      setFacturaApagar(null);
      carregarFacturas();
    } catch (err) {
      toast.error('Erro ao eliminar fatura.');
    }
  };

  // Exportar Excel oficial Mapa de Fornecedores AGT
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const params = {
        empresa_id: empresaId || undefined,
        ano: ano || undefined,
        mes: filtroMes !== 'todos' ? filtroMes : undefined,
      };
      const res = await facturaService.exportarExcel(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Mapa_Fornecedores_AGT_${empresaAtual?.nif || 'Geral'}_${ano || 'Periodo'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('📊 Mapa de Fornecedores da AGT exportado com sucesso em Excel!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao descarregar ficheiro Excel do mapa de fornecedores.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="container-fluid py-25">
      {/* 1. TOPO: TÍTULO & IDENTIFICAÇÃO DA EMPRESA */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-25 gap-15">
        <div>
          <div className="d-flex align-items-center gap-10">
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
              }}
            >
              <i className="la la-file-invoice-dollar"></i>
            </span>
            <div>
              <h4 className="fw-700 color-dark mb-0">Leitor & Scanner de Facturas (IA)</h4>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Extração inteligente de dados do fornecedor, conformidade da AGT, apuramento de retenções e integração direta no Livro Diário do PGC.
              </p>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-10">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-6"
            onClick={handleExportarExcel}
            disabled={exportando || facturas.length === 0}
            style={{ borderRadius: 8, height: 38 }}
          >
            <i className={`la ${exportando ? 'la-spinner la-spin' : 'la-file-excel'}`} style={{ fontSize: 16 }}></i>
            {exportando ? 'A Gerar Mapa...' : 'Exportar Mapa AGT (Excel)'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm d-flex align-items-center gap-6"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            style={{ borderRadius: 8, height: 38 }}
          >
            <i className={`la ${scanning ? 'la-spinner la-spin' : 'la-plus'}`} style={{ fontSize: 16 }}></i>
            {scanning ? 'A Analisar...' : 'Nova Factura (Scanner IA)'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
            accept=".pdf,.png,.jpg,.jpeg,.txt,.xml"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* 2. DROPZONE DE RECONHECIMENTO POR IA */}
      <div
        className={`card mb-25 ${isDragging ? 'border-primary' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed #4f46e5' : '1px dashed #cbd5e1',
          background: isDragging ? '#eef2ff' : '#f8fafc',
          borderRadius: 14,
          transition: 'all 0.2s ease',
        }}
      >
        <div className="card-body text-center py-30 px-20">
          {scanning ? (
            <div className="py-20">
              <div className="spinner-border text-primary mb-15" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="sr-only">A analisar...</span>
              </div>
              <h5 className="fw-700 text-primary mb-6">A Processar Documento Fiscal com IA...</h5>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                {scanProgresso}
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#e0e7ff',
                  color: '#4f46e5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  marginBottom: 12,
                }}
              >
                <i className="la la-cloud-upload-alt"></i>
              </div>
              <h5 className="fw-700 mb-6">Arraste a sua Factura para aqui (PDF ou Foto)</h5>
              <p className="text-muted mb-15" style={{ fontSize: 13, maxWidth: 620, margin: '0 auto' }}>
                A IA extrai automaticamente o NIF e dados do fornecedor, verifica a menção de certificação da AGT, calcula as retenções de IVA (7%) e Imposto Industrial (6.5%) e sugere a conta do PGC.
              </p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm px-20"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderRadius: 20 }}
              >
                <i className="la la-folder-open mr-6"></i> Selecionar Ficheiro do Computador
              </button>
              <div className="mt-10">
                <small className="text-muted" style={{ fontSize: 11 }}>
                  Formatos suportados: PDF oficial com selo AGT, imagens (PNG/JPG) e facturas eletrónicas em XML.
                </small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARDS DE MÉTRICAS & RESUMO DO MAPA FISCAL */}
      {estatisticas && (
        <div className="row mb-25">
          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    TOTAL FACTURAS
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 color-dark">{estatisticas.total_contagem}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    {estatisticas.lancadas} escrituradas no diário
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#f1f5f9',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-file-alt"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    BASE DE INCIDÊNCIA
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-primary">{formatarKz(estatisticas.total_base)}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    Total líquido de compras
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-coins"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    IVA SUPORTADO / DEDUTÍVEL
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-success">{formatarKz(estatisticas.total_iva_dedutivel)}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    Suportado: {formatarKz(estatisticas.total_iva_suportado)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#dcfce7',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-check-circle"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    RETENÇÕES NA FONTE
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-warning">
                    {formatarKz(estatisticas.total_retencao_iva + estatisticas.total_retencao_ii)}
                  </h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    IVA 7%: {formatarKz(estatisticas.total_retencao_iva)} | II: {formatarKz(estatisticas.total_retencao_ii)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#fef3c7',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-percentage"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. BARRA DE FILTROS & PESQUISA */}
      <div className="card mb-20 border-0 shadow-sm" style={{ borderRadius: 12 }}>
        <div className="card-body py-15 px-20">
          <div className="row align-items-center">
            <div className="col-md-4 col-sm-12 mb-10 mb-md-0">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-right-0">
                  <i className="la la-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-left-0"
                  placeholder="Pesquisar por fornecedor, NIF ou n.º fatura..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ borderRadius: '0 8px 8px 0', height: 38 }}
                />
              </div>
            </div>

            <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
              <select
                className="form-select form-select-sm"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                style={{ height: 38, borderRadius: 8 }}
              >
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
              <select
                className="form-select form-select-sm"
                value={filtroConformidade}
                onChange={(e) => setFiltroConformidade(e.target.value)}
                style={{ height: 38, borderRadius: 8 }}
              >
                <option value="todos">Todas as Conformidades AGT</option>
                <option value="CONFORME">🟢 Apenas Conformes AGT</option>
                <option value="AVISO">🟡 Com Alertas / Avisos</option>
                <option value="IRREGULAR">🔴 Irregulares</option>
              </select>
            </div>

            <div className="col-md-2 col-sm-12 text-md-end">
              <button
                type="button"
                className="btn btn-light btn-sm w-100"
                onClick={carregarFacturas}
                style={{ height: 38, borderRadius: 8, fontWeight: 600 }}
              >
                <i className="la la-sync-alt mr-4"></i> Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. TABELA DE FACTURAS */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center">
          <h6 className="fw-700 mb-0 color-dark">
            <i className="la la-list-alt text-primary mr-6"></i> Facturas Registadas & Auditadas ({facturas.length})
          </h6>
          {empresaAtual && (
            <span className="badge badge-round badge-light text-muted" style={{ fontSize: 11 }}>
              Empresa Ativa: {empresaAtual.nome} (NIF: {empresaAtual.nif})
            </span>
          )}
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">A carregar...</span>
              </div>
              <p className="text-muted mt-10 mb-0">A carregar registo de facturas...</p>
            </div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-50 px-20">
              <i className="la la-file-invoice text-muted" style={{ fontSize: 50 }}></i>
              <h6 className="fw-600 mt-15 mb-4 text-muted">Nenhuma fatura encontrada neste período</h6>
              <p className="text-muted" style={{ fontSize: 12.5, maxWidth: 450, margin: '0 auto' }}>
                Arraste um PDF ou imagem de fatura para a área superior para processar automaticamente com a inteligência artificial.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5 }}>
                <thead className="table-light">
                  <tr>
                    <th className="py-12 px-15">Documento</th>
                    <th className="py-12 px-15">Data</th>
                    <th className="py-12 px-15">Fornecedor / Emitente</th>
                    <th className="py-12 px-15 text-end">Base Incidência</th>
                    <th className="py-12 px-15 text-end">IVA (Taxa)</th>
                    <th className="py-12 px-15 text-end">Retenções</th>
                    <th className="py-12 px-15 text-end">Total Líquido</th>
                    <th className="py-12 px-15 text-center">Conformidade AGT</th>
                    <th className="py-12 px-15 text-center">Diário PGC</th>
                    <th className="py-12 px-15 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => {
                    const badgeConformidade = {
                      CONFORME: { bg: '#dcfce7', text: '#15803d', label: 'Conforme AGT', icon: 'la-check-circle' },
                      AVISO: { bg: '#fef3c7', text: '#b45309', label: 'Alerta Fiscal', icon: 'la-exclamation-triangle' },
                      IRREGULAR: { bg: '#fee2e2', text: '#b91c1c', label: 'Irregular', icon: 'la-times-circle' },
                    }[f.conformidade_agt] || { bg: '#f1f5f9', text: '#475569', label: f.conformidade_agt, icon: 'la-info-circle' };

                    return (
                      <tr key={f.id}>
                        {/* Tipo e N.º da Fatura */}
                        <td className="px-15 py-12">
                          <div className="d-flex align-items-center gap-8">
                            <span
                              className="badge badge-sm font-weight-bold"
                              style={{
                                background: f.tipo_operacao === 'COMPRA' ? '#e0e7ff' : '#dcfce7',
                                color: f.tipo_operacao === 'COMPRA' ? '#4338ca' : '#15803d',
                                borderRadius: 4,
                              }}
                            >
                              {f.tipo_documento}
                            </span>
                            <span className="fw-700 color-dark">{f.numero_factura}</span>
                          </div>
                          {f.hash_agt && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              Hash AGT: <code>{f.hash_agt}</code>
                            </div>
                          )}
                        </td>

                        {/* Data Emissão */}
                        <td className="px-15 py-12">
                          <span className="text-nowrap">{f.data_emissao ? f.data_emissao.split('-').reverse().join('/') : '---'}</span>
                          {f.mes && f.ano && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              Período: {f.mes}/{f.ano}
                            </div>
                          )}
                        </td>

                        {/* Fornecedor & NIF */}
                        <td className="px-15 py-12" style={{ maxWidth: 240 }}>
                          <div className="fw-600 text-truncate color-dark" title={f.fornecedor_nome}>
                            {f.fornecedor_nome || 'Não identificado'}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            NIF: <span className="fw-600">{f.fornecedor_nif || 'Sem NIF'}</span>
                          </div>
                        </td>

                        {/* Base Incidência */}
                        <td className="px-15 py-12 text-end fw-600">{formatarKz(f.base_incidencia)}</td>

                        {/* IVA e Taxa */}
                        <td className="px-15 py-12 text-end">
                          <div className="fw-600 text-primary">{formatarKz(f.valor_iva)}</div>
                          <small className="text-muted" style={{ fontSize: 10.5 }}>
                            Taxa: {Number(f.taxa_iva)}% {f.iva_dedutivel ? '(Dedutível)' : '(Não dedutível)'}
                          </small>
                        </td>

                        {/* Retenções */}
                        <td className="px-15 py-12 text-end">
                          {Number(f.retencao_iva) > 0 || Number(f.retencao_ii) > 0 ? (
                            <div>
                              <span className="fw-600 text-warning">
                                {formatarKz(Number(f.retencao_iva) + Number(f.retencao_ii))}
                              </span>
                              <div className="text-muted" style={{ fontSize: 10 }}>
                                {Number(f.retencao_iva) > 0 ? `IVA 7%: ${formatarKz(f.retencao_iva)}` : ''}
                                {Number(f.retencao_ii) > 0 ? ` II 6.5%: ${formatarKz(f.retencao_ii)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">---</span>
                          )}
                        </td>

                        {/* Total Líquido */}
                        <td className="px-15 py-12 text-end">
                          <span className="fw-700 color-dark">{formatarKz(f.valor_liquido || f.valor_total)}</span>
                        </td>

                        {/* Conformidade AGT */}
                        <td className="px-15 py-12 text-center">
                          <span
                            className="badge py-4 px-8 text-nowrap"
                            style={{
                              backgroundColor: badgeConformidade.bg,
                              color: badgeConformidade.text,
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <i className={`la ${badgeConformidade.icon} mr-3`}></i>
                            {badgeConformidade.label}
                          </span>
                        </td>

                        {/* Estado no Diário PGC */}
                        <td className="px-15 py-12 text-center">
                          {f.lancado_na_contabilidade ? (
                            <span className="badge badge-success py-4 px-8" style={{ borderRadius: 12, fontSize: 11 }}>
                              <i className="la la-check mr-3"></i> Lançado {f.lancamento_numero ? `(${f.lancamento_numero})` : ''}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs py-2 px-8"
                              onClick={() => handleLancarNoDiario(f)}
                              disabled={lancandoId === f.id}
                              style={{ borderRadius: 12, fontSize: 11 }}
                              title="Criar lançamento automático no Livro Diário de Compras"
                            >
                              <i className={`la ${lancandoId === f.id ? 'la-spinner la-spin' : 'la-book'} mr-3`}></i>
                              {lancandoId === f.id ? 'A Lançar...' : 'Lançar'}
                            </button>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-15 py-12 text-center text-nowrap">
                          <button
                            type="button"
                            className="btn btn-icon btn-light btn-sm mr-6"
                            onClick={() => setFacturaDetalhe(f)}
                            title="Ver análise completa da IA e dados fiscais"
                            style={{ width: 32, height: 32, borderRadius: 6 }}
                          >
                            <i className="la la-eye text-primary"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon btn-light btn-sm"
                            onClick={() => setFacturaApagar(f)}
                            title="Eliminar fatura"
                            style={{ width: 32, height: 32, borderRadius: 6 }}
                          >
                            <i className="la la-trash text-danger"></i>
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
      </div>

      {/* 6. MODAL DE DETALHE & AUDITORIA DA FACTURA (IA) */}
      {facturaDetalhe && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.70)',
            zIndex: 10050,
            overflowY: 'auto',
            paddingTop: 85,
            paddingBottom: 40,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFacturaDetalhe(null);
          }}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-scrollable"
            role="document"
            style={{ maxWidth: 880, margin: '0 auto' }}
          >
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div
                className="modal-header py-16 px-24 border-bottom d-flex align-items-center justify-content-between"
                style={{ background: '#ffffff' }}
              >
                <div className="d-flex align-items-center gap-12">
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <i className="la la-receipt"></i>
                  </span>
                  <div>
                    <h5 className="modal-title fw-700 mb-2 color-dark" style={{ fontSize: 16.5, lineHeight: 1.2 }}>
                      Auditoria Fiscal da Factura: {facturaDetalhe.numero_factura}
                    </h5>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      Data de Emissão: <span className="fw-600 color-dark">{facturaDetalhe.data_emissao ? facturaDetalhe.data_emissao.split('-').reverse().join('/') : '---'}</span>
                      {' • '}Período Contabilístico: <span className="fw-600 color-dark">{facturaDetalhe.mes}/{facturaDetalhe.ano}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-light btn-sm"
                  onClick={() => setFacturaDetalhe(null)}
                  aria-label="Close"
                  style={{ width: 34, height: 34, borderRadius: '50%', fontSize: 20, lineHeight: 1 }}
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>

              <div className="modal-body p-20">
                {/* Alertas Fiscais AGT */}
                {facturaDetalhe.alertas_auditoria && facturaDetalhe.alertas_auditoria.length > 0 && (
                  <div className="mb-20">
                    <h6 className="fw-700 mb-10 text-warning" style={{ fontSize: 13 }}>
                      <i className="la la-shield-alt mr-6"></i> Alertas de Conformidade & Riscos Fiscais da AGT:
                    </h6>
                    <div className="d-flex flex-column gap-6">
                      {facturaDetalhe.alertas_auditoria.map((alerta, i) => (
                        <div
                          key={i}
                          className="alert alert-warning py-8 px-12 mb-0 d-flex align-items-center gap-8"
                          style={{ fontSize: 12, borderRadius: 8 }}
                        >
                          <i className="la la-exclamation-triangle text-warning" style={{ fontSize: 16 }}></i>
                          <span>{alerta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dados das Partes */}
                <div className="row mb-20">
                  <div className="col-md-6 mb-12 mb-md-0">
                    <div className="p-12 border rounded bg-light" style={{ borderRadius: 10 }}>
                      <span className="text-muted fw-700" style={{ fontSize: 11 }}>
                        FORNECEDOR / EMISSOR
                      </span>
                      <h6 className="fw-700 mt-4 mb-2 color-dark">{facturaDetalhe.fornecedor_nome || 'Não especificado'}</h6>
                      <div style={{ fontSize: 12 }}>
                        NIF: <span className="fw-700">{facturaDetalhe.fornecedor_nif || '---'}</span>
                      </div>
                      {facturaDetalhe.fornecedor_endereco && (
                        <div className="text-muted mt-2" style={{ fontSize: 11.5 }}>
                          {facturaDetalhe.fornecedor_endereco}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="p-12 border rounded bg-light" style={{ borderRadius: 10 }}>
                      <span className="text-muted fw-700" style={{ fontSize: 11 }}>
                        CLIENTE / ADQUIRENTE
                      </span>
                      <h6 className="fw-700 mt-4 mb-2 color-dark">{facturaDetalhe.cliente_nome || 'Não especificado'}</h6>
                      <div style={{ fontSize: 12 }}>
                        NIF: <span className="fw-700">{facturaDetalhe.cliente_nif || '---'}</span>
                      </div>
                      <div className="mt-2" style={{ fontSize: 11.5 }}>
                        {empresaAtual && empresaAtual.nif === facturaDetalhe.cliente_nif ? (
                          <div>
                            <span className="text-success fw-600 d-block">
                              <i className="la la-check-circle mr-3"></i> NIF ({facturaDetalhe.cliente_nif}) coincide com a empresa ativa
                            </span>
                            {facturaDetalhe.cliente_nome &&
                              empresaAtual.nome &&
                              !empresaAtual.nome.toLowerCase().includes(facturaDetalhe.cliente_nome.toLowerCase().slice(0, 6)) && (
                                <span className="text-warning fw-600 d-block mt-4" style={{ fontSize: 11 }}>
                                  <i className="la la-info-circle mr-3"></i> <strong>Atenção:</strong> Razão social na fatura ({facturaDetalhe.cliente_nome}) difere do nome cadastrado ({empresaAtual.nome}).
                                </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-danger fw-600">
                            <i className="la la-times-circle mr-3"></i> NIF difere da empresa ativa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Valores Fiscais */}
                <div className="card mb-20 border" style={{ borderRadius: 10 }}>
                  <div className="card-header bg-white py-10 px-15 border-bottom">
                    <h6 className="fw-700 mb-0" style={{ fontSize: 12.5 }}>
                      <i className="la la-calculator text-primary mr-6"></i> Decomposição Financeira & Apuramento do IVA
                    </h6>
                  </div>
                  <div className="card-body p-15">
                    <div className="row text-center">
                      <div className="col-md-3 col-6 mb-10">
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Base de Incidência
                        </span>
                        <div className="fw-700 color-dark mt-2">{formatarKz(facturaDetalhe.base_incidencia)}</div>
                      </div>
                      <div className="col-md-3 col-6 mb-10">
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          IVA ({Number(facturaDetalhe.taxa_iva)}%)
                        </span>
                        <div className="fw-700 text-primary mt-2">{formatarKz(facturaDetalhe.valor_iva)}</div>
                        <small className="badge badge-light" style={{ fontSize: 10 }}>
                          {facturaDetalhe.iva_dedutivel ? 'Dedutível' : 'Excluído de Dedução'}
                        </small>
                      </div>
                      <div className="col-md-3 col-6 mb-10">
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Retenção 7% IVA
                        </span>
                        <div className="fw-700 text-warning mt-2">{formatarKz(facturaDetalhe.retencao_iva)}</div>
                      </div>
                      <div className="col-md-3 col-6 mb-10">
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Retenção 6.5% II
                        </span>
                        <div className="fw-700 text-warning mt-2">{formatarKz(facturaDetalhe.retencao_ii)}</div>
                      </div>
                    </div>
                    <hr className="my-10" />
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className="text-muted" style={{ fontSize: 11.5 }}>
                          Total Bruto da Fatura:
                        </span>{' '}
                        <strong className="color-dark">{formatarKz(facturaDetalhe.valor_total)}</strong>
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: 11.5 }}>
                          Total Líquido a Pagar:
                        </span>{' '}
                        <strong className="text-success" style={{ fontSize: 15 }}>
                          {formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regras e Certificação AGT */}
                <div className="p-12 border rounded mb-20" style={{ background: '#f8fafc', borderRadius: 10 }}>
                  <h6 className="fw-700 mb-8" style={{ fontSize: 12.5 }}>
                    <i className="la la-stamp text-info mr-6"></i> Requisitos Legais da AGT (Decreto Presidencial 292/18)
                  </h6>
                  <div className="row" style={{ fontSize: 12 }}>
                    <div className="col-md-7 mb-6">
                      <span className="text-muted">Software Certificado:</span>{' '}
                      <strong>{facturaDetalhe.software_certificacao || 'Não detetado'}</strong>
                    </div>
                    <div className="col-md-5 mb-6">
                      <span className="text-muted">Hash de 4 Caracteres:</span>{' '}
                      <code>{facturaDetalhe.hash_agt || 'Não detetado'}</code>
                    </div>
                  </div>
                </div>

                {/* Classificação Sugerida do PGC */}
                <div className="p-12 border rounded" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', borderRadius: 10 }}>
                  <h6 className="fw-700 mb-8 text-success" style={{ fontSize: 12.5 }}>
                    <i className="la la-book mr-6"></i> Sugestão de Contabilização no PGC (Partidas Dobradas)
                  </h6>
                  <ul className="mb-0 pl-20" style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <li>
                      <strong>Débito Conta {facturaDetalhe.conta_custo_sugerida}:</strong> {facturaDetalhe.conta_custo_nome} (
                      {formatarKz(facturaDetalhe.base_incidencia)})
                    </li>
                    {facturaDetalhe.iva_dedutivel && Number(facturaDetalhe.valor_iva) > 0 && (
                      <li>
                        <strong>Débito Conta {facturaDetalhe.conta_iva_sugerida}:</strong> {facturaDetalhe.conta_iva_nome} (
                        {formatarKz(facturaDetalhe.valor_iva)})
                      </li>
                    )}
                    {Number(facturaDetalhe.retencao_iva) > 0 && (
                      <li>
                        <strong>Crédito Conta 34.2.2:</strong> Retenção na Fonte de IVA 7% ({formatarKz(facturaDetalhe.retencao_iva)})
                      </li>
                    )}
                    {Number(facturaDetalhe.retencao_ii) > 0 && (
                      <li>
                        <strong>Crédito Conta 34.2.1:</strong> Retenção de Imposto Industrial 6.5% ({formatarKz(facturaDetalhe.retencao_ii)})
                      </li>
                    )}
                    <li>
                      <strong>Crédito Conta {facturaDetalhe.conta_terceiro_sugerida}:</strong> {facturaDetalhe.conta_terceiro_nome} (
                      {formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)})
                    </li>
                  </ul>
                </div>
              </div>

              <div className="modal-footer py-14 px-24 bg-light border-top d-flex justify-content-between align-items-center">
                <button
                  type="button"
                  className="btn btn-sm d-flex align-items-center gap-6"
                  onClick={() => {
                    const toDelete = facturaDetalhe;
                    setFacturaDetalhe(null);
                    setFacturaApagar(toDelete);
                  }}
                  style={{
                    borderRadius: 8,
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontWeight: 600,
                    padding: '6px 14px',
                  }}
                >
                  <i className="la la-trash" style={{ fontSize: 15 }}></i> Eliminar Fatura
                </button>

                <div className="d-flex gap-8">
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => setFacturaDetalhe(null)}
                    style={{ borderRadius: 8 }}
                  >
                    Fechar
                  </button>
                  {!facturaDetalhe.lancado_na_contabilidade && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm d-flex align-items-center gap-6"
                      onClick={() => handleLancarNoDiario(facturaDetalhe)}
                      disabled={lancandoId === facturaDetalhe.id}
                      style={{ borderRadius: 8 }}
                    >
                      <i className={`la ${lancandoId === facturaDetalhe.id ? 'la-spinner la-spin' : 'la-check-double'}`}></i>
                      {lancandoId === facturaDetalhe.id ? 'A Escriturar...' : 'Lançar no Diário de Compras'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO */}
      <ConfirmModal
        show={Boolean(facturaApagar)}
        title="Eliminar Registo de Factura"
        confirmLabel="Sim, Eliminar"
        confirmClass="btn-danger"
        onConfirm={handleConfirmarExclusao}
        onClose={() => setFacturaApagar(null)}
      >
        <p className="mb-0">
          Tem a certeza que deseja eliminar a fatura{' '}
          <strong>{facturaApagar?.numero_factura}</strong> do fornecedor{' '}
          <strong>{facturaApagar?.fornecedor_nome || 'desconhecido'}</strong>? Esta ação não pode ser revertida.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default Facturas;
