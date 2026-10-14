import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { usePeriodo } from '../context/PeriodoContext';

/**
 * Fonte única dos números da auditoria.
 *
 * Antes, `/dashboard`, `/relatorios` e `/motores` pediam cada um o mesmo
 * endpoint e guardavam o resultado no seu próprio estado. Bastava carregar um
 * documento numa página para as outras ficarem desactualizadas até se fazer
 * refresh. Agora todas as páginas consomem este hook e a mesma versão dos
 * dados, e `recarregar()` depois de um upload actualiza o sistema inteiro.
 */

let versaoGlobal = 0;
const subscritores = new Set();

/** Avisa todas as páginas montadas de que os dados mudaram. */
export const invalidarAuditoria = () => {
  versaoGlobal += 1;
  subscritores.forEach((notificar) => notificar(versaoGlobal));
};

export const useAuditoria = () => {
  const { empresaId, ano, mes } = usePeriodo();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(versaoGlobal);

  useEffect(() => {
    subscritores.add(setVersao);
    return () => subscritores.delete(setVersao);
  }, []);

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setDados(null);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api.get(
        `/auditoria/${empresaId}/${ano}/${mes}/numeros/`
      );
      setDados(resposta.data);
    } catch (e) {
      setErro(
        e.response?.data?.error || 'Não foi possível carregar os números.'
      );
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [empresaId, ano, mes]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  return { dados, carregando, erro, recarregar: carregar };
};

export default useAuditoria;
