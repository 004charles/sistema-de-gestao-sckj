import React, { useState } from 'react';
import { toast } from 'react-toastify';

/**
 * Parecer Técnico do Auditor com IA & Rasto de Auditoria.
 *
 * Utiliza 100% a identidade visual nativa da aplicação:
 * - Cartões padrão: `card card-default`, bordas `#f1f2f6`.
 * - Cores e tipografia: `#272b41` (títulos), `#5a5f7d` (texto), `#8c90a4` (labels).
 * - Destaques: Primária `#5f63f2`, Sucesso `#20c997`, Alerta `#fa8b0c`, Erro `#ff4d4f`.
 * - Sem asteriscos de markdown, com texto formatado e tabelas no padrão do sistema.
 */

const BADGE_ESTADOS = {
  OK: { bg: '#f0fdf9', cor: '#20c997', label: 'CONFORME' },
  ALERTA: { bg: '#fff7e6', cor: '#fa8b0c', label: 'ALERTA' },
  FALHA: { bg: '#fff1f0', cor: '#ff4d4f', label: 'FALHA' },
  INFO: { bg: '#f8f9fb', cor: '#5a5f7d', label: 'NOTA' },
};

// Formata texto inline substituindo **texto** por <strong> e limpando asteriscos
const formatarTextoInline = (texto) => {
  if (!texto) return '';
  const partes = [];
  const regex = /\*\*(.*?)\*\*/g;
  let ultimoIndex = 0;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimoIndex) {
      partes.push(texto.substring(ultimoIndex, match.index).replace(/\*/g, ''));
    }
    partes.push(
      <strong key={match.index} style={{ fontWeight: 700, color: '#272b41' }}>
        {match[1].replace(/\*/g, '')}
      </strong>
    );
    ultimoIndex = regex.lastIndex;
  }
  if (ultimoIndex < texto.length) {
    partes.push(texto.substring(ultimoIndex).replace(/\*/g, ''));
  }
  return partes;
};

// Renderiza blocos markdown integrados na identidade visual
const DocumentoOficial = ({ texto, empresaNome, nif, periodo, regime }) => {
  if (!texto) {
    return (
      <div className="text-center py-20 text-muted" style={{ fontSize: 13 }}>
        Nenhum conteúdo pericial disponível para este período.
      </div>
    );
  }

  const linhas = texto.split('\n');
  const elementos = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i].trim();

    if (!linha) {
      i++;
      continue;
    }

    if (linha.startsWith('---') || linha.startsWith('___')) {
      elementos.push(
        <hr key={`hr-${i}`} style={{ borderColor: '#f1f2f6', margin: '20px 0' }} />
      );
      i++;
      continue;
    }

    // Títulos de secção
    if (linha.startsWith('#')) {
      const nivel = linha.match(/^#+/)[0].length;
      const tituloTexto = linha.replace(/^#+\s*/, '').replace(/\*/g, '');
      elementos.push(
        <div
          key={`h-${i}`}
          style={{
            marginTop: nivel === 1 ? 24 : 18,
            marginBottom: 10,
            paddingBottom: 6,
            borderBottom: '1px solid #f1f2f6',
          }}
        >
          <span
            style={{
              fontSize: nivel === 1 ? 16 : nivel === 2 ? 14 : 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#272b41',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 4,
                height: 14,
                background: '#5f63f2',
                borderRadius: 2,
                display: 'inline-block',
              }}
            ></span>
            {tituloTexto}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Tabelas Markdown (| col | col |)
    if (linha.startsWith('|') && linha.endsWith('|')) {
      const linhasTabela = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|') && linhas[i].trim().endsWith('|')) {
        linhasTabela.push(linhas[i].trim());
        i++;
      }

      if (linhasTabela.length >= 2) {
        const headers = linhasTabela[0]
          .split('|')
          .slice(1, -1)
          .map((h) => h.trim().replace(/\*/g, ''));

        const rows = linhasTabela.slice(2).map((rowStr) =>
          rowStr
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );

        elementos.push(
          <div key={`table-${i}`} className="table-responsive my-15" style={{ borderRadius: 6, border: '1px solid #f1f2f6' }}>
            <table className="table table-bordered mb-0" style={{ fontSize: 12.5, background: '#fff' }}>
              <thead style={{ background: '#f8f9fb' }}>
                <tr>
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: '10px 12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: 11,
                        letterSpacing: 0.5,
                        color: '#272b41',
                        borderBottom: '1px solid #f1f2f6',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#fff' : '#fafbfe' }}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '9px 12px',
                          border: '1px solid #f1f2f6',
                          verticalAlign: 'middle',
                          color: '#5a5f7d',
                        }}
                      >
                        {formatarTextoInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Listas (* item ou - item)
    if (linha.startsWith('* ') || linha.startsWith('- ')) {
      const itensLista = [];
      while (i < linhas.length && (linhas[i].trim().startsWith('* ') || linhas[i].trim().startsWith('- '))) {
        itensLista.push(linhas[i].trim().substring(2));
        i++;
      }

      elementos.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: '8px 0', listStyleType: 'disc' }}>
          {itensLista.map((item, itemIdx) => (
            <li key={itemIdx} style={{ marginBottom: 5, color: '#5a5f7d', fontSize: 13, lineHeight: 1.6 }}>
              {formatarTextoInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Parágrafos
    elementos.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '8px 0',
          fontSize: 13,
          lineHeight: 1.7,
          color: '#5a5f7d',
        }}
      >
        {formatarTextoInline(linha)}
      </p>
    );
    i++;
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: '24px 28px',
        border: '1px solid #f1f2f6',
      }}
    >
      {/* Cabeçalho do Documento dentro do estilo da aplicação */}
      <div
        className="pb-15 mb-15 d-flex justify-content-between align-items-center flex-wrap"
        style={{ borderBottom: '1px solid #f1f2f6', gap: 10 }}
      >
        <div>
          <span
            className="text-muted d-block"
            style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
          >
            Relatório de Auditoria Contabilística e Fiscal
          </span>
          <h4 style={{ fontSize: 18, fontWeight: 700, color: '#272b41', margin: '4px 0 0' }}>
            {empresaNome || 'SCKJ – COMÉRCIO E SERVIÇOS, (SU), LDA'}
          </h4>
        </div>

        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <span
            style={{
              background: '#f4f5fb',
              color: '#5f63f2',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Período: {periodo || '07/2026'}
          </span>
          <span
            style={{
              background: '#f0fdf9',
              color: '#20c997',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            NIF: {nif || '5000000000'}
          </span>
          <span
            style={{
              background: '#fff7e6',
              color: '#fa8b0c',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {regime || 'Regime Geral (14%)'}
          </span>
        </div>
      </div>

      {/* Conteúdo Pericial Formatado */}
      <div className="conteudo-documento">
        {elementos}
      </div>

      {/* Termo de Encerramento */}
      <div
        className="mt-30 pt-15 d-flex justify-content-between align-items-center flex-wrap"
        style={{ borderTop: '1px solid #f1f2f6', gap: 12, fontSize: 12 }}
      >
        <span className="text-muted">
          Plano Geral de Contabilidade (Decreto Executivo n.º 82/01) · Código Geral Tributário (Lei n.º 21/14)
        </span>
        <span style={{ fontWeight: 600, color: '#272b41' }}>
          Técnico de Contas / Auditor Fiscal Certificado
        </span>
      </div>
    </div>
  );
};

const ParecerTecnicoIA = ({ parecerData, rastoData, aCarregar, onReanalisar, empresaNome, nif, periodo, regime }) => {
  const [abaAtiva, setAbaAtiva] = useState('parecer');
  const [filtroFase, setFiltroFase] = useState('TODAS');
  const [apenasAlertas, setApenasAlertas] = useState(false);

  if (!parecerData && !rastoData && !aCarregar) {
    return null;
  }

  const parecerTexto = parecerData?.parecer?.texto || '';
  const riscosTexto = parecerData?.riscos?.texto || '';
  const modeloUsado = parecerData?.parecer?.modelo || 'Motor PGC/AGT';
  const origem = parecerData?.parecer?.origem || 'DETERMINISTICO';
  const aviso = parecerData?.parecer?.aviso;

  const passos = rastoData?.passos || parecerData?.rasto?.passos || [];
  const fases = rastoData?.fases || parecerData?.rasto?.fases || [];

  const empNomeFinal = empresaNome || rastoData?.empresa || parecerData?.rasto?.empresa || 'SCKJ – COMÉRCIO E SERVIÇOS, (SU), LDA';
  const nifFinal = nif || rastoData?.nif || parecerData?.rasto?.nif || '5000000000';
  const periodoFinal = periodo || rastoData?.periodo || parecerData?.rasto?.periodo || '07/2026';

  const passosFiltrados = passos.filter((p) => {
    if (filtroFase !== 'TODAS' && p.fase !== filtroFase) return false;
    if (apenasAlertas && p.estado !== 'ALERTA' && p.estado !== 'FALHA') return false;
    return true;
  });

  const copiarParecer = () => {
    const textoLimpo = `${parecerTexto}\n\n---\n\n${riscosTexto}`.replace(/\*\*/g, '').replace(/\*/g, '');
    navigator.clipboard.writeText(textoLimpo);
    toast.success('Parecer técnico copiado para a área de transferência.');
  };

  const imprimirDocumento = () => {
    window.print();
  };

  return (
    <div
      className="card card-default mb-20"
      style={{
        border: '1px solid #f1f2f6',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho do Card */}
      <div
        className="card-header d-flex justify-content-between align-items-center flex-wrap"
        style={{
          padding: '16px 20px',
          background: '#fff',
          borderBottom: '1px solid #f1f2f6',
          gap: 12,
        }}
      >
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              background: '#f4f5fb',
              color: '#5f63f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <i className="la la-clipboard-check"></i>
          </div>
          <div>
            <h5 className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#272b41' }}>
              Parecer Técnico & Auditoria PGC / AGT
            </h5>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Relatório pericial estruturado com indicação das contas de origem e riscos fiscais
            </span>
          </div>
        </div>

        <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
          <span
            className="badge"
            style={{
              background: origem === 'IA' ? '#f4f5fb' : '#f8f9fb',
              color: origem === 'IA' ? '#5f63f2' : '#5a5f7d',
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <i className={`la ${origem === 'IA' ? 'la-brain' : 'la-calculator'} mr-1`}></i>
            {origem === 'IA' ? `IA: ${modeloUsado}` : 'Motor PGC Factual'}
          </span>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm btn-squared"
            onClick={imprimirDocumento}
            disabled={!parecerTexto}
            title="Imprimir relatório pericial"
          >
            <i className="la la-print mr-1"></i> Imprimir
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm btn-squared"
            onClick={copiarParecer}
            disabled={!parecerTexto}
            title="Copiar texto limpo"
          >
            <i className="la la-copy mr-1"></i> Copiar
          </button>

          {onReanalisar && (
            <button
              type="button"
              className="btn btn-primary btn-sm btn-squared"
              onClick={onReanalisar}
              disabled={aCarregar}
              title="Solicitar nova revisão da IA"
            >
              <i className={`la ${aCarregar ? 'la-spinner la-spin' : 'la-sync-alt'} mr-1`}></i>
              Reanalisar com IA
            </button>
          )}
        </div>
      </div>

      {/* Navegação de Abas alinhada com a aplicação */}
      <div
        className="d-flex align-items-center"
        style={{
          borderBottom: '1px solid #f1f2f6',
          padding: '0 20px',
          background: '#fff',
        }}
      >
        <button
          type="button"
          className="btn btn-link"
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: abaAtiva === 'parecer' ? 700 : 500,
            color: abaAtiva === 'parecer' ? '#5f63f2' : '#8c90a4',
            borderBottom: abaAtiva === 'parecer' ? '2px solid #5f63f2' : '2px solid transparent',
            borderRadius: 0,
            textDecoration: 'none',
          }}
          onClick={() => setAbaAtiva('parecer')}
        >
          <i className="la la-file-alt mr-1"></i> Parecer do Auditor
        </button>

        <button
          type="button"
          className="btn btn-link"
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: abaAtiva === 'riscos' ? 700 : 500,
            color: abaAtiva === 'riscos' ? '#5f63f2' : '#8c90a4',
            borderBottom: abaAtiva === 'riscos' ? '2px solid #5f63f2' : '2px solid transparent',
            borderRadius: 0,
            textDecoration: 'none',
          }}
          onClick={() => setAbaAtiva('riscos')}
        >
          <i className="la la-exclamation-triangle mr-1"></i> Riscos & Penalidades Fiscais
        </button>

        <button
          type="button"
          className="btn btn-link"
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: abaAtiva === 'rasto' ? 700 : 500,
            color: abaAtiva === 'rasto' ? '#5f63f2' : '#8c90a4',
            borderBottom: abaAtiva === 'rasto' ? '2px solid #5f63f2' : '2px solid transparent',
            borderRadius: 0,
            textDecoration: 'none',
          }}
          onClick={() => setAbaAtiva('rasto')}
        >
          <i className="la la-list-ol mr-1"></i> De Onde Vem Tudo ({passos.length})
        </button>
      </div>

      <div className="card-body" style={{ padding: '20px', background: '#fafbfe' }}>
        {aCarregar && (
          <div className="text-center py-40">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">A carregar...</span>
            </div>
            <p className="text-muted mt-2 mb-0" style={{ fontSize: 13 }}>
              A gerar parecer técnico fundamentado...
            </p>
          </div>
        )}

        {!aCarregar && abaAtiva === 'parecer' && (
          <div>
            {aviso && (
              <div
                className="alert alert-info py-2 px-3 mb-15"
                style={{ fontSize: 12, borderRadius: 6 }}
              >
                <i className="la la-info-circle mr-1"></i>
                {aviso}
              </div>
            )}

            <DocumentoOficial
              texto={parecerTexto}
              empresaNome={empNomeFinal}
              nif={nifFinal}
              periodo={periodoFinal}
              regime={regime}
            />
          </div>
        )}

        {!aCarregar && abaAtiva === 'riscos' && (
          <div>
            {/* Bloco de Riscos com a paleta idêntica a Prazos.jsx */}
            <div className="row mb-15">
              <div className="col-md-4 mb-2 mb-md-0">
                <div
                  style={{
                    background: '#fff1f0',
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 13, marginBottom: 4 }}>
                    <i className="la la-gavel mr-1"></i> Coimas AGT (CGT Art. 186/187)
                  </div>
                  <div style={{ fontSize: 12, color: '#272b41', lineHeight: 1.5 }}>
                    De <strong>25% a 200%</strong> do imposto em falta por omissão, entrega fora de prazo
                    ou falta da escrituração do período.
                  </div>
                </div>
              </div>

              <div className="col-md-4 mb-2 mb-md-0">
                <div
                  style={{
                    background: '#fff7e6',
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#fa8b0c', fontSize: 13, marginBottom: 4 }}>
                    <i className="la la-clock mr-1"></i> Juros de Mora (CGT Art. 195)
                  </div>
                  <div style={{ fontSize: 12, color: '#272b41', lineHeight: 1.5 }}>
                    Taxa legal de <strong>2,5% ao mês</strong> (ou fração de mês) sobre qualquer liquidação
                    tributária em atraso.
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div
                  style={{
                    background: '#f4f5fb',
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#5f63f2', fontSize: 13, marginBottom: 4 }}>
                    <i className="la la-shield-alt mr-1"></i> Perda do Direito à Dedução
                  </div>
                  <div style={{ fontSize: 12, color: '#272b41', lineHeight: 1.5 }}>
                    Art. 23.º do CIVA: faturas que não cumpram os requisitos formais anulam
                    o direito à dedução do IVA da Conta 34.5.1.
                  </div>
                </div>
              </div>
            </div>

            <DocumentoOficial
              texto={riscosTexto}
              empresaNome={empNomeFinal}
              nif={nifFinal}
              periodo={periodoFinal}
              regime={regime}
            />
          </div>
        )}

        {!aCarregar && abaAtiva === 'rasto' && (
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '18px 20px',
              border: '1px solid #f1f2f6',
            }}
          >
            {/* Filtros do Rasto */}
            <div
              className="d-flex justify-content-between align-items-center flex-wrap mb-15"
              style={{ gap: 10 }}
            >
              <div className="d-flex align-items-center flex-wrap" style={{ gap: 6 }}>
                <button
                  type="button"
                  className={`btn btn-sm btn-squared ${filtroFase === 'TODAS' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 12 }}
                  onClick={() => setFiltroFase('TODAS')}
                >
                  Todas ({passos.length})
                </button>
                {fases.map((f) => (
                  <button
                    key={f.codigo}
                    type="button"
                    className={`btn btn-sm btn-squared ${filtroFase === f.codigo ? 'btn-primary' : 'btn-outline-secondary'}`}
                    style={{ fontSize: 12 }}
                    onClick={() => setFiltroFase(f.codigo)}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>

              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="chkApenasAlertas"
                  checked={apenasAlertas}
                  onChange={(e) => setApenasAlertas(e.target.checked)}
                />
                <label
                  className="form-check-label text-muted"
                  htmlFor="chkApenasAlertas"
                  style={{ fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Apenas Alertas & Falhas
                </label>
              </div>
            </div>

            {/* Tabela de Passos */}
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0" style={{ fontSize: 12.5 }}>
                <thead style={{ background: '#f8f9fb' }}>
                  <tr>
                    <th style={{ width: 110 }}>Fase</th>
                    <th style={{ width: 110 }}>Código</th>
                    <th>Verificação & Proveniência da Conta / Documento</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Valor</th>
                    <th style={{ width: 190 }}>Base Legal</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {passosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-20 text-muted">
                        Nenhum passo para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    passosFiltrados.map((passo, idx) => {
                      const badgeInfo = BADGE_ESTADOS[passo.estado] || BADGE_ESTADOS.INFO;
                      return (
                        <tr key={idx}>
                          <td>
                            <span
                              style={{
                                background: '#f4f5fb',
                                color: '#5f63f2',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {passo.fase}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#272b41' }}>
                            {passo.codigo}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#272b41' }}>
                              {passo.texto}
                            </div>
                            {passo.fonte && (
                              <div className="text-muted" style={{ fontSize: 11 }}>
                                <i className="la la-paperclip mr-1"></i>
                                Fonte: <strong>{passo.fonte}</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#272b41' }}>
                            {passo.valor ? `${passo.valor} Kz` : '—'}
                          </td>
                          <td style={{ color: '#5a5f7d', fontSize: 11.5 }}>
                            {passo.norma || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                background: badgeInfo.bg,
                                color: badgeInfo.cor,
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {badgeInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParecerTecnicoIA;
