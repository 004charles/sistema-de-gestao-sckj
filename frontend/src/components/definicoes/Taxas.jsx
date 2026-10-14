import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { kzExacto } from '../../utils/formato';

/**
 * Tabela de taxas e regimes em vigor.
 *
 * Vinha escrita à mão no JSX, o que a fazia envelhecer sem ninguém dar conta
 * — e divergir das percentagens que os motores realmente usavam. Agora vem de
 * `/api/taxas/`, da mesma tabela que o Rule Engine consulta: o que se lê aqui
 * é exactamente o que o sistema aplica.
 */

const pct = (taxa) => `${(Number(taxa) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

const Seccao = ({ titulo, children }) => (
  <div style={{ marginBottom: 26 }}>
    <h6
      className="fw-600 color-dark mb-10"
      style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {titulo}
    </h6>
    {children}
  </div>
);

const Tabela = ({ cabecalhos, linhas }) => (
  <div className="table-responsive">
    <table className="table table-bordered mb-0" style={{ fontSize: 13 }}>
      <thead style={{ background: '#f9fafb' }}>
        <tr>
          {cabecalhos.map((c) => (
            <th key={c} style={{ fontSize: 12 }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i}>
            {linha.map((celula, j) => (
              <td key={j}>{celula}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Taxas = () => {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/taxas/')
      .then((r) => setDados(r.data))
      .catch(() => setErro('Não foi possível carregar a tabela de taxas.'));
  }, []);

  if (erro) {
    return <div className="alert alert-danger">{erro}</div>;
  }
  if (!dados) {
    return <p className="text-muted" style={{ fontSize: 13 }}>A carregar...</p>;
  }

  return (
    <div className="card card-default">
      <div className="card-body" style={{ padding: 24 }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap mb-20">
          <div>
            <h5 className="fw-700 color-dark mb-2" style={{ fontSize: 15 }}>
              Taxas e regimes em vigor
            </h5>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              São estas as percentagens que os motores aplicam.
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              background: '#f4f5fb',
              padding: '4px 12px',
              borderRadius: 12,
            }}
          >
            {dados.vigencia}
          </span>
        </div>

        <Seccao titulo="Regimes de IVA">
          <Tabela
            cabecalhos={['Regime', 'Quando se aplica', 'Como paga']}
            linhas={dados.regimes_iva.map((r) => [
              <strong>{r.nome}</strong>,
              r.limite,
              r.resumo,
            ])}
          />
        </Seccao>

        <Seccao titulo="Taxas de IVA">
          <Tabela
            cabecalhos={['Taxa', 'Operação', 'Base legal']}
            linhas={dados.iva.map((t) => [
              <strong>{pct(t.taxa)}</strong>,
              t.descricao,
              <span style={{ fontSize: 11.5 }} className="text-muted">
                {t.base_legal}
              </span>,
            ])}
          />
        </Seccao>

        <Seccao titulo="Imposto Industrial">
          <Tabela
            cabecalhos={['Taxa', 'Aplica-se a', 'Base legal']}
            linhas={dados.imposto_industrial.map((t) => [
              <strong>{pct(t.taxa)}</strong>,
              t.descricao,
              <span style={{ fontSize: 11.5 }} className="text-muted">
                {t.base_legal}
              </span>,
            ])}
          />
        </Seccao>

        <Seccao titulo={`IRT — isento até ${kzExacto(dados.irt.isencao_mensal)} Kz/mês`}>
          <Tabela
            cabecalhos={['Até (Kz)', 'Parcela fixa', 'Taxa', 'Sobre o excesso de']}
            linhas={dados.irt.escaloes.map((e) => [
              e.ate ? kzExacto(e.ate) : 'acima',
              kzExacto(e.parcela_fixa),
              pct(e.taxa),
              kzExacto(e.excesso_sobre),
            ])}
          />
          <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            {dados.irt.base_legal} · Grupo B (prestadores): {pct(dados.irt.grupo_b)}
          </p>
        </Seccao>

        <Seccao titulo="Outras taxas">
          <Tabela
            cabecalhos={['Taxa', 'Descrição']}
            linhas={[
              [
                <strong>{pct(dados.seguranca_social.patronal)}</strong>,
                `Segurança Social — entidade patronal (${dados.seguranca_social.base_legal})`,
              ],
              [
                <strong>{pct(dados.seguranca_social.trabalhador)}</strong>,
                'Segurança Social — trabalhador, retido no salário',
              ],
              [
                <strong>{pct(dados.retencao_servicos)}</strong>,
                'Retenção na fonte sobre prestações de serviço',
              ],
              [
                <strong>{pct(dados.imposto_predial.arrendamento_efectiva)}</strong>,
                `Imposto Predial sobre rendas — ${pct(
                  dados.imposto_predial.arrendamento_nominal
                )} sobre ${pct(1 - Number(dados.imposto_predial.deducao_conservacao))} da renda`,
              ],
              [
                <strong>{pct(dados.imposto_selo_quitacao)}</strong>,
                'Imposto do Selo sobre quitações não sujeitas a IVA',
              ],
            ]}
          />
        </Seccao>

        <p
          className="text-muted mb-0"
          style={{ fontSize: 11.5, borderTop: '1px solid #eef0f3', paddingTop: 12 }}
        >
          <i className="la la-info-circle mr-5"></i>
          {dados.aviso}
        </p>
      </div>
    </div>
  );
};

export default Taxas;
