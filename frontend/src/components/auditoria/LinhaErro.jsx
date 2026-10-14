import React, { useState } from 'react';
import { kzComMoeda, kzExacto, diferenca } from '../../utils/formato';

/**
 * Um erro, dito em números.
 *
 * Primeiro o valor e onde está. Depois o que fazer, numa frase. A regra, o
 * cálculo, as fontes e o artigo da lei ficam fechados em "ver detalhe": quem
 * gere a empresa não precisa deles para agir, e o contabilista encontra-os
 * onde espera.
 */

const CORES = {
  ALTO: { barra: '#ff4d4f', texto: '#ff4d4f', etiqueta: 'Corrigir já' },
  MEDIO: { barra: '#fa8b0c', texto: '#fa8b0c', etiqueta: 'Rever' },
  BAIXO: { barra: '#5f63f2', texto: '#5f63f2', etiqueta: 'Confirmar' },
  INFORMATIVO: { barra: '#a0a4b8', texto: '#8c90a4', etiqueta: 'Nota' },
};

const Comparacao = ({ tem, devia, dif }) => {
  if (tem === null && devia === null) return null;
  return (
    <div
      className="d-flex flex-wrap align-items-baseline"
      style={{ gap: 20, marginTop: 10 }}
    >
      {tem !== null && (
        <div>
          <span className="text-muted d-block" style={{ fontSize: 11 }}>
            Tem
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{kzExacto(tem)}</span>
        </div>
      )}
      {devia !== null && (
        <div>
          <span className="text-muted d-block" style={{ fontSize: 11 }}>
            Devia ter
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{kzExacto(devia)}</span>
        </div>
      )}
      {dif && (
        <div>
          <span className="text-muted d-block" style={{ fontSize: 11 }}>
            Diferença
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4f' }}>
            {dif}
          </span>
        </div>
      )}
    </div>
  );
};

const Detalhe = ({ detalhe }) => (
  <div
    style={{
      marginTop: 14,
      paddingTop: 14,
      borderTop: '1px solid #eef0f3',
      fontSize: 13,
    }}
  >
    <p className="mb-10" style={{ color: '#5a5f7d' }}>
      {detalhe.descricao || detalhe.nome_regra}
    </p>

    {detalhe.calculo && (
      <div className="mb-10">
        <span className="text-muted d-block" style={{ fontSize: 11 }}>
          Cálculo
        </span>
        <code style={{ fontSize: 12 }}>{detalhe.calculo}</code>
      </div>
    )}

    {detalhe.valores && Object.keys(detalhe.valores).length > 0 && (
      <div className="mb-10">
        <span className="text-muted d-block mb-5" style={{ fontSize: 11 }}>
          Valores usados
        </span>
        <div className="d-flex flex-wrap" style={{ gap: '4px 18px' }}>
          {Object.entries(detalhe.valores).map(([chave, valor]) => (
            <span key={chave} style={{ fontSize: 12 }}>
              <span className="text-muted">{chave}:</span>{' '}
              <strong>{valor}</strong>
            </span>
          ))}
        </div>
      </div>
    )}

    {detalhe.fontes?.length > 0 && (
      <div className="mb-10">
        <span className="text-muted d-block mb-5" style={{ fontSize: 11 }}>
          Documentos usados
        </span>
        {detalhe.fontes.map((fonte, i) => (
          <div key={i} style={{ fontSize: 12 }}>
            <i className="la la-file-alt mr-5 text-muted"></i>
            {fonte.nome}
          </div>
        ))}
      </div>
    )}

    {detalhe.referencia_legal && (
      <div>
        <span className="text-muted d-block" style={{ fontSize: 11 }}>
          Base legal
        </span>
        <span style={{ fontSize: 12 }}>{detalhe.referencia_legal}</span>
        {detalhe.requer_validacao_juridica && (
          <span
            className="d-block"
            style={{ fontSize: 11, color: '#fa8b0c', marginTop: 4 }}
          >
            <i className="la la-exclamation-circle mr-5"></i>
            Base legal ainda por validar juridicamente.
          </span>
        )}
      </div>
    )}
  </div>
);

const LinhaErro = ({ linha }) => {
  const [aberto, setAberto] = useState(false);
  const cor = CORES[linha.gravidade] || CORES.INFORMATIVO;
  const valor = Number(linha.valor || 0);
  const dif = diferenca(linha.diferenca);

  return (
    <div
      className="card card-default mb-15"
      style={{ borderLeft: `4px solid ${cor.barra}` }}
    >
      <div className="card-body" style={{ padding: '18px 20px' }}>
        <div
          className="d-flex justify-content-between align-items-start flex-wrap"
          style={{ gap: 12 }}
        >
          <div style={{ flex: '1 1 260px' }}>
            {valor > 0 && (
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: cor.texto,
                  lineHeight: 1.2,
                }}
              >
                {kzComMoeda(valor)}
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#272b41',
                marginTop: valor > 0 ? 2 : 0,
              }}
            >
              {linha.onde}
            </div>
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: cor.texto,
              background: `${cor.barra}14`,
              padding: '4px 10px',
              borderRadius: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {cor.etiqueta}
          </span>
        </div>

        <Comparacao
          tem={linha.tem !== null ? linha.tem : null}
          devia={linha.devia !== null ? linha.devia : null}
          dif={dif}
        />

        {linha.accao && (
          <p
            className="mb-0"
            style={{ fontSize: 13, color: '#5a5f7d', marginTop: 12 }}
          >
            <i className="la la-arrow-right mr-5" style={{ color: cor.texto }}></i>
            {linha.accao}
          </p>
        )}

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setAberto((v) => !v)}
          style={{
            padding: 0,
            marginTop: 10,
            background: 'none',
            border: 'none',
            color: '#5f63f2',
            fontSize: 12,
          }}
        >
          {aberto ? 'esconder detalhe' : 'ver detalhe e lei'}
          <i className={`la la-angle-${aberto ? 'up' : 'down'} ml-5`}></i>
        </button>

        {aberto && <Detalhe detalhe={linha.detalhe || {}} />}
      </div>
    </div>
  );
};

export default LinhaErro;
