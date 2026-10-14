import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { legislacaoService } from '../../services/api';

const DIPLOMAS_DEFAULT = [
  {
    codigo: 'CIVA',
    nome: 'Imposto sobre o Valor Acrescentado',
    diploma: 'Lei n.º 7/19 de 24 de Abril (alterada pela Lei n.º 17/19)',
    taxa_geral: '14%',
    taxas_reduzidas: '7% e 5% (cesta básica), 1% (Cabinda)',
    prazo: 'Último dia útil do mês seguinte (Modelo 7)',
    ambito: 'Transmissões de bens, prestações de serviços e importações no território de Angola.',
    resumo: 'Institui o IVA em Angola. Regula o direito à dedução (Art. 23.º), isenções (Art. 12.º), e o regime de faturação eletrónica.',
    artigos_chave: [
      { artigo: 'Artigo 12.º', titulo: 'Isenções nas Operações Internas', conteudo: 'Estão isentas de imposto as transmissões de produtos da cesta básica, medicamentos essenciais, livros e operações financeiras/seguros.' },
      { artigo: 'Artigo 14.º', titulo: 'Isenções na Importação', conteudo: 'Isenção na importação definitiva de bens cuja transmissão no território nacional beneficie de isenção interna.' },
      { artigo: 'Artigo 23.º', titulo: 'Direito à Dedução do IVA', conteudo: 'O sujeito passivo pode deduzir o imposto suportado na aquisição de bens e serviços afetos à sua atividade tributável.' },
      { artigo: 'Artigo 27.º', titulo: 'Prazo e Entrega da Declaração Modelo 7', conteudo: 'A declaração periódica Modelo 7 deve ser submetida por via eletrónica até ao último dia do mês seguinte ao período a que respeita.' },
    ],
  },
  {
    codigo: 'CII',
    nome: 'Imposto Industrial',
    diploma: 'Lei n.º 19/14 de 22 de Outubro (alterada pela Lei n.º 26/20)',
    taxa_geral: '25%',
    taxas_reduzidas: '15% (Agricultura/Pescas), 35% (Banca e Telecomunicações)',
    prazo: 'Último dia útil de Maio (Modelo 1) / Liquidação Provisória em Agosto (2%)',
    ambito: 'Tributação dos lucros das empresas e rendimentos obtidos por pessoas coletivas.',
    resumo: 'Regula o cálculo da matéria coletável a partir do resultado contabilístico (Quadro 07 da Modelo 1) e deduções de custos fiscais.',
    artigos_chave: [
      { artigo: 'Artigo 13.º', titulo: 'Custos Fiscalmente Dedutíveis', conteudo: 'São dedutíveis os custos comprovadamente indispensáveis à formação dos proveitos e à manutenção da fonte produtora.' },
      { artigo: 'Artigo 18.º', titulo: 'Custos Não Dedutíveis', conteudo: 'Não são aceites como custo fiscal as multas, encargos não documentados e despesas confidenciais.' },
      { artigo: 'Artigo 67.º', titulo: 'Retenção na Fonte de Imposto Industrial', conteudo: 'Taxa de 6,5% sobre o valor dos serviços prestados por terceiros sujeitos a retenção definitiva ou por conta.' },
    ],
  },
  {
    codigo: 'CIRT',
    nome: 'Imposto sobre o Rendimento do Trabalho',
    diploma: 'Lei n.º 14/25 de 23 de Janeiro (Novo CIRT 2025/2026)',
    taxa_geral: '0% a 25%',
    taxas_reduzidas: 'Isenção total até 100.000 Kz de salário mensal',
    prazo: 'Até ao último dia do mês seguinte (Modelo 2)',
    ambito: 'Rendimentos auferidos por trabalhadores por conta de outrem (Grupo A), conta própria (Grupo B) e órgãos sociais.',
    resumo: 'Determina a tabela progressiva de retenção do IRT e as deduções para a Segurança Social (3%).',
    artigos_chave: [
      { artigo: 'Artigo 2.º', titulo: 'Incidência Objetiva', conteudo: 'Constituem rendimentos do trabalho todas as remunerações pagas a título de ordenados, salários, prémios e gratificações.' },
      { artigo: 'Artigo 16.º', titulo: 'Escalões de Tributação', conteudo: 'Tabela progressiva de taxas de 0% a 25% aplicada após dedução de 3% da Segurança Social.' },
    ],
  },
  {
    codigo: 'CIS',
    nome: 'Imposto do Selo',
    diploma: 'Decreto Legislativo Presidencial n.º 3/14 de 21 de Outubro',
    taxa_geral: '1%',
    taxas_reduzidas: '0,1% a 0,5% (Créditos bancários e garantias)',
    prazo: 'Até ao último dia do mês seguinte',
    ambito: 'Atos, contratos, documentos, títulos, recibos e operações financeiras.',
    resumo: 'Aplica-se subsidiariamente onde não haja incidência de IVA.',
    artigos_chave: [
      { artigo: 'Artigo 1.º', titulo: 'Incidência Geral', conteudo: 'O Imposto do Selo incide sobre todos os atos e operações constantes da Tabela Geral anexa.' },
      { artigo: 'Artigo 4.º', titulo: 'Não Cumulatividade com IVA', conteudo: 'As operações sujeitas e não isentas de IVA estão excluídas da tributação em sede de Imposto do Selo.' },
    ],
  },
  {
    codigo: 'INSS',
    nome: 'Segurança Social Obrigatória',
    diploma: 'Decreto Presidencial n.º 227/18 de 27 de Setembro',
    taxa_geral: '11% Global',
    taxas_reduzidas: '8% Entidade Empregadora + 3% Trabalhador',
    prazo: 'Até ao dia 10 do mês seguinte àquele a que respeita',
    ambito: 'Proteção social obrigatória dos trabalhadores por conta de outrem em Angola.',
    resumo: 'Base de cálculo é a remuneração ilíquida de cada trabalhador.',
    artigos_chave: [
      { artigo: 'Artigo 12.º', titulo: 'Base de Incidência', conteudo: 'A taxa incide sobre o total das remunerações ilíquidas devidas pelo empregador ao trabalhador.' },
    ],
  },
  {
    codigo: 'CGT',
    nome: 'Código Geral Tributário',
    diploma: 'Lei n.º 21/14 de 22 de Outubro',
    taxa_geral: 'Normas Gerais',
    taxas_reduzidas: 'Juros de mora e prazos de caducidade',
    prazo: 'Caducidade do direito à liquidação: 5 anos',
    ambito: 'Regras fundamentais de direito tributário, procedimentos fiscais e garantias dos contribuintes.',
    resumo: 'Estabelece os direitos e garantias dos contribuintes e os deveres da AGT.',
    artigos_chave: [
      { artigo: 'Artigo 45.º', titulo: 'Caducidade da Liquidação', conteudo: 'O direito de liquidar tributos caduca se a liquidação não for validamente notificada ao contribuinte no prazo de 5 anos.' },
    ],
  },
];

const LegislacaoView = () => {
  const { t } = useTranslation();

  const [diplomas, setDiplomas] = useState([]);
  const [diplomaSelecionado, setDiplomaSelecionado] = useState('CIVA');
  const [pesquisa, setPesquisa] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [baixandoExcel, setBaixandoExcel] = useState(false);

  const carregarLegislacao = async () => {
    try {
      setCarregando(true);
      const res = await legislacaoService.getLegislacao({});
      if (res.data?.diplomas && res.data.diplomas.length > 0) {
        setDiplomas(res.data.diplomas);
        setDiplomaSelecionado(res.data.diplomas[0].codigo);
      } else {
        setDiplomas(DIPLOMAS_DEFAULT);
        setDiplomaSelecionado('CIVA');
      }
    } catch {
      setDiplomas(DIPLOMAS_DEFAULT);
      setDiplomaSelecionado('CIVA');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarLegislacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baixarExcel = async () => {
    setBaixandoExcel(true);
    try {
      const res = await legislacaoService.exportarExcel();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Legislacao_Fiscal_Angola_Compendio.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download da Legislação Fiscal em Excel (.xlsx) concluído com sucesso!');
    } catch {
      toast.error('Erro ao transferir compêndio de legislação fiscal.');
    } finally {
      setBaixandoExcel(false);
    }
  };

  const imprimirPdf = () => {
    window.print();
  };

  // Diploma atualmente ativo
  const listaDiplomas = diplomas.length > 0 ? diplomas : DIPLOMAS_DEFAULT;
  const diplomaAtivo = listaDiplomas.find((d) => d.codigo === diplomaSelecionado) || listaDiplomas[0];

  // Artigos filtrados pela pesquisa
  const artigosFiltrados = useMemo(() => {
    if (!diplomaAtivo || !diplomaAtivo.artigos_chave) return [];
    if (!pesquisa.trim()) return diplomaAtivo.artigos_chave;
    const termo = pesquisa.toLowerCase();
    return diplomaAtivo.artigos_chave.filter(
      (art) =>
        art.artigo?.toLowerCase().includes(termo) ||
        art.titulo?.toLowerCase().includes(termo) ||
        art.conteudo?.toLowerCase().includes(termo)
    );
  }, [diplomaAtivo, pesquisa]);

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
                <i className="la la-landmark text-primary mr-6"></i>{' '}
                {t('legislacao.title', 'Legislação Fiscal & Códigos Tributários de Angola')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                Compêndio oficial dos regimes tributários em vigor: CIVA, Imposto Industrial, IRT, Selo e Segurança Social.
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-lighten bg-white"
                onClick={imprimirPdf}
                style={{ fontWeight: 600, fontSize: 13, border: '1px solid #dcdfe5' }}
              >
                <i className="la la-print mr-4"></i> Imprimir / PDF
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={baixarExcel}
                disabled={baixandoExcel}
                style={{ fontWeight: 700, fontSize: 13, backgroundColor: '#5f63f2', borderColor: '#5f63f2' }}
              >
                <i className={`la ${baixandoExcel ? 'la-spinner la-spin' : 'la-file-excel'} mr-4`}></i>
                {baixandoExcel ? 'A gerar...' : 'Baixar Legislação (.xlsx)'}
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
                  Administração Geral Tributária (AGT) · Códigos em Vigor
                </strong>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Base legal utilizada nas reconciliações, auditorias fiscais e conferência do Modelo 7.
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <span className="badge badge-light border p-2" style={{ fontSize: 12, fontWeight: 700, color: '#1a3353' }}>
                <i className="la la-check-circle text-success mr-1"></i> Legislação Atualizada
              </span>
              <span className="badge badge-light border p-2" style={{ fontSize: 12, fontWeight: 700, color: '#5f63f2' }}>
                <i className="la la-gavel mr-1"></i> Leis 2025 / 2026
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
              Taxa Geral de IVA
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#5f63f2' }}>
              14% <span className="fs-13 text-muted fw-normal">CIVA</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Modelo 7 até fim do mês
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #52c41a' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Imposto Industrial
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#52c41a' }}>
              25% <span className="fs-13 text-muted fw-normal">Geral</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              15% Agricultura · 35% Banca
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #1890ff' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Retenção na Fonte
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#1890ff' }}>
              6,5% <span className="fs-13 text-muted fw-normal">Serviços</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Prestadores de serviços
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #fa8b0c' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Segurança Social
            </span>
            <div className="fw-800" style={{ fontSize: 24, color: '#fa8b0c' }}>
              11% <span className="fs-13 text-muted fw-normal">Global</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              8% Empresa + 3% Trabalhador
            </span>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DE DIPLOMAS (ESTILO STEP-PILL DO CONFRONTO) */}
      <div className="d-flex flex-wrap align-items-center mb-20" style={{ gap: 8 }}>
        {listaDiplomas.map((d) => {
          const isActive = diplomaAtivo?.codigo === d.codigo;
          return (
            <button
              key={d.codigo}
              type="button"
              className={`step-pill ${isActive ? 'active' : ''}`}
              onClick={() => setDiplomaSelecionado(d.codigo)}
            >
              <i className="la la-book"></i>
              <span>{d.codigo} — {d.nome}</span>
              <span
                className="badge"
                style={{
                  backgroundColor: isActive ? '#5f63f2' : '#cbd5e1',
                  color: '#ffffff',
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 10,
                }}
              >
                {d.taxa_geral}
              </span>
            </button>
          );
        })}
      </div>

      {/* BARRA DE PESQUISA RÁPIDA DE ARTIGOS */}
      <div className="card card-default mb-20" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
        <div className="card-body p-12">
          <div className="input-group">
            <span className="input-group-text bg-white border-right-0" style={{ border: '1px solid #dcdfe5' }}>
              <i className="la la-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-left-0"
              placeholder={`Pesquisar artigos em ${diplomaAtivo?.codigo || 'Legislação'} (ex: isenção, dedução, taxa, retenção, prazos)...`}
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              style={{ height: 38, fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* DETALHE DO DIPLOMA ATIVO */}
      {carregando ? (
        <div className="card card-default p-40 text-center mb-25" style={{ borderRadius: 10 }}>
          <i className="la la-spinner la-spin text-primary mb-10" style={{ fontSize: 32 }}></i>
          <p className="text-muted mb-0">A carregar compêndio da legislação fiscal...</p>
        </div>
      ) : diplomaAtivo && (
        <div className="card card-default mb-25" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
          <div className="card-header bg-white py-16 px-20 border-bottom">
            <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 10 }}>
              <div>
                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                  <span className="badge badge-primary px-2 py-1" style={{ fontSize: 13, fontWeight: 700 }}>
                    {diplomaAtivo.codigo}
                  </span>
                  <h5 className="fw-800 text-dark mb-0" style={{ fontSize: 17, color: '#1a3353' }}>
                    {diplomaAtivo.nome}
                  </h5>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: 12.5 }}>
                  <i className="la la-balance-scale mr-1"></i> {diplomaAtivo.diploma}
                </div>
              </div>

              <div className="d-flex align-items-center" style={{ gap: 8 }}>
                <span className="badge badge-light border p-2" style={{ fontSize: 12 }}>
                  <strong>Taxa Geral:</strong> <span className="text-primary font-weight-bold">{diplomaAtivo.taxa_geral}</span>
                </span>
                {diplomaAtivo.prazo && (
                  <span className="badge badge-light border p-2 text-muted" style={{ fontSize: 12 }}>
                    <i className="la la-calendar mr-1"></i> {diplomaAtivo.prazo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card-body p-20">
            {/* RESUMO / ÂMBITO */}
            <div className="p-16 mb-20 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div className="mb-8">
                <strong className="color-dark">Âmbito de Aplicação:</strong>{' '}
                <span className="text-muted">{diplomaAtivo.ambito}</span>
              </div>
              <div>
                <strong className="color-dark">Enquadramento Fiscal:</strong>{' '}
                <span className="text-muted">{diplomaAtivo.resumo}</span>
              </div>
            </div>

            {/* ARTIGOS-CHAVE */}
            <h6 className="fw-700 text-dark mb-15">
              <i className="la la-gavel text-primary mr-1"></i>
              Artigos-Chave ({artigosFiltrados.length})
            </h6>

            {artigosFiltrados.length === 0 ? (
              <div className="text-center py-30 text-muted">
                <i className="la la-search mb-2 d-block" style={{ fontSize: 32 }}></i>
                Nenhum artigo encontrado para o termo pesquisado.
              </div>
            ) : (
              <div className="row" style={{ rowGap: 14 }}>
                {artigosFiltrados.map((art, idx) => (
                  <div key={idx} className="col-12 col-md-6">
                    <div className="p-16 rounded h-100" style={{ border: '1px solid #edf0f5', backgroundColor: '#ffffff' }}>
                      <div className="d-flex align-items-center mb-8">
                        <span className="badge badge-light border text-primary font-weight-bold mr-2" style={{ fontSize: 11.5 }}>
                          {art.artigo}
                        </span>
                        <strong className="color-dark" style={{ fontSize: 13.5 }}>
                          {art.titulo}
                        </strong>
                      </div>
                      <p className="text-muted mb-0" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                        {art.conteudo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LegislacaoView;
