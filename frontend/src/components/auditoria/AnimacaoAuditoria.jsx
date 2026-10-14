import React, { useState, useEffect, useRef } from 'react';

/**
 * Animação técnica de auditoria pericial fiscal e contabilística.
 *
 * Utiliza rigorosamente a identidade visual do sistema:
 * - Cards brancos padrão (`card card-default`), bordas `#f1f2f6`.
 * - Cores canónicas: Primária `#5f63f2`, Sucesso `#20c997`, Alerta `#fa8b0c`, Erro `#ff4d4f`.
 * - Tipografia e espaçamentos idênticos aos cartões de Números e Prazos.
 */

const FASES_AUDITORIA = [
  {
    id: 'LEITURA',
    titulo: '1. Leitura Documental',
    subtitulo: 'Extração e integridade de Balancete, Modelo 7, Folha e DARs',
  },
  {
    id: 'ESCRITURACAO',
    titulo: '2. Varredura PGC Angolano',
    subtitulo: 'Análise das contas 61/62, 34.5.3, 34.5.1, 34.3, 34.9.3, 45 e 32.1',
  },
  {
    id: 'DECLARACAO',
    titulo: '3. Confronto com a AGT',
    subtitulo: 'Cruzamento com Modelo 7 (Campos 13, 21-24), DARs e NIFs',
  },
  {
    id: 'REGRAS',
    titulo: '4. Rule Engine Fiscal',
    subtitulo: 'Aplicação de 40 regras canónicas tributárias e enquadramento',
  },
  {
    id: 'PRAZOS',
    titulo: '5. Calendário e Prazos',
    subtitulo: 'Verificação de liquidações (INSS dia 10, IRT e IVA fim do mês)',
  },
  {
    id: 'RISCO',
    titulo: '6. Diagnóstico & Parecer IA',
    subtitulo: 'Apuramento de contingências fiscais, multas, juros e parecer',
  },
];

const AnimacaoAuditoria = ({ emExecucao, progressoPassos, empresaNome, periodo, onConcluir, onCancelar }) => {
  const [faseAtiva, setFaseAtiva] = useState(0);
  const [progresso, setProgresso] = useState(5);
  const [logs, setLogs] = useState([]);
  const terminalRef = useRef(null);

  const mensagensLog = React.useMemo(() => [
    { fase: 0, tag: 'SISTEMA', texto: 'Inicialização do pipeline de auditoria pericial para ' + (empresaNome || 'Entidade') },
    { fase: 0, tag: 'LEITURA', texto: 'Validação da integridade documental do período ' + (periodo || 'Mês actual') + '...' },
    { fase: 0, tag: 'LEITURA', texto: 'Balancete de Verificação: estrutura de colunas e balanço de débitos/créditos.' },
    { fase: 0, tag: 'LEITURA', texto: 'Extração da Declaração Periódica de IVA (Modelo 7 AGT) e Folha Salarial.' },
    { fase: 1, tag: 'PGC-61/62', texto: 'Varredura dos Proveitos: Contas 61 (Vendas) e 62 (Prestações de Serviços).' },
    { fase: 1, tag: 'PGC-3453', texto: 'Conta 34.5.3 (IVA Liquidado): Apuramento da base de incidência e taxa legal (14%).' },
    { fase: 1, tag: 'PGC-3451', texto: 'Conta 34.5.1 (IVA Suportado Dedutível): Verificação da elegibilidade das operações.' },
    { fase: 1, tag: 'PGC-343', texto: 'Conta 34.3 (IRT): Cruzamento da matéria colectável com a Conta 722 (Remunerações) - CIRT Lei 14/25.' },
    { fase: 1, tag: 'PGC-3493', texto: 'Conta 34.9.3 (Retenção 6,5% a Prestadores): Verificação das contas 752 (FSE) - CII Art. 71.º.' },
    { fase: 1, tag: 'PGC-45', texto: 'Conta 45 (Caixa): Teste de saldo credor — Prevenção de presunção de proveitos (Art. 47 CII).' },
    { fase: 2, tag: 'AGT-MOD7', texto: 'Batimento Conta 34.5.3 com Campo 13 do Modelo 7...' },
    { fase: 2, tag: 'AGT-MOD7', texto: 'Batimento Conta 34.5.1 com Campos 21-24 (IVA dedutível declarado)...' },
    { fase: 2, tag: 'AGT-NIF', texto: 'Validação de NIF da entidade e identificação dos prestadores do Balancete...' },
    { fase: 3, tag: 'REGRAS-IVA', texto: 'Execução do Motor IVA-001 a IVA-011: cálculo de desvios e coerência da base tributável.' },
    { fase: 3, tag: 'REGRAS-IRT', texto: 'Execução do Motor IRT-001 a IRT-005: escalões de rendimento, isenção até 150.000 Kz (Lei 14/25).' },
    { fase: 3, tag: 'REGRAS-II', texto: 'Execução do Motor Retenção 6,5%: verificação de dispensas, limites e emissão de DARs.' },
    { fase: 4, tag: 'CALENDÁRIO', texto: 'Avaliação da obrigação INSS (Lei 07/04) — prazo legal até dia 10 do mês seguinte.' },
    { fase: 4, tag: 'CALENDÁRIO', texto: 'Avaliação da obrigação IRT e Modelo 7 IVA — prazo legal até último dia do mês seguinte.' },
    { fase: 4, tag: 'CALENDÁRIO', texto: 'Verificação de Liquidação Provisória de Imposto Industrial (2% sobre vendas no 1º semestre).' },
    { fase: 5, tag: 'PARECER-IA', texto: 'Submissão do rasto factual comprovado ao modelo analítico de IA...' },
    { fase: 5, tag: 'RISCO-CGT', texto: 'Mapeamento de contingências: Coimas (Arts. 186/187 CGT 25%-200%) e Juros (2,5%/mês).' },
    { fase: 5, tag: 'CONCLUÍDO', texto: 'Auditoria concluída. Relatório pericial contabilístico pronto para consulta.' },
  ], [empresaNome, periodo]);

  useEffect(() => {
    let indexLog = 0;
    const totalLogs = mensagensLog.length;

    const interval = setInterval(() => {
      if (indexLog < totalLogs) {
        const item = mensagensLog[indexLog];
        setLogs((prev) => [...prev, item]);
        setFaseAtiva(item.fase);
        const novoProgresso = Math.min(100, Math.round(((indexLog + 1) / totalLogs) * 100));
        setProgresso(novoProgresso);
        indexLog++;
      } else {
        clearInterval(interval);
        setProgresso(100);
        if (onConcluir) {
          setTimeout(onConcluir, 600);
        }
      }
    }, 280);

    return () => clearInterval(interval);
  }, [mensagensLog, onConcluir]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className="card card-default mb-20"
      style={{
        border: '1px solid #f1f2f6',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho alinhado com a identidade visual do sistema */}
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
            <i className="la la-brain"></i>
          </div>
          <div>
            <h5 className="mb-0" style={{ fontSize: 16, fontWeight: 700, color: '#272b41' }}>
              Auditoria com Inteligência Artificial
            </h5>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Varredura de contas PGC (Dec. 82/01), confronto com a AGT e avaliação de riscos fiscais
            </span>
          </div>
        </div>

        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          <span
            className="badge"
            style={{
              background: '#f0fdf9',
              color: '#20c997',
              border: '1px solid rgba(32, 201, 151, 0.25)',
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <i className="la la-shield-alt mr-1"></i> PGC & AGT ACTIVO
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#5f63f2',
              minWidth: 42,
              textAlign: 'right',
            }}
          >
            {progresso}%
          </span>
        </div>
      </div>

      {/* Barra de Progresso Roxa/Verde da Identidade */}
      <div style={{ width: '100%', height: 3, background: '#f1f2f6' }}>
        <div
          style={{
            width: `${progresso}%`,
            height: '100%',
            background: progresso === 100 ? '#20c997' : '#5f63f2',
            transition: 'width 0.25s ease-in-out',
          }}
        ></div>
      </div>

      <div className="card-body" style={{ padding: '18px 20px' }}>
        <div className="row g-3">
          {/* Lado Esquerdo: 6 Etapas da Auditoria com a identidade de cartões do sistema */}
          <div className="col-lg-5 col-md-12 pr-lg-3">
            <span
              className="text-muted d-block mb-10"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Fases da Verificação Técnica
            </span>

            <div className="d-flex flex-column" style={{ gap: 6 }}>
              {FASES_AUDITORIA.map((fase, i) => {
                const estaConcluida = faseAtiva > i || progresso === 100;
                const estaAtiva = faseAtiva === i && progresso < 100;

                return (
                  <div
                    key={fase.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: estaAtiva ? '#f4f5fb' : estaConcluida ? '#f0fdf9' : '#fafbfe',
                      border: estaAtiva
                        ? '1px solid #5f63f2'
                        : estaConcluida
                        ? '1px solid rgba(32, 201, 151, 0.3)'
                        : '1px solid #f1f2f6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        background: estaConcluida
                          ? '#20c997'
                          : estaAtiva
                          ? '#5f63f2'
                          : '#eef0f3',
                        color: estaConcluida || estaAtiva ? '#fff' : '#8c90a4',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {estaConcluida ? (
                        <i className="la la-check"></i>
                      ) : estaAtiva ? (
                        <i className="la la-spinner la-spin"></i>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: estaAtiva ? '#5f63f2' : estaConcluida ? '#272b41' : '#8c90a4',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fase.titulo}
                      </div>
                      <div
                        className="text-muted"
                        style={{
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fase.subtitulo}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lado Direito: Consola de Verificações em Tempo Real */}
          <div className="col-lg-7 col-md-12 pl-lg-2">
            <span
              className="text-muted d-block mb-10"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Stream de Verificações Técnicas
            </span>

            <div
              ref={terminalRef}
              style={{
                background: '#f8f9fb',
                borderRadius: 6,
                border: '1px solid #eef0f3',
                padding: '12px 14px',
                height: 236,
                overflowY: 'auto',
                fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {logs.map((log, idx) => {
                let badgeFundo = '#eff0f6';
                let badgeCor = '#5a5f7d';
                if (log.tag.includes('PGC')) { badgeFundo = '#e0f2fe'; badgeCor = '#0284c7'; }
                if (log.tag.includes('AGT')) { badgeFundo = '#ede9fe'; badgeCor = '#7c3aed'; }
                if (log.tag.includes('REGRAS')) { badgeFundo = '#fff7e6'; badgeCor = '#fa8b0c'; }
                if (log.tag.includes('CALENDÁRIO')) { badgeFundo = '#f0fdf9'; badgeCor = '#20c997'; }
                if (log.tag.includes('PARECER')) { badgeFundo = '#fdf2f8'; badgeCor = '#db2777'; }
                if (log.tag.includes('RISCO')) { badgeFundo = '#fff1f0'; badgeCor = '#ff4d4f'; }

                return (
                  <div key={idx} style={{ marginBottom: 5, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: badgeFundo,
                        color: badgeCor,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {log.tag}
                    </span>
                    <span style={{ color: '#272b41' }}>{log.texto}</span>
                  </div>
                );
              })}

              {progresso < 100 && (
                <div style={{ color: '#5f63f2', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5 }}>
                  <i className="la la-spinner la-spin"></i>
                  <span>A cruzar contas e validar parâmetros fiscais...</span>
                </div>
              )}
            </div>

            {progresso === 100 && onCancelar && (
              <div className="d-flex justify-content-end mt-10">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={onCancelar}
                  style={{ fontSize: 12 }}
                >
                  Fechar Registo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimacaoAuditoria;
