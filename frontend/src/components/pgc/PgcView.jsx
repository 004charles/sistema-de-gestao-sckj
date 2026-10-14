import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { pgcService } from '../../services/api';

const CLASSES_PGC = [
  { id: 'TODAS', nome: 'Todas as Classes' },
  { id: '1', nome: '1 - Meios Fixos' },
  { id: '2', nome: '2 - Existências' },
  { id: '3', nome: '3 - Terceiros' },
  { id: '4', nome: '4 - Meios Monetários' },
  { id: '5', nome: '5 - Capital & Reservas' },
  { id: '6', nome: '6 - Proveitos (Vendas)' },
  { id: '7', nome: '7 - Custos (Gastos)' },
  { id: '8', nome: '8 - Resultados' },
];

const PgcView = () => {
  const { t } = useTranslation();

  const [pgcDados, setPgcDados] = useState({
    classes: [],
    contas: [],
    total: 0,
    total_oficial: 0,
    principios: [],
    criterios_valorimetria: [],
    demonstracoes_financeiras: null,
    notas_anexo: [],
    diploma_legal: null,
  });
  const [filtroClassePgc, setFiltroClassePgc] = useState('TODAS');
  const [pesquisaPgc, setPesquisaPgc] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('contas'); // 'contas' | 'principios' | 'demonstracoes'
  const [contaDetalhe, setContaDetalhe] = useState(null);
  const [tipoDemonstracao, setTipoDemonstracao] = useState('balanco');
  const [baixandoExcelPgc, setBaixandoExcelPgc] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregarPgc = async (classe = 'TODAS', termo = '') => {
    try {
      setCarregando(true);
      const params = {};
      if (classe && classe !== 'TODAS') params.classe = classe;
      if (termo && termo.trim()) params.pesquisa = termo.trim();
      const res = await pgcService.getPgc(params);
      setPgcDados(res.data);
    } catch {
      toast.error(t('admin.pgc.loadError', 'Erro ao carregar dados do Plano Geral de Contabilidade.'));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPgc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baixarPgcExcel = async () => {
    setBaixandoExcelPgc(true);
    try {
      const res = await pgcService.exportarPgcExcel();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Plano_Geral_Contabilidade_Angola_Decreto_82_01.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('admin.pgc.exportExcelSuccess', 'Download do PGC em Excel (.xlsx) concluído com sucesso!'));
    } catch {
      toast.error(t('admin.pgc.exportExcelError', 'Erro ao transferir ficheiro Excel do PGC.'));
    } finally {
      setBaixandoExcelPgc(false);
    }
  };

  const imprimirPgcPdf = () => {
    window.print();
  };

  // Contas filtradas
  const contasExibidas = useMemo(() => {
    let lista = pgcDados.contas || [];
    if (filtroClassePgc !== 'TODAS') {
      lista = lista.filter((c) => String(c.codigo).startsWith(filtroClassePgc));
    }
    if (pesquisaPgc.trim()) {
      const termo = pesquisaPgc.toLowerCase();
      lista = lista.filter(
        (c) =>
          String(c.codigo).toLowerCase().includes(termo) ||
          String(c.nome || '').toLowerCase().includes(termo) ||
          String(c.debito_por || '').toLowerCase().includes(termo) ||
          String(c.credito_por || '').toLowerCase().includes(termo)
      );
    }
    return lista;
  }, [pgcDados.contas, filtroClassePgc, pesquisaPgc]);

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
        .class-filter-btn {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .class-filter-btn:hover {
          background: #f8faff;
          border-color: #5f63f2;
          color: #5f63f2;
        }
        .class-filter-btn.active {
          background: #5f63f2;
          color: #ffffff;
          border-color: #5f63f2;
        }
        `}
      </style>

      {/* CABEÇALHO DA PÁGINA (ESTILO CONFRONTO) */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-800 color-dark mb-4" style={{ fontSize: 22, color: '#1a3353' }}>
                <i className="la la-book text-primary mr-6"></i>{' '}
                {t('admin.pgc.title', 'Plano Geral de Contabilidade de Angola (PGC)')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                Decreto n.º 82/01 de 16 de Novembro · Catálogo oficial de contas, dinâmica de débito/crédito e demonstrações financeiras.
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-lighten bg-white"
                onClick={imprimirPgcPdf}
                style={{ fontWeight: 600, fontSize: 13, border: '1px solid #dcdfe5' }}
              >
                <i className="la la-print mr-4"></i> Imprimir / PDF
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={baixarPgcExcel}
                disabled={baixandoExcelPgc}
                style={{ fontWeight: 700, fontSize: 13, backgroundColor: '#5f63f2', borderColor: '#5f63f2' }}
              >
                <i className={`la ${baixandoExcelPgc ? 'la-spinner la-spin' : 'la-file-excel'} mr-4`}></i>
                {baixandoExcelPgc ? 'A gerar...' : 'Baixar PGC Completo em Excel (.xlsx)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FAIXA DE RESUMO INSTITUCIONAL */}
      <div className="card card-default mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10, background: '#fff' }}>
        <div className="card-body p-16">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
            <div className="d-flex align-items-center" style={{ gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: '#eef2ff',
                  color: '#5f63f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                <i className="la la-balance-scale"></i>
              </div>
              <div>
                <strong className="color-dark d-block" style={{ fontSize: 14 }}>
                  Decreto n.º 82/01 · Diário da República Iª Série, N.º 53
                </strong>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Enquadramento legal para todas as empresas em território angolano e conciliação com o Modelo 7 da AGT.
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <span className="badge badge-light border p-2" style={{ fontSize: 12, fontWeight: 700, color: '#1a3353' }}>
                <i className="la la-check-circle text-success mr-1"></i> 8 Classes Normalizadas
              </span>
              <span className="badge badge-light border p-2" style={{ fontSize: 12, fontWeight: 700, color: '#5f63f2' }}>
                <i className="la la-calculator mr-1"></i> SAF-T Angola
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CARDS KPIS NO FORMATO DO CONFRONTO */}
      <div className="row mb-20" style={{ rowGap: 12 }}>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #5f63f2' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Catálogo de Contas
            </span>
            <div className="fw-800 color-dark" style={{ fontSize: 24 }}>
              {contasExibidas.length}{' '}
              <span className="fs-13 text-muted fw-normal">contas</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Estrutura oficial Decreto 82/01
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #52c41a' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Meios Fixos & Existências
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#52c41a' }}>
              Classe 1 & 2
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Investimentos e stocks
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #1890ff' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Terceiros & Meios Monetários
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#1890ff' }}>
              Classe 3 & 4
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Estado (IVA Conta 34), Clientes e Caixa
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #fa8b0c' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Demonstração de Resultados
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#fa8b0c' }}>
              Classe 6, 7 & 8
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Vendas, custos e apuramento do lucro
            </span>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DE ABAS (ESTILO STEP-PILL DO CONFRONTO) */}
      <div className="d-flex align-items-center mb-20 flex-wrap" style={{ gap: 8 }}>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'contas' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('contas')}
        >
          <i className="la la-list-ol"></i> 1. Quadro de Contas & Dinâmica
        </button>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'principios' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('principios')}
        >
          <i className="la la-balance-scale"></i> 2. Princípios Contabilísticos
        </button>
        <button
          type="button"
          className={`step-pill ${abaAtiva === 'demonstracoes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('demonstracoes')}
        >
          <i className="la la-chart-bar"></i> 3. Demonstrações Oficiais (Balanço & DRN)
        </button>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: QUADRO DE CONTAS (PESQUISA, CLASSES 1-8 E TABELA)       */}
      {/* ============================================================== */}
      {abaAtiva === 'contas' && (
        <div>
          {/* BARRA DE PESQUISA E FILTROS DE CLASSES */}
          <div className="card card-default mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-16">
              <div className="row align-items-center mb-12">
                <div className="col-12 col-md-8">
                  <div className="input-group">
                    <span className="input-group-text bg-white border-right-0" style={{ border: '1px solid #dcdfe5' }}>
                      <i className="la la-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-left-0"
                      placeholder="Pesquisar conta por código (ex: 31, 34, 61, 71) ou descrição..."
                      value={pesquisaPgc}
                      onChange={(e) => setPesquisaPgc(e.target.value)}
                      style={{ height: 40, fontSize: 13.5 }}
                    />
                  </div>
                </div>
                <div className="col-12 col-md-4 text-md-right mt-10 mt-md-0">
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    A exibir <strong className="color-dark">{contasExibidas.length}</strong> contas
                  </span>
                </div>
              </div>

              {/* BARRAS DE CLASSES */}
              <div className="d-flex flex-wrap align-items-center" style={{ gap: 6 }}>
                {CLASSES_PGC.map((cItem) => {
                  const isActive = filtroClassePgc === cItem.id;
                  return (
                    <button
                      key={cItem.id}
                      type="button"
                      className={`class-filter-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setFiltroClassePgc(cItem.id)}
                    >
                      {cItem.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TABELA DE CONTAS COM ESTILO LIMPO */}
          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ width: 110, padding: '12px 18px', fontWeight: 700, color: '#495057' }}>Código</th>
                      <th style={{ width: 280, padding: '12px 18px', fontWeight: 700, color: '#495057' }}>Designação Oficial</th>
                      <th style={{ width: 100, padding: '12px 18px', fontWeight: 700, color: '#495057', textAlign: 'center' }}>Natureza</th>
                      <th style={{ minWidth: 230, padding: '12px 18px', fontWeight: 700, color: '#16a34a' }}>
                        <i className="la la-plus-circle mr-1"></i> Debita-se por...
                      </th>
                      <th style={{ minWidth: 230, padding: '12px 18px', fontWeight: 700, color: '#dc2626' }}>
                        <i className="la la-minus-circle mr-1"></i> Credita-se por...
                      </th>
                      <th style={{ width: 90, padding: '12px 18px', fontWeight: 700, color: '#495057', textAlign: 'center' }}>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carregando ? (
                      <tr>
                        <td colSpan="6" className="text-center py-40 text-muted">
                          <i className="la la-spinner la-spin mr-1"></i> A carregar catálogo de contas do PGC...
                        </td>
                      </tr>
                    ) : contasExibidas.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-40 text-muted">
                          <i className="la la-search text-muted mb-2 d-block" style={{ fontSize: 32 }}></i>
                          Nenhuma conta encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      contasExibidas.map((c) => {
                        const isEstado = String(c.codigo).startsWith('34');
                        return (
                          <tr
                            key={c.codigo}
                            onClick={() => setContaDetalhe(c)}
                            style={{ cursor: 'pointer', backgroundColor: isEstado ? 'rgba(95, 99, 242, 0.02)' : 'transparent' }}
                          >
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                  backgroundColor: isEstado ? '#eef2ff' : '#f1f5f9',
                                  color: isEstado ? '#5f63f2' : '#1e293b',
                                }}
                              >
                                {c.codigo}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                              <strong className="color-dark d-block" style={{ fontSize: 13.5 }}>
                                {c.nome}
                              </strong>
                              <span className="text-muted" style={{ fontSize: 11.5 }}>
                                {c.classe_nome}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                              <span
                                className={`badge ${
                                  c.natureza === 'Devedora'
                                    ? 'badge-success'
                                    : c.natureza === 'Credora'
                                    ? 'badge-warning'
                                    : 'badge-light border'
                                }`}
                                style={{ fontSize: 11 }}
                              >
                                {c.natureza || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', color: '#15803d', fontSize: 12.5 }}>
                              {c.debito_por || 'Acréscimos patrimoniais e direitos'}
                            </td>
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', color: '#b91c1c', fontSize: 12.5 }}>
                              {c.credito_por || 'Diminuições patrimoniais e obrigações'}
                            </td>
                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContaDetalhe(c);
                                }}
                                style={{ borderRadius: 6, fontWeight: 700, padding: '3px 8px' }}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: PRINCÍPIOS CONTABILÍSTICOS & VALORIMETRIA               */}
      {/* ============================================================== */}
      {abaAtiva === 'principios' && (
        <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
          <div className="card-header bg-white py-14 px-20 border-bottom">
            <h5 className="fw-700 text-dark mb-0">
              Princípios Contabilísticos Fundamentais (Decreto n.º 82/01)
            </h5>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              Pilares oficiais que regem a elaboração das contas e das declarações fiscais em Angola
            </span>
          </div>
          <div className="card-body p-20">
            <div className="row" style={{ rowGap: 16 }}>
              {(pgcDados.principios || [
                { codigo: '1', nome: 'Continuidade', conceito: 'Considera-se que a empresa opera continuadamente com duração ilimitada.', exemplo: 'Avaliação de ativos a valor de exploração e não de liquidação imediata.' },
                { codigo: '2', nome: 'Consistência', conceito: 'Não se alteram as políticas contabilísticas de um exercício para o outro sem justificação expressa.', exemplo: 'Manutenção do método de depreciação de viaturas e equipamentos.' },
                { codigo: '3', nome: 'Especialização de Exercícios (Acréscimo)', conceito: 'Os proveitos e os custos são reconhecidos quando obtidos ou incorridos, independentemente do recebimento ou pagamento.', exemplo: 'Rendas pagas adiantadas ou faturas de energia a liquidar no mês seguinte.' },
                { codigo: '4', nome: 'Custo Histórico', conceito: 'Os registos contabilísticos devem basear-se no custo de aquisição ou produção em kwanzas.', exemplo: 'Imobilizado registado pelo valor da fatura de compra e encargos diretos.' },
                { codigo: '5', nome: 'Prudência', conceito: 'É permitida a inclusão de um grau de precaução na avaliação de estimativas, evitando sobreavaliação de ativos.', exemplo: 'Constituição de imparidades de clientes em mora.' },
                { codigo: '6', nome: 'Materialidade', conceito: 'As demonstrações financeiras devem evidenciar todos os elementos relevantes.', exemplo: 'Agregação de pequenas despesas de expediente sem distorção das contas.' },
                { codigo: '7', nome: 'Não Compensação', conceito: 'Não é permitido compensar saldos devedores com credores nem custos com proveitos.', exemplo: 'Clientes e Fornecedores registados separadamente nas contas 31 e 32.' },
              ]).map((p) => (
                <div key={p.codigo || p.nome} className="col-12 col-lg-6">
                  <div className="h-100 p-16 rounded" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div className="d-flex align-items-center mb-8">
                      <span className="badge badge-primary mr-2" style={{ fontSize: 11, fontWeight: 700 }}>
                        Princípio {p.codigo}
                      </span>
                      <strong className="color-dark" style={{ fontSize: 14 }}>
                        {p.nome}
                      </strong>
                    </div>
                    <p className="text-muted mb-8" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      {p.conceito}
                    </p>
                    {p.exemplo && (
                      <div className="p-10 rounded" style={{ backgroundColor: '#f0fdf4', borderLeft: '3px solid #16a34a', fontSize: 12 }}>
                        <strong style={{ color: '#166534' }}>Exemplo Prático:</strong>{' '}
                        <span style={{ color: '#14532d' }}>{p.exemplo}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: DEMONSTRAÇÕES FINANCEIRAS (BALANÇO & DRN)               */}
      {/* ============================================================== */}
      {abaAtiva === 'demonstracoes' && (
        <div>
          <div className="d-flex align-items-center mb-15" style={{ gap: 10 }}>
            <button
              type="button"
              className={`btn btn-sm ${tipoDemonstracao === 'balanco' ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
              onClick={() => setTipoDemonstracao('balanco')}
              style={{ fontWeight: 700, borderRadius: 6 }}
            >
              <i className="la la-balance-scale mr-1"></i> Balanço Sintético Oficial
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tipoDemonstracao === 'drn' ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
              onClick={() => setTipoDemonstracao('drn')}
              style={{ fontWeight: 700, borderRadius: 6 }}
            >
              <i className="la la-chart-line mr-1"></i> Demonstração dos Resultados por Natureza (DRN)
            </button>
          </div>

          <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
            <div className="card-header bg-white py-14 px-20 border-bottom">
              <h5 className="fw-700 text-dark mb-0">
                {tipoDemonstracao === 'balanco' ? 'Estrutura Oficial do Balanço (Decreto 82/01)' : 'Demonstração dos Resultados por Natureza (DRN)'}
              </h5>
              <span className="text-muted" style={{ fontSize: 12.5 }}>
                {tipoDemonstracao === 'balanco'
                  ? 'Quadro comparativo de Ativo (Recursos) e Passivo + Capital Próprio (Obrigações e Fundos)'
                  : 'Apuramento em cascata da Margem Bruta, Resultados Operacionais, Financeiros e Líquidos'}
              </span>
            </div>
            <div className="card-body p-20">
              {tipoDemonstracao === 'balanco' ? (
                <div className="row">
                  <div className="col-md-6 mb-20 mb-md-0">
                    <div className="p-16 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <h6 className="fw-700 text-primary mb-12">
                        <i className="la la-plus-circle mr-1"></i> ATIVO (Recursos e Direitos)
                      </h6>
                      <ul className="list-unstyled mb-0" style={{ fontSize: 13, lineHeight: 2 }}>
                        <li>• <strong>Ativo Não Corrente:</strong> Imobilizações Corpóreas, Incorpóreas e Financeiras (Classe 1)</li>
                        <li>• <strong>Existências:</strong> Mercadorias, Matérias-Primas e Produtos Acabados (Classe 2)</li>
                        <li>• <strong>Dívidas de Terceiros:</strong> Clientes, Estado e Outros Devedores (Classe 3)</li>
                        <li>• <strong>Meios Monetários:</strong> Caixa e Depósitos Bancários (Classe 4)</li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-16 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <h6 className="fw-700 text-danger mb-12">
                        <i className="la la-minus-circle mr-1"></i> PASSIVO & CAPITAL PRÓPRIO
                      </h6>
                      <ul className="list-unstyled mb-0" style={{ fontSize: 13, lineHeight: 2 }}>
                        <li>• <strong>Capital Próprio:</strong> Capital Social, Reservas e Resultados (Classe 5 e 8)</li>
                        <li>• <strong>Passivo Não Corrente:</strong> Empréstimos e Financiamentos Médio/Longo Prazo</li>
                        <li>• <strong>Passivo Corrente:</strong> Fornecedores, Estado (IVA/IRT a Pagar) e Credores</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ width: 100 }}>Código</th>
                        <th>Rubrica da Operação</th>
                        <th style={{ width: 220, textAlign: 'center' }}>Contas PGC</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="badge badge-primary">VENDAS</span></td>
                        <td>Vendas de Mercadorias e Prestação de Serviços</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>61 + 62</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-secondary">CUSTOS</span></td>
                        <td>Custo das Mercadorias Vendidas e Matérias Consumidas (CMVMC)</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>71</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f0fdf4', fontWeight: 700 }}>
                        <td><span className="badge badge-success">MB</span></td>
                        <td>Margem Bruta das Vendas</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>(61 + 62) - 71</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-secondary">FSE</span></td>
                        <td>Fornecimentos e Serviços de Terceiros</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>75</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-secondary">PESSOAL</span></td>
                        <td>Custos com o Pessoal (Remunerações e Encargos Sociais)</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>72</td>
                      </tr>
                      <tr style={{ backgroundColor: '#eff6ff', fontWeight: 700 }}>
                        <td><span className="badge badge-primary">EBIT</span></td>
                        <td>Resultado Operacional (Antes de Encargos Financeiros e Impostos)</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>Operações</td>
                      </tr>
                      <tr style={{ backgroundColor: '#fef3c7', fontWeight: 700 }}>
                        <td><span className="badge badge-warning">RLE</span></td>
                        <td>Resultado Líquido do Exercício (Após Imposto Industrial - Conta 88)</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>Conta 88</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DA FICHA COMPLETA DA CONTA PGC                           */}
      {/* ============================================================== */}
      {contaDetalhe && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 1070 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-white border-bottom py-16 px-20">
                <div className="d-flex align-items-center">
                  <span
                    className="badge mr-2 px-2 py-1 font-weight-bold"
                    style={{
                      backgroundColor: '#eef2fe',
                      color: '#5f63f2',
                      fontFamily: 'monospace',
                      fontSize: 14,
                    }}
                  >
                    {contaDetalhe.codigo}
                  </span>
                  <h5 className="modal-title fw-700 text-dark mb-0">
                    {contaDetalhe.nome}
                  </h5>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setContaDetalhe(null)}
                  style={{ fontSize: 24, lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <div className="modal-body p-20">
                <div className="d-flex align-items-center flex-wrap mb-15" style={{ gap: 8 }}>
                  <span className="badge badge-light border p-2">
                    <strong>Classe:</strong> {contaDetalhe.classe_nome || `Classe ${String(contaDetalhe.codigo).charAt(0)}`}
                  </span>
                  <span className="badge badge-light border p-2">
                    <strong>Natureza:</strong> {contaDetalhe.natureza || 'Saldo Normal'}
                  </span>
                  {contaDetalhe.saft_taxonomia && (
                    <span className="badge badge-light border p-2">
                      <strong>Taxonomia SAF-T:</strong> {contaDetalhe.saft_taxonomia}
                    </span>
                  )}
                </div>

                <div className="row mb-15">
                  <div className="col-md-6 mb-10 mb-md-0">
                    <div className="p-16 rounded h-100" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <h6 style={{ color: '#166534', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        <i className="la la-plus-circle mr-1"></i> DEBITA-SE POR:
                      </h6>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#14532d', lineHeight: 1.5 }}>
                        {contaDetalhe.debito_por || 'Entradas, aquisições, aumentos patrimoniais ou direitos.'}
                      </p>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-16 rounded h-100" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                      <h6 style={{ color: '#991b1b', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        <i className="la la-minus-circle mr-1"></i> CREDITA-SE POR:
                      </h6>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5 }}>
                        {contaDetalhe.credito_por || 'Saídas, liquidações, diminuições patrimoniais ou transferências de fecho.'}
                      </p>
                    </div>
                  </div>
                </div>

                {contaDetalhe.relevancia_fiscal && (
                  <div className="p-12 rounded" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', fontSize: 12.5 }}>
                    <strong style={{ color: '#92400e' }}>Relevância Fiscal AGT:</strong>{' '}
                    <span style={{ color: '#78350f' }}>{contaDetalhe.relevancia_fiscal}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light py-10 px-20">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setContaDetalhe(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PgcView;
