import React from 'react';
import { prazoEmPalavras, data as formatarData } from '../../utils/formato';

/**
 * O que falta entregar e quando vence.
 *
 * Era a maior lacuna do sistema: sabia comentar o passado, não sabia avisar
 * do que vinha a seguir. Em Angola, evitar problemas é sobretudo cumprir
 * prazos, por isso esta faixa fica logo abaixo dos números.
 */

const NOMES = {
  IVA: 'IVA',
  IRT: 'IRT',
  INSS: 'Segurança Social',
  RETENCOES: 'Retenções',
};

const ESTADOS = {
  VENCIDA: { cor: '#ff4d4f', fundo: '#fff1f0', icone: 'la-exclamation-triangle' },
  A_VENCER: { cor: '#fa8b0c', fundo: '#fff7e6', icone: 'la-clock' },
  PENDENTE: { cor: '#5a5f7d', fundo: '#f8f9fb', icone: 'la-calendar' },
  CUMPRIDA: { cor: '#20c997', fundo: '#f0fdf9', icone: 'la-check' },
  CUMPRIDA_FORA_PRAZO: { cor: '#fa8b0c', fundo: '#fff7e6', icone: 'la-check' },
};

const Cartao = ({ obrigacao }) => {
  const estilo = ESTADOS[obrigacao.estado] || ESTADOS.PENDENTE;
  const cumprida = obrigacao.estado.startsWith('CUMPRIDA');
  const atrasada = obrigacao.estado === 'CUMPRIDA_FORA_PRAZO';

  let legenda;
  if (atrasada) {
    const dias = Math.abs(
      Math.round(
        (new Date(obrigacao.data_cumprimento) - new Date(obrigacao.data_limite))
          / 86400000
      )
    );
    legenda = `entregue ${dias} ${dias === 1 ? 'dia' : 'dias'} depois`;
  } else if (cumprida) {
    legenda = 'entregue no prazo';
  } else {
    legenda = prazoEmPalavras(obrigacao.dias);
  }

  const rotuloImposto = () => {
    if (obrigacao.imposto === 'IVA') {
      return obrigacao.tipo === 'DECLARACAO' ? 'IVA (Modelo 7)' : 'IVA (Pagamento)';
    }
    if (obrigacao.imposto === 'IRT') {
      return 'IRT (Pagamento)';
    }
    if (obrigacao.imposto === 'INSS') {
      return 'Segurança Social (INSS)';
    }
    if (obrigacao.imposto === 'RETENCOES') {
      return 'Retenções 6,5%';
    }
    return NOMES[obrigacao.imposto] || obrigacao.imposto;
  };

  return (
    <div
      style={{
        background: estilo.fundo,
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 170,
        flex: '1 1 170px',
      }}
    >
      <div className="d-flex align-items-center" style={{ gap: 8 }}>
        <i className={`la ${estilo.icone}`} style={{ color: estilo.cor, fontSize: 16 }}></i>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#272b41' }}>
          {rotuloImposto()}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: estilo.cor, marginTop: 4 }}>
        {legenda}
      </div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
        limite {formatarData(obrigacao.data_limite)}
      </div>
    </div>
  );
};

const Prazos = ({ prazos }) => {
  const obrigacoes = prazos?.obrigacoes || [];
  if (obrigacoes.length === 0) return null;

  // Primeiro o que está mal, depois o que está por vir, por fim o já cumprido.
  const peso = {
    VENCIDA: 0,
    A_VENCER: 1,
    CUMPRIDA_FORA_PRAZO: 2,
    PENDENTE: 3,
    CUMPRIDA: 4,
  };
  const ordenadas = [...obrigacoes].sort(
    (a, b) => (peso[a.estado] ?? 9) - (peso[b.estado] ?? 9)
  );

  return (
    <div className="card card-default">
      <div className="card-body" style={{ padding: '16px 20px' }}>
        <span
          className="text-muted d-block mb-10"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          Prazos deste período
        </span>
        <div className="d-flex flex-wrap" style={{ gap: 10 }}>
          {ordenadas.map((o) => (
            <Cartao key={o.id} obrigacao={o} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Prazos;
