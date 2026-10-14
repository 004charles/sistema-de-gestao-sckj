import React from 'react';
import Configuracoes from './Configuracoes';

/**
 * Definições — tudo o que se configura uma vez e depois se esquece.
 *
 * Reúne o que estava espalhado por três páginas (Empresas, Configurações e
 * Perfil) mais a validação das regras, que vivia dentro dos Motores. São
 * quatro separadores: empresa, perfil, parâmetros fiscais e regras.
 */
const Definicoes = () => <Configuracoes />;

export default Definicoes;
