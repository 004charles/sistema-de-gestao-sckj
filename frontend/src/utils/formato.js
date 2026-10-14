/**
 * Formatação de números para leitura rápida.
 *
 * O princípio desta interface é que o número se lê antes da frase. Por isso
 * os valores aparecem sem casas decimais quando são grandes: "61.928 Kz"
 * lê-se de relance, "61.928,16 Kz" obriga a parar. O valor exacto continua
 * disponível no detalhe de cada linha.
 */

const NBSP = ' ';

/** 1395911.22 -> "1.395.911" (sem decimais, para os números grandes do topo) */
export const kz = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 })
    .format(Math.round(numero));
};

/** 1395911.22 -> "1.395.911,22" (exacto, para tabelas e detalhe) */
export const kzExacto = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
};

/** Valor com a moeda colada, para os cartões. */
export const kzComMoeda = (valor) => `${kz(valor)}${NBSP}Kz`;

/** Diferença com sinal explícito: "-500" ou "+500". */
export const diferenca = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero === 0) return null;
  return `${numero > 0 ? '+' : '−'}${kz(Math.abs(numero))}${NBSP}Kz`;
};

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const nomeMes = (mes) => MESES[Number(mes) - 1] || '';

/** "faltam 6 dias" / "venceu há 3 dias" / "é hoje" */
export const prazoEmPalavras = (dias) => {
  if (dias === null || dias === undefined) return '';
  if (dias === 0) return 'é hoje';
  if (dias > 0) return `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const atraso = Math.abs(dias);
  return `venceu há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`;
};

/** Data ISO -> "31/08/2026" */
export const data = (iso) => {
  if (!iso) return '—';
  const [ano, mes, dia] = String(iso).split('-');
  return `${dia}/${mes}/${ano}`;
};
