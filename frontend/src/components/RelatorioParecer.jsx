import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

const boxNeutro = {
  backgroundColor: '#f8f9fb',
  border: '1px solid #eef0f3',
  borderRadius: 8,
};

const boxBranco = {
  backgroundColor: '#ffffff',
  border: '1px solid #eef0f3',
  borderRadius: 8,
};

/**
 * Parecer Técnico Oficial de Auditoria e Reconciliação Fiscal (Angola)
 * Confronto direto entre o Balancete da Contabilidade e o Modelo 7 da AGT.
 */
const RelatorioParecer = ({ dados, empresaAtual, ano, mes }) => {
  const { t } = useTranslation();
  const mObj = MESES.find((m) => m.valor === String(mes));
  const mesNome = mObj ? t(`months.${mObj.chave}`, mObj.nome) : mes;
  const docBase = dados?.documentos_base || {};

  const analiseIAEstruturada = useMemo(() => {
    return parseAnaliseIA(dados?.analise_ia);
  }, [dados?.analise_ia]);

  if (!dados) {
    return (
      <p className="mb-0 text-center text-muted" style={{ fontSize: 13, padding: 30 }}>
        {t('officialReport.loading', 'A carregar parecer técnico do período…')}
      </p>
    );
  }

  const temAnaliseIa = Boolean(dados?.analise_ia && analiseIAEstruturada?.totalPontos > 0);
  const temDivergencia = (analiseIAEstruturada?.diferencasCount ?? 0) > 0;

  let statusBadgeClass = 'badge-success';
  let statusBadgeText = t('officialReport.statusCompliant', '100% Conforme');
  if (!temAnaliseIa) {
    statusBadgeClass = 'badge-info';
    statusBadgeText = t('officialReport.statusPending', 'Aguardando Confronto');
  } else if (temDivergencia) {
    statusBadgeClass = 'badge-warning';
    statusBadgeText = t('officialReport.statusDifferences', 'Atenção: Diferenças Identificadas');
  }

  return (
    <div className="parecer-tecnico-documento">
      <style>
        {`
        @media print {
          .no-print, .modal-backdrop, .modal-header, .modal-footer, .close, .btn { display: none !important; }
          body { background: #fff !important; font-size: 11pt !important; color: #000 !important; }
          .parecer-tecnico-documento { padding: 0 !important; font-size: 11pt !important; width: 100% !important; }
          .modal { position: static !important; display: block !important; padding: 0 !important; overflow: visible !important; }
          .modal-dialog { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
          .modal-content { border: none !important; box-shadow: none !important; }
          .modal-body { max-height: none !important; overflow: visible !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
          .table th, .table td { padding: 6px 8px !important; }
        }
        `}
      </style>

      {/* CABEÇALHO OFICIAL DO PARECER */}
      <div
        className="d-flex justify-content-between align-items-center flex-wrap pb-20 mb-20"
        style={{ borderBottom: '2px solid #272b41', gap: 15 }}
      >
        <div>
          <span className="badge badge-primary px-10 py-4 mb-8" style={{ fontSize: 11, fontWeight: 700 }}>
            {t('officialReport.headerBadge', 'AUDITORIA FISCAL PREVENTIVA · AGT ANGOLA')}
          </span>
          <h4 className="mb-5 fw-800 color-dark" style={{ letterSpacing: '-0.3px' }}>
            {empresaAtual?.nome || dados?.empresa?.nome || t('officialReport.companyFallback', 'EMPRESA AUDITADA')}
          </h4>
          <p className="mb-0 fs-13 text-muted">
            {t('officialReport.nifLabel', 'NIF')}:{' '}
            <strong className="color-dark">{empresaAtual?.nif || dados?.empresa?.nif || '—'}</strong> ·{' '}
            {t('officialReport.vatRegimeLabel', 'Regime de IVA')}:{' '}
            <strong className="color-dark">{empresaAtual?.regime_iva || dados?.empresa?.regime_iva || t('officialReport.generalRegime', 'Geral')}</strong>
          </p>
        </div>

        <div className="text-right">
          <div className="p-12 text-center" style={{ minWidth: 170, ...boxNeutro }}>
            <span className="d-block fs-11 text-muted fw-700 text-uppercase">
              {t('officialReport.auditedPeriod', 'Exercício Auditado')}
            </span>
            <strong className="d-block fs-16 fw-800 color-primary">
              {String(mesNome).toUpperCase()} / {ano}
            </strong>
            <span
              className={`badge mt-5 px-8 py-3 ${statusBadgeClass}`}
              style={{ fontSize: 10.5, fontWeight: 700 }}
            >
              {statusBadgeText}
            </span>
          </div>
        </div>
      </div>

      {/* 1. ÂMBITO & DOCUMENTOS BASE CONFRONTADOS */}
      <div className="mb-25">
        <h6 className="text-uppercase fw-700 mb-10 color-dark" style={{ letterSpacing: '0.5px', fontSize: 13 }}>
          {t('officialReport.scopeTitle', '1. Âmbito da Auditoria & Documentos Confrontados')}
        </h6>
        <p className="mb-15 text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          {t(
            'officialReport.scopeDescription',
            'O presente parecer resulta do confronto analítico estrito entre os registos contabilísticos internos (Balancete de Verificação) e as obrigações fiscais declaradas junto da Administração Geral Tributária (Modelo 7 do IVA), ao abrigo do Código do IVA, Código Geral Tributário e Plano Geral de Contabilidade (PGC) Angolano.'
          )}
        </p>

        <div className="row">
          <div className="col-12 col-md-6 mb-12">
            <div className="p-15 h-100" style={boxNeutro}>
              <div className="fw-700 fs-13 mb-5 color-dark">
                {t('officialReport.trialBalanceTitle', '📘 Balancete de Verificação da Contabilidade')}
              </div>
              <div className="fs-12 mb-5">
                {t('officialReport.fileLabel', 'Ficheiro')}:{' '}
                <strong>{docBase.balancete?.nome || t('officialReport.notUploaded', 'Não carregado')}</strong>
              </div>
              <div className="fs-11.5 text-muted">
                {t(
                  'officialReport.trialBalanceSource',
                  'Fonte: Lançamentos das Contas 62 (Prestações de Serviço), 345 (IVA Liquidado e Suportado) e 45 (Caixa).'
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 mb-12">
            <div className="p-15 h-100" style={boxNeutro}>
              <div className="fw-700 fs-13 mb-5 color-dark">
                {t('officialReport.agtModel7Title', '🏛️ Declaração Modelo 7 da AGT (Portal do Contribuinte)')}
              </div>
              <div className="fs-12 mb-5">
                {t('officialReport.fileLabel', 'Ficheiro')}:{' '}
                <strong>{docBase.portal_agt?.nome || t('officialReport.notUploaded', 'Não carregado')}</strong>
              </div>
              <div className="fs-11.5 text-muted">
                {t(
                  'officialReport.agtModel7Source',
                  'Fonte: Comprovativo Oficial da AGT — Quadro 09 (Campos 1, 2 e 23) e Quadro 10 (Campo 37 a Pagar).'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUADRO DE CONFRONTO DIRETO DOS DADOS */}
      <div className="mb-25">
        <div className="d-flex justify-content-between align-items-center mb-10 flex-wrap" style={{ gap: 8 }}>
          <h6 className="text-uppercase fw-700 mb-0 color-dark" style={{ letterSpacing: '0.5px', fontSize: 13 }}>
            {t('officialReport.tableSectionTitle', '2. Quadro de Confronto Direto dos Dados (Balancete vs Modelo 7)')}
          </h6>
          {temAnaliseIa && (
            <div>
              <span className="badge badge-success mr-8" style={{ fontSize: 11, fontWeight: 700 }}>
                {t('officialReport.equalBadge', {
                  count: analiseIAEstruturada.iguaisCount,
                  defaultValue: `${analiseIAEstruturada.iguaisCount} Iguais`,
                })}
              </span>
              <span
                className={`badge ${analiseIAEstruturada.diferencasCount > 0 ? 'badge-danger' : 'badge-success'}`}
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                {t('officialReport.diffBadge', {
                  count: analiseIAEstruturada.diferencasCount,
                  defaultValue: `${analiseIAEstruturada.diferencasCount} Diferença(s)`,
                })}
              </span>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-bordered mb-0" style={{ fontSize: 12.5 }}>
            <thead style={{ backgroundColor: '#f4f5f7' }}>
              <tr>
                <th style={{ width: '32%' }}>{t('officialReport.thAuditPoint', 'Ponto Confrontado')}</th>
                <th style={{ width: '24%' }}>{t('officialReport.thAccounting', 'Contabilidade (Balancete)')}</th>
                <th style={{ width: '24%' }}>{t('officialReport.thAgt', 'Portal AGT (Modelo 7)')}</th>
                <th style={{ textAlign: 'center', width: '10%' }}>{t('officialReport.thStatus', 'Situação')}</th>
                <th style={{ textAlign: 'right', width: '10%' }}>{t('officialReport.thDifference', 'Diferença')}</th>
              </tr>
            </thead>
            <tbody>
              {analiseIAEstruturada?.itensConfronto && analiseIAEstruturada.itensConfronto.length > 0 ? (
                analiseIAEstruturada.itensConfronto.map((item, idx) => {
                  const isIgual = item.status === 'IGUAIS' || item.status === 'OK' || item.status === 'CONFORME';
                  return (
                    <tr key={idx}>
                      <td>
                        <strong>{item.campo}</strong>
                      </td>
                      <td>{item.contabilidade}</td>
                      <td>{item.agt}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${isIgual ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 7px' }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong className={isIgual ? 'color-success' : 'color-danger'}>
                          {item.diferenca}
                        </strong>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#9299b8', fontSize: 12 }}>
                    {!temAnaliseIa
                      ? t('officialReport.noAnalysisYet', 'O confronto de documentos ainda não foi executado para este período.')
                      : t('officialReport.noItemsFound', 'Nenhum confronto documental apurado para este período.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {analiseIAEstruturada?.observacao && (
          <div className="p-10 mt-10" style={{ ...boxNeutro, fontSize: 11.5, color: '#5a5f7d' }}>
            <strong>{t('officialReport.technicalNote', 'Nota Técnica')}:</strong> {analiseIAEstruturada.observacao}
          </div>
        )}
      </div>

      {/* 3. DIAGNÓSTICO TÉCNICO & PARECER */}
      <div className="mb-25">
        <h6 className="text-uppercase fw-700 mb-10 color-dark" style={{ letterSpacing: '0.5px', fontSize: 13 }}>
          {t('officialReport.diagnosisSectionTitle', '3. Diagnóstico Técnico & Exposição Fiscal perante a AGT')}
        </h6>

        {!temAnaliseIa ? (
          <div className="p-15" style={{ ...boxNeutro, color: '#5a5f7d', fontSize: 12.5 }}>
            {t(
              'officialReport.noDiagnosisNotice',
              'Diagnóstico técnico pendente. Execute o confronto documental entre o Balancete e a Declaração Modelo 7 para apurar riscos e conformidade.'
            )}
          </div>
        ) : (
          <>
            {analiseIAEstruturada?.diferencasDetalhadas && analiseIAEstruturada.diferencasDetalhadas.length > 0 &&
              analiseIAEstruturada.diferencasDetalhadas.map((dif, idx) => (
                <div
                  key={idx}
                  className="p-15 mb-15"
                  style={{
                    backgroundColor: '#fff9f9',
                    border: '1px solid #ffd6d6',
                    borderRadius: 8,
                  }}
                >
                  <div className="fw-700 color-danger fs-13 mb-8">
                    ⚠️ {t('officialReport.itemPoint', { num: idx + 1, defaultValue: `Ponto #${idx + 1}` })}: {dif.titulo}
                  </div>

                  <div className="row mb-8 fs-12">
                    <div className="col-6">
                      <span className="text-muted d-block">{t('officialReport.inAccounting', 'Na Contabilidade')}:</span>
                      <strong>{dif.balancete}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">{t('officialReport.inAgt', 'Na Declaração AGT')}:</span>
                      <strong>{dif.agt}</strong>
                    </div>
                  </div>

                  {dif.causas.length > 0 && (
                    <div className="mb-8">
                      <strong className="d-block color-dark fs-12 mb-3">
                        {t('officialReport.probableCause', 'Causa Provável')}:
                      </strong>
                      <ul className="mb-0 pl-20 fs-12 text-muted">
                        {dif.causas.map((c, cIdx) => (
                          <li key={cIdx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dif.riscos.length > 0 && (
                    <div className="p-10" style={{ backgroundColor: '#fff', borderRadius: 6, border: '1px solid #ffe3e3' }}>
                      <strong className="d-block color-danger fs-12 mb-3">
                        {t('officialReport.legalRisk', 'Enquadramento Legal e Risco Fiscal')}:
                      </strong>
                      <ul className="mb-0 pl-20 fs-12 color-danger">
                        {dif.riscos.map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

            {analiseIAEstruturada?.pontosIguais && analiseIAEstruturada.pontosIguais.length > 0 && (
              <div className="p-12" style={{ backgroundColor: '#f6fbf9', border: '1px solid #c8eedf', borderRadius: 8 }}>
                <strong className="color-success fs-12 d-block mb-5">
                  {t('officialReport.compliantPoints', '✓ Pontos em Plena Conformidade (Sem Risco de Autuação):')}
                </strong>
                <ul className="mb-0 pl-20 fs-12" style={{ color: '#272b41' }}>
                  {analiseIAEstruturada.pontosIguais.map((p, pIdx) => (
                    <li key={pIdx}><strong>{p}</strong></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. PLANO DE AÇÃO & REGULARIZAÇÃO */}
      {analiseIAEstruturada?.recomendacoes && analiseIAEstruturada.recomendacoes.length > 0 && (
        <div className="mb-25">
          <h6 className="text-uppercase fw-700 mb-10 color-dark" style={{ letterSpacing: '0.5px', fontSize: 13 }}>
            {t('officialReport.recommendationsSectionTitle', '4. Recomendações e Procedimentos de Regularização')}
          </h6>

          <div className="row">
            {analiseIAEstruturada.recomendacoes.map((rec) => (
              <div className="col-12 col-md-6 mb-10" key={rec.numero}>
                <div className="p-12 h-100" style={boxBranco}>
                  <div className="d-flex align-items-center mb-5" style={{ gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: '#5f63f2',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {rec.numero}
                    </span>
                    <strong className="fs-12.5 color-dark">{rec.titulo}</strong>
                  </div>
                  {rec.detalhes.length > 0 && (
                    <ul className="mb-0 pl-25 fs-11.5 text-muted">
                      {rec.detalhes.map((det, dIdx) => (
                        <li key={dIdx}>{det}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          {analiseIAEstruturada.resultadoEsperado && analiseIAEstruturada.resultadoEsperado.length > 0 && (
            <div className="p-10 mt-10" style={{ backgroundColor: '#f0fbf7', border: '1px solid #b7f4db', borderRadius: 8 }}>
              <strong className="color-success fs-12 d-block mb-3">
                {t('officialReport.expectedResult', '✓ Resultado Esperado da Regularização:')}
              </strong>
              <ul className="mb-0 pl-20 fs-11.5" style={{ color: '#1f684e' }}>
                {analiseIAEstruturada.resultadoEsperado.map((res, rIdx) => (
                  <li key={rIdx}>{res}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 5. CONCLUSÃO & TERMO DE RESPONSABILIDADE */}
      <div className="pt-20 mt-20" style={{ borderTop: '2px solid #272b41' }}>
        <h6 className="text-uppercase fw-700 mb-8 color-dark" style={{ letterSpacing: '0.5px', fontSize: 13 }}>
          {t('officialReport.conclusionSectionTitle', '5. Conclusão da Auditoria Preventiva')}
        </h6>
        <p className="mb-25 text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {t(
            'officialReport.conclusionText',
            'Este parecer técnico foi emitido por sistema automatizado de confronto documental e inteligência fiscal com base nos documentos oficiais fornecidos. O objetivo é a regularização voluntária antes de qualquer ação inspetiva da AGT, garantindo a integridade fiscal da empresa.'
          )}
        </p>

        <div className="row pt-15">
          <div className="col-6 text-center">
            <div className="mx-auto pt-10" style={{ width: '80%', borderTop: '1px solid #9299b8' }}>
              <div className="fs-12 fw-700 color-dark">
                {t('officialReport.accountantSignature', 'O Contabilista Responsável')}
              </div>
              <div className="fs-11 text-muted">
                {t('officialReport.accountantSub', 'Conferência Técnica e Regularização')}
              </div>
            </div>
          </div>
          <div className="col-6 text-center">
            <div className="mx-auto pt-10" style={{ width: '80%', borderTop: '1px solid #9299b8' }}>
              <div className="fs-12 fw-700 color-dark">
                {t('officialReport.managementSignature', 'A Gerência / Administração')}
              </div>
              <div className="fs-11 text-muted">
                {t('officialReport.managementSub', 'Toma de Conhecimento e Aprovação')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatorioParecer;
