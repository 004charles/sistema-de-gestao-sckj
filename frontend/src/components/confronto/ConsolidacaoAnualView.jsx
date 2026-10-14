import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { consolidacaoService } from '../../services/api';

const SpinDots = () => (
  <span className="atbd-spin-dots spin-lg">
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
    <span className="spin-dot badge-dot dot-primary"></span>
  </span>
);

const ConsolidacaoAnualView = ({ empresaId, anoPadrao, empresaAtual }) => {
  const [ano, setAno] = useState(anoPadrao || 2024);
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const carregarConsolidacao = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      const res = await consolidacaoService.getConsolidacao(empresaId, ano);
      setDados(res.data);
    } catch (err) {
      console.error('Erro ao carregar consolidação anual:', err);
      toast.error('Não foi possível carregar os dados de consolidação anual.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId, ano]);

  useEffect(() => {
    carregarConsolidacao();
  }, [carregarConsolidacao]);

  const handleExportarExcel = async () => {
    if (!empresaId) return;
    setExportandoExcel(true);
    try {
      const res = await consolidacaoService.exportarExcel(empresaId, ano);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Consolidacao_Anual_Fiscal_${empresaAtual?.nif || 'AGT'}_${ano}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Folha de cálculo Excel da Consolidação Anual descarregada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel anual:', err);
      toast.error('Erro ao gerar o ficheiro Excel da consolidação anual.');
    } finally {
      setExportandoExcel(false);
    }
  };

  const formatarKz = (valor) => {
    if (valor === undefined || valor === null) return '0,00 Kz';
    return Number(valor).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
  };

  return (
    <div>
      {/* SELETOR DE ANO E AÇÕES */}
      <div className="card card-default mb-20 no-print" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
        <div className="card-body py-15 px-20">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 15 }}>
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 12 }}>
              <span className="fw-600 color-dark" style={{ fontSize: 13.5 }}>
                <i className="la la-calendar text-primary mr-1"></i> Exercício Fiscal:
              </span>
              <select
                className="form-control form-control-default"
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                style={{ width: 110, height: 38, fontSize: 13, fontWeight: 600 }}
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
              </select>

              <button
                type="button"
                className="btn btn-outline-lighten btn-sm bg-white"
                onClick={carregarConsolidacao}
                disabled={carregando}
                style={{ height: 38, border: '1px solid #dcdfe5', fontWeight: 600 }}
              >
                <i className={`la ${carregando ? 'la-spinner la-spin' : 'la-sync'} mr-1`}></i> Atualizar
              </button>
            </div>

            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline-success btn-sm bg-white"
                onClick={handleExportarExcel}
                disabled={exportandoExcel || !dados}
                style={{ height: 38, border: '1px solid #28a745', fontWeight: 600 }}
              >
                <i className={`la ${exportandoExcel ? 'la-spinner la-spin' : 'la-file-excel'} mr-1 text-success`}></i>
                {exportandoExcel ? 'A gerar...' : 'Exportar Excel Anual (.xlsx)'}
              </button>

              <button
                type="button"
                className="btn btn-outline-lighten btn-sm bg-white"
                onClick={() => window.print()}
                disabled={!dados}
                style={{ height: 38, border: '1px solid #dcdfe5', fontWeight: 600 }}
              >
                <i className="la la-print mr-1 text-primary"></i> Imprimir / PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="card card-default text-center py-50 mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
          <SpinDots />
          <h5 className="fw-700 color-dark mt-20 mb-5">A consolidar os 12 meses de IVA e Balancete de Fecho...</h5>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            A apurar o volume de negócios acumulado, reconciliação de deduções e preparação do Modelo 1 do Imposto Industrial.
          </p>
        </div>
      )}

      {!carregando && dados && (
        <>
          {/* CABEÇALHO TIMBRADO PARA IMPRESSÃO */}
          <div className="print-only mb-25 pb-15 border-bottom" style={{ borderBottom: '2px solid #1a3353' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a3353', margin: 0, textTransform: 'uppercase' }}>
                  {empresaAtual?.nome || dados.empresa?.nome}
                </h2>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                  <strong>NIF:</strong> {empresaAtual?.nif || dados.empresa?.nif} &nbsp;|&nbsp; <strong>Regime:</strong> {empresaAtual?.regime_iva || dados.empresa?.regime_iva}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1a3353' }}>
                  CONSOLIDAÇÃO ANUAL & FECHO FISCAL (12 MESES)
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  Exercício: <strong>{dados.ano}</strong> &nbsp;|&nbsp; Emissão: {new Date().toLocaleDateString('pt-PT')}
                </div>
              </div>
            </div>
          </div>

          {/* 1. KPIS ANUAIS */}
          <div className="row mb-20" style={{ rowGap: 12 }}>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100">
                <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  VOLUME NEGÓCIOS IVA (12M)
                </span>
                <div className="fw-700 color-primary" style={{ fontSize: 20 }}>
                  {formatarKz(dados.totais_iva.volume_negocios)}
                </div>
                <span className="text-muted" style={{ fontSize: 11.5 }}>
                  {dados.meses_declarados_count} de 12 meses declarados
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100">
                <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  PROVEITOS CONTABILIDADE
                </span>
                <div className="fw-700 color-dark" style={{ fontSize: 20 }}>
                  {formatarKz(dados.balancete_fecho.volume_negocios_contab)}
                </div>
                <span className="text-muted" style={{ fontSize: 11.5 }}>
                  Balancete de Fecho (Classe 6)
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100">
                <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  DIFERENÇA ANUAL APURADA
                </span>
                <div
                  className={`fw-700 ${dados.confronto_anual.status_volume === 'IGUAIS' ? 'color-success' : 'color-danger'}`}
                  style={{ fontSize: 20 }}
                >
                  {formatarKz(dados.confronto_anual.diff_volume_negocios)}
                </div>
                <span className={dados.confronto_anual.status_volume === 'IGUAIS' ? 'text-success fw-600' : 'text-danger fw-600'} style={{ fontSize: 11.5 }}>
                  {dados.confronto_anual.status_volume === 'IGUAIS' ? '✓ Coincidência Integral' : '⚠️ Divergência Fiscal'}
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100">
                <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                  ESTIMATIVA IMPOSTO INDUSTRIAL
                </span>
                <div className="fw-700 color-dark" style={{ fontSize: 20 }}>
                  {formatarKz(dados.confronto_anual.estimativa_imposto_industrial)}
                </div>
                <span className="text-muted" style={{ fontSize: 11.5 }}>
                  Taxa 25% | Entrega até {dados.confronto_anual.prazo_modelo1}
                </span>
              </div>
            </div>
          </div>

          {/* ALERTA DE MESES EM FALTA */}
          {dados.meses_em_falta && dados.meses_em_falta.length > 0 && (
            <div className="alert alert-warning mb-20 p-15" role="alert" style={{ borderRadius: 8 }}>
              <div className="d-flex align-items-center">
                <i className="la la-exclamation-triangle mr-8" style={{ fontSize: 20 }}></i>
                <div>
                  <strong>Atenção: Existem meses sem Declaração Modelo 7 no sistema!</strong>
                  <div style={{ fontSize: 12.5 }} className="mt-1">
                    Meses em falta para o exercício {dados.ano}:{' '}
                    <strong>{dados.meses_em_falta.map((m) => `Mês ${m}`).join(', ')}</strong>.
                    Carregue as declarações em falta no Arquivo para garantir que o acumulado anual seja 100% fidedigno.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. QUADRO COMPARATIVO ANUAL */}
          <div className="card card-default mb-25" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-header py-12 px-20 bg-light border-bottom">
              <strong className="color-dark" style={{ fontSize: 14 }}>
                <i className="la la-balance-scale text-primary mr-5"></i> 1. Quadro Comparativo Anual: Contabilidade vs AGT
              </strong>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ width: '35%', fontWeight: 700 }}>Rubrica Fiscal / Base</th>
                      <th style={{ width: '22%', fontWeight: 700 }}>Contabilidade (Balancete de Fecho)</th>
                      <th style={{ width: '22%', fontWeight: 700 }}>AGT (Soma 12 Modelos 7)</th>
                      <th style={{ width: '11%', fontWeight: 700, textAlign: 'center' }}>Status</th>
                      <th style={{ width: '10%', fontWeight: 700, textAlign: 'right' }}>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        Volume de Negócios Anual (Vendas / Prestações de Serviços)
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.balancete_fecho.volume_negocios_contab)}
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.totais_iva.volume_negocios)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <span className={dados.confronto_anual.status_volume === 'IGUAIS' ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                          <i className={dados.confronto_anual.status_volume === 'IGUAIS' ? 'la la-check' : 'la la-exclamation-triangle'}></i>
                          {dados.confronto_anual.status_volume}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, color: dados.confronto_anual.status_volume === 'IGUAIS' ? '#00a854' : '#f5222d' }}>
                        {formatarKz(dados.confronto_anual.diff_volume_negocios)}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        IVA Liquidado Anual (Conta 34.5.3 vs Campo 33 Modelo 7)
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.balancete_fecho.iva_liquidado_3453)}
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.totais_iva.iva_liquidado)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <span className={Math.abs(dados.balancete_fecho.iva_liquidado_3453 - dados.totais_iva.iva_liquidado) < 100 ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                          {Math.abs(dados.balancete_fecho.iva_liquidado_3453 - dados.totais_iva.iva_liquidado) < 100 ? 'IGUAIS' : 'DIFERENÇA'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 700 }}>
                        {formatarKz(dados.balancete_fecho.iva_liquidado_3453 - dados.totais_iva.iva_liquidado)}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        IVA Dedutível Anual (Conta 34.5.2 vs Campo 32 Modelo 7)
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.balancete_fecho.iva_dedutivel_3452)}
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                        {formatarKz(dados.totais_iva.iva_dedutivel)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <span className={Math.abs(dados.balancete_fecho.iva_dedutivel_3452 - dados.totais_iva.iva_dedutivel) < 100 ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                          {Math.abs(dados.balancete_fecho.iva_dedutivel_3452 - dados.totais_iva.iva_dedutivel) < 100 ? 'IGUAIS' : 'DIFERENÇA'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 700 }}>
                        {formatarKz(dados.balancete_fecho.iva_dedutivel_3452 - dados.totais_iva.iva_dedutivel)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. MAPA MENSAL DOS 12 MESES */}
          <div className="card card-default mb-25" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-header py-12 px-20 bg-light border-bottom">
              <div className="d-flex justify-content-between align-items-center w-100 flex-wrap" style={{ gap: 8 }}>
                <strong className="color-dark" style={{ fontSize: 14 }}>
                  <i className="la la-table text-primary mr-5"></i> 2. Mapa Detalhado Mês a Mês do Exercício {dados.ano} (Modelo 7)
                </strong>
                <span className="badge badge-light" style={{ fontSize: 12 }}>
                  Total Declarado: <strong>{formatarKz(dados.totais_iva.volume_negocios)}</strong>
                </span>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: 12.5 }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ width: '12%', fontWeight: 700 }}>Mês</th>
                      <th style={{ width: '12%', fontWeight: 700 }}>Estado</th>
                      <th style={{ width: '16%', fontWeight: 700 }}>Nº Declaração</th>
                      <th style={{ width: '16%', fontWeight: 700, textAlign: 'right' }}>Vol. Negócios (Kz)</th>
                      <th style={{ width: '15%', fontWeight: 700, textAlign: 'right' }}>IVA Liquidado (Kz)</th>
                      <th style={{ width: '15%', fontWeight: 700, textAlign: 'right' }}>IVA Dedutível (Kz)</th>
                      <th style={{ width: '14%', fontWeight: 700, textAlign: 'right' }}>IVA a Pagar (Kz)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.mapa_mensal.map((m) => {
                      const isFalta = m.estado === 'EM_FALTA';
                      return (
                        <tr key={m.mes} style={{ backgroundColor: isFalta ? '#fffdf7' : 'transparent' }}>
                          <td style={{ verticalAlign: 'middle', fontWeight: 700 }}>
                            {m.mes_nome} ({String(m.mes).padStart(2, '0')}/{dados.ano})
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <span className={isFalta ? 'badge badge-warning' : 'badge badge-success'} style={{ fontSize: 11 }}>
                              {isFalta ? 'Em Falta' : 'Declarado'}
                            </span>
                          </td>
                          <td style={{ verticalAlign: 'middle', color: isFalta ? '#999' : '#333' }}>
                            {m.numero_declaracao}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 600 }}>
                            {formatarKz(m.volume_negocios)}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                            {formatarKz(m.iva_liquidado)}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                            {formatarKz(m.iva_dedutivel)}
                          </td>
                          <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 600, color: m.iva_a_pagar > 0 ? '#1a3353' : '#666' }}>
                            {formatarKz(m.iva_a_pagar)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ backgroundColor: '#f4f6f9', fontWeight: 700, fontSize: 13 }}>
                    <tr>
                      <td colSpan={3} style={{ verticalAlign: 'middle' }}>
                        TOTAL ACUMULADO DOS 12 MESES
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', color: '#1a3353' }}>
                        {formatarKz(dados.totais_iva.volume_negocios)}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', color: '#1a3353' }}>
                        {formatarKz(dados.totais_iva.iva_liquidado)}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', color: '#1a3353' }}>
                        {formatarKz(dados.totais_iva.iva_dedutivel)}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', color: '#1a3353' }}>
                        {formatarKz(dados.totais_iva.iva_a_pagar)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* 4. DIAGNÓSTICO FISCAL & PREPARAÇÃO MODELO 1 */}
          <div className="row mb-25">
            <div className="col-12 col-lg-7">
              <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                <div className="card-header py-12 px-20 bg-light border-bottom">
                  <strong className="color-dark" style={{ fontSize: 14 }}>
                    <i className="la la-stethoscope text-primary mr-5"></i> 3. Diagnóstico Técnico de Fecho de Contas
                  </strong>
                </div>
                <div className="card-body p-20">
                  {dados.divergencias.map((dif, idx) => (
                    <div
                      key={idx}
                      className={dif.tipo_risco === 'CONFORME' ? 'diff-box-ok' : 'diff-box'}
                    >
                      <strong className={dif.tipo_risco === 'CONFORME' ? 'text-success d-block mb-1' : 'text-danger d-block mb-1'} style={{ fontSize: 13.5 }}>
                        <i className={dif.tipo_risco === 'CONFORME' ? 'la la-check-circle mr-1' : 'la la-exclamation-triangle mr-1'}></i>
                        {dif.rubrica}
                      </strong>
                      <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
                        {dif.descricao}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                <div className="card-header py-12 px-20 bg-light border-bottom">
                  <strong className="color-dark" style={{ fontSize: 14 }}>
                    <i className="la la-file-invoice-dollar text-primary mr-5"></i> 4. Suporte à Declaração Modelo 1 (II)
                  </strong>
                </div>
                <div className="card-body p-20">
                  <div className="mb-15 p-12 bg-light rounded" style={{ border: '1px solid #e2e8f0' }}>
                    <span className="fw-700 color-primary d-block mb-4" style={{ fontSize: 12 }}>
                      QUADRO 05 — PROVEITOS OPERACIONAIS (MODELO 1)
                    </span>
                    <div className="fw-700 color-dark" style={{ fontSize: 18 }}>
                      {formatarKz(dados.balancete_fecho.volume_negocios_contab)}
                    </div>
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      Valor coincidente a inscrever na Declaração Anual de Rendimentos
                    </span>
                  </div>

                  <div className="mb-15">
                    <strong className="d-block mb-1" style={{ fontSize: 12.5 }}>
                      Prazo Legal de Submissão:
                    </strong>
                    <span className="badge badge-primary" style={{ fontSize: 12, padding: '5px 10px' }}>
                      <i className="la la-calendar-check mr-1"></i> {dados.confronto_anual.prazo_modelo1} (Art. 52.º CII)
                    </span>
                  </div>

                  <p className="text-muted mb-0" style={{ fontSize: 12 }}>
                    A conciliação prévia dos 12 meses de IVA com a Contabilidade elimina o risco de notificação automática por divergência de faturação entre o SIGFE/AGT e a Declaração de Rendimentos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. BLOCO DE ASSINATURAS OFICIAIS (IMPRESSÃO / PDF) */}
          <div className="print-only mt-40 pt-20" style={{ pageBreakInside: 'avoid', borderTop: '1px solid #cbd5e1' }}>
            <div className="row" style={{ marginTop: 20 }}>
              <div className="col-6 text-center">
                <div style={{ borderTop: '1px solid #1a3353', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                  <strong style={{ fontSize: 12, display: 'block', color: '#1a3353' }}>
                    O CONTABILISTA CERTIFICADO
                  </strong>
                  <span style={{ fontSize: 10.5, color: '#555', display: 'block' }}>
                    Ordem dos Contabilistas e Peritos Contabilistas de Angola (OCPCA)
                  </span>
                  <span style={{ fontSize: 10, color: '#777', display: 'block', marginTop: 4 }}>
                    Cédula Profissional N.º: ___________________________
                  </span>
                </div>
              </div>

              <div className="col-6 text-center">
                <div style={{ borderTop: '1px solid #1a3353', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                  <strong style={{ fontSize: 12, display: 'block', color: '#1a3353' }}>
                    A GERÊNCIA / CONSELHO DE ADMINISTRAÇÃO
                  </strong>
                  <span style={{ fontSize: 10.5, color: '#555', display: 'block' }}>
                    {empresaAtual?.nome || dados.empresa?.nome}
                  </span>
                  <span style={{ fontSize: 10, color: '#777', display: 'block', marginTop: 4 }}>
                    (Assinatura e Carimbo Oficial)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mt-30" style={{ fontSize: 9.5, color: '#888' }}>
              Documento emitido eletronicamente pela Plataforma de Reconciliação Contabilística & Fiscal de Angola — Cópia autêntica para integração no Dossier Fiscal da Empresa.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsolidacaoAnualView;
