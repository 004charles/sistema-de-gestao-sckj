import React from 'react';
import { kzComMoeda } from '../../utils/formato';

/**
 * O primeiro — e, para muita gente, o único — ecrã que importa.
 *
 * Um valor grande e três contadores. Nada de parágrafos: quem abre isto quer
 * saber se tem dinheiro em risco este mês e quantas coisas há para corrigir.
 */

const Contador = ({ numero, rotulo, cor, activo, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="d-flex flex-column align-items-center"
    style={{
      background: activo ? '#f4f5fb' : 'transparent',
      border: 'none',
      borderRadius: 8,
      padding: '10px 22px',
      cursor: onClick ? 'pointer' : 'default',
      minWidth: 96,
    }}
  >
    <span style={{ fontSize: 30, fontWeight: 800, color: cor, lineHeight: 1 }}>
      {numero}
    </span>
    <span
      className="text-muted"
      style={{ fontSize: 12, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}
    >
      {rotulo}
    </span>
  </button>
);

const Numeros = ({ dados, filtro, onFiltrar }) => {
  const emRisco = Number(dados?.em_risco || 0);
  const contadores = dados?.contadores || { erros: 0, ok: 0, faltam: 0 };
  const obrigacoes = dados?.prazos?.obrigacoes || [];
  const vencidas = obrigacoes.filter((o) => o.estado === 'VENCIDA');
  const temVencidas = vencidas.length > 0;

  let rotuloSuperior = 'Em risco este mês';
  let valorPrincipal = kzComMoeda(emRisco);
  let corDestaque = '#ff4d4f';

  if (emRisco > 0) {
    rotuloSuperior = 'Em risco este mês';
    valorPrincipal = kzComMoeda(emRisco);
    corDestaque = '#ff4d4f';
  } else if (contadores.erros > 0) {
    rotuloSuperior = 'Inconformidades detectadas';
    valorPrincipal = `${contadores.erros} ${contadores.erros === 1 ? 'erro a rever' : 'erros a rever'}`;
    corDestaque = '#ff4d4f';
  } else if (temVencidas) {
    rotuloSuperior = 'Obrigações fiscais vencidas';
    valorPrincipal = `${vencidas.length} ${vencidas.length === 1 ? 'obrigação em atraso' : 'obrigações em atraso'}`;
    corDestaque = '#ff4d4f';
  } else if (contadores.faltam > 0) {
    rotuloSuperior = contadores.ok === 0 ? 'Auditoria pendente' : 'Documentos pendentes';
    valorPrincipal = `${contadores.faltam} ${contadores.faltam === 1 ? 'documento em falta' : 'documentos em falta'}`;
    corDestaque = '#fa8b0c';
  } else {
    rotuloSuperior = 'Situação regular';
    valorPrincipal = 'Tudo certo';
    corDestaque = '#20c997';
  }

  return (
    <div
      className="card card-default"
      style={{ borderTop: `3px solid ${corDestaque}` }}
    >
      <div className="card-body text-center" style={{ padding: '28px 20px 18px' }}>
        <span
          className="text-muted d-block"
          style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {rotuloSuperior}
        </span>

        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.15,
            margin: '10px 0 4px',
            color: corDestaque,
          }}
        >
          {valorPrincipal}
        </div>

        <div
          className="d-flex justify-content-center flex-wrap"
          style={{ gap: 4, marginTop: 14 }}
        >
          <Contador
            numero={contadores.erros}
            rotulo={contadores.erros === 1 ? 'erro' : 'erros'}
            cor={contadores.erros > 0 ? '#ff4d4f' : '#a0a4b8'}
            activo={filtro === 'erros'}
            onClick={onFiltrar ? () => onFiltrar('erros') : undefined}
          />
          <Contador
            numero={contadores.ok}
            rotulo="OK"
            cor="#20c997"
            activo={filtro === 'ok'}
            onClick={onFiltrar ? () => onFiltrar('ok') : undefined}
          />
          <Contador
            numero={contadores.faltam}
            rotulo="faltam"
            cor={contadores.faltam > 0 ? '#fa8b0c' : '#a0a4b8'}
            activo={filtro === 'faltam'}
            onClick={onFiltrar ? () => onFiltrar('faltam') : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default Numeros;
