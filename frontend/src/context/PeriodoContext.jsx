import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const CHAVE = 'periodoAuditoria';

const PeriodoContext = createContext(null);

const predefinido = () => ({
  empresaId: '',
  ano: String(new Date().getFullYear()),
  mes: '7',
});

export const PeriodoProvider = ({ children }) => {
  const [periodo, setPeriodo] = useState(() => {
    const base = predefinido();
    try {
      const guardado = JSON.parse(window.localStorage.getItem(CHAVE));
      if (guardado && typeof guardado === 'object') {
        return { ...base, ...guardado };
      }
    } catch (e) {
      // guarda corrompida — usa predefinição
    }
    return base;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(periodo));
    } catch (e) {
      // sem localStorage disponível
    }
  }, [periodo]);

  const atualizar = useCallback((parcial) => {
    setPeriodo((atual) => ({ ...atual, ...parcial }));
  }, []);

  const escolherSeAusente = useCallback((parcial) => {
    setPeriodo((atual) => {
      const emFalta = Object.keys(parcial).filter(
        (chave) => !atual[chave]
      );
      if (emFalta.length === 0) return atual;
      const novo = { ...atual };
      emFalta.forEach((chave) => {
        novo[chave] = parcial[chave];
      });
      return novo;
    });
  }, []);

  const valor = React.useMemo(
    () => ({ ...periodo, atualizar, escolherSeAusente }),
    [periodo, atualizar, escolherSeAusente]
  );

  return <PeriodoContext.Provider value={valor}>{children}</PeriodoContext.Provider>;
};

export const usePeriodo = () => useContext(PeriodoContext);

/** Semeia o contexto com ?empresa=&ano=&mes= uma única vez (montagem). */
export const usePeriodoDaUrl = () => {
  const [searchParams] = useSearchParams();
  const contexto = usePeriodo();

  useEffect(() => {
    if (!contexto) return;
    const parcial = {};
    const empresa = searchParams.get('empresa');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');
    if (empresa) parcial.empresaId = empresa;
    if (ano) parcial.ano = ano;
    if (mes) parcial.mes = mes;
    if (Object.keys(parcial).length > 0) {
      contexto.atualizar(parcial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
