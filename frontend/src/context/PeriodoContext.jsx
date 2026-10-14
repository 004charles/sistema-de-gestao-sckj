import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { empresaService } from '../services/api';

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

  const [empresas, setEmpresas] = useState([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);

  const carregarEmpresas = useCallback(async () => {
    const user = localStorage.getItem('user');
    if (!user) return [];
    setCarregandoEmpresas(true);
    try {
      const res = await empresaService.getAll();
      const lista = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setEmpresas(lista);
      if (lista.length > 0) {
        setPeriodo((atual) => {
          const existe = lista.some((e) => String(e.id) === String(atual.empresaId));
          if (!existe) {
            const sckj = lista.find((e) => e.nif === '5002830280');
            return { ...atual, empresaId: String(sckj ? sckj.id : lista[0].id) };
          }
          return atual;
        });
      } else {
        setPeriodo((atual) => ({ ...atual, empresaId: '' }));
      }
      return lista;
    } catch (err) {
      console.warn('Erro ao carregar empresas no contexto:', err);
      return [];
    } finally {
      setCarregandoEmpresas(false);
    }
  }, []);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

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

  const empresaAtual = empresas.find((e) => String(e.id) === String(periodo.empresaId)) || null;

  const valor = React.useMemo(
    () => ({
      ...periodo,
      empresas,
      empresaAtual,
      carregandoEmpresas,
      carregarEmpresas,
      atualizar,
      escolherSeAusente,
    }),
    [periodo, empresas, empresaAtual, carregandoEmpresas, carregarEmpresas, atualizar, escolherSeAusente]
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
