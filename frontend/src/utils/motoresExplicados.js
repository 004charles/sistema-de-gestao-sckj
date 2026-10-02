/**
 * Explicações simples e sem jargão excessivo para os 15 motores de auditoria fiscal.
 * Permite que empresários, gerentes e utilizadores sem formação em contabilidade
 * compreendam exatamente o que cada módulo faz e o que evita.
 */

export const MOTORES_INFO_AMIGAVEL = {
  M1: {
    codigo: 'M1',
    tituloSimples: '1. IVA das Vendas e Compras',
    subtitulo: 'Verifica se o imposto das faturas bate com a declaração da AGT',
    oQueFaz: 'Compara o IVA que a empresa cobrou aos clientes nas vendas com o IVA que pagou nas compras, e confere se a conta bate certo com a declaração Modelo 7 enviada à AGT.',
    oQueEvita: 'Evita multas por declarar menos IVA do que o faturado ou pagar imposto em duplicado.',
    dicaSimples: 'Basta ter o Balancete da contabilidade e o Modelo 7 do Portal da AGT.',
  },
  M2: {
    codigo: 'M2',
    tituloSimples: '2. Salários e IRT dos Funcionários',
    subtitulo: 'Verifica o imposto descontado nos ordenados dos trabalhadores',
    oQueFaz: 'Confere se os salários registados na contabilidade tiveram o devido desconto de IRT e se o imposto retido foi pago ao Estado por guia DAR.',
    oQueEvita: 'Evita juros de mora e penalidades por não entregar os descontos dos salários à AGT.',
    dicaSimples: 'Garante que os descontos nos recibos de vencimento foram entregues às Finanças.',
  },
  M3: {
    codigo: 'M3',
    tituloSimples: '3. Imposto sobre o Lucro (Industrial)',
    subtitulo: 'Confere o imposto da empresa e os descontos feitos pelos clientes',
    oQueFaz: 'Verifica se os clientes retiveram imposto quando pagaram faturas à sua empresa (para abater no Modelo 1 anual) e identifica despesas que a AGT não aceita como custo.',
    oQueEvita: 'Evita perder dinheiro de créditos fiscais e identifica despesas com multas que a AGT rejeita.',
    dicaSimples: 'Ajuda a empresa a pagar apenas o imposto justo sobre o lucro real.',
  },
  M4: {
    codigo: 'M4',
    tituloSimples: '4. Retenções de 6,5% a Prestadores',
    subtitulo: 'Confere o desconto obrigatório nos pagamentos de serviços',
    oQueFaz: 'A lei angolana manda descontar 6,5% sempre que pagar honorários ou serviços a empresas e prestadores independentes. Este teste avisa se faltou reter.',
    oQueEvita: 'Evita que a sua empresa seja obrigada a pagar do seu próprio bolso os 6,5% que devia ter descontado ao fornecedor.',
    dicaSimples: 'Protege a empresa de assumir dívidas fiscais dos prestadores de serviço.',
  },
  M5: {
    codigo: 'M5',
    tituloSimples: '5. Segurança Social (INSS)',
    subtitulo: 'Verifica as contribuições dos funcionários e da empresa',
    oQueFaz: 'Verifica se os 8% da empresa e os 3% dos trabalhadores foram bem calculados sobre os salários e entregues à Segurança Social.',
    oQueEvita: 'Evita coimas e bloqueios de certidões por dívidas ao INSS.',
    dicaSimples: 'Garante que a empresa está em dia com a proteção social dos empregados.',
  },
  M6: {
    codigo: 'M6',
    tituloSimples: '6. Imposto do Selo',
    subtitulo: 'Verifica os recibos de quitação e contratos sujeitos a selo',
    oQueFaz: 'Verifica as operações que não pagam IVA mas têm de pagar 1% de Imposto do Selo (como recibos de quitação e contratos comerciais).',
    oQueEvita: 'Evita penalidades por falta de pagamento da taxa de selo em recibos comerciais.',
    dicaSimples: 'Confronta os recibos emitidos com a tabela geral do imposto do selo.',
  },
  M7: {
    codigo: 'M7',
    tituloSimples: '7. Faturação e Vendas',
    subtitulo: 'Confere se as faturas estão contínuas e sem saltos de números',
    oQueFaz: 'Analisa o volume faturado e confere se a numeração das faturas é contínua e se o software de faturação está devidamente certificado pela AGT.',
    oQueEvita: 'Evita que a AGT anule faturas ou multe o sistema informático por faturas fora de ordem.',
    dicaSimples: 'Garante que nenhuma fatura foi apagada ou emitida fora da sequência legal.',
  },
  M8: {
    codigo: 'M8',
    tituloSimples: '8. Erros Contabilísticos (Caixa e Contas)',
    subtitulo: 'Detecta erros graves nos livros, como Caixa Negativo',
    oQueFaz: 'Verifica se o dinheiro em caixa faz sentido. Uma conta de Caixa nunca pode ficar negativa (dinheiro não sai do nada). Se estiver negativa, o sistema avisa imediatamente.',
    oQueEvita: 'Evita inspeção fiscal imediata por incongruência material grave na escrita da empresa.',
    dicaSimples: 'Detecta na hora se o dinheiro físico do cofre está mal registado.',
  },
  M9: {
    codigo: 'M9',
    tituloSimples: '9. Contas Bancárias vs Extratos',
    subtitulo: 'Confere se o saldo dos bancos nos livros bate com os extratos',
    oQueFaz: 'Cruza os saldos das contas bancárias que constam na contabilidade com o dinheiro real que consta nos extratos dos bancos.',
    oQueEvita: 'Evita saídas de dinheiro sem justificação e diferenças nos pagamentos a fornecedores.',
    dicaSimples: 'Garante que cada kwanza que saiu do banco tem uma fatura correspondente.',
  },
  M10: {
    codigo: 'M10',
    tituloSimples: '10. Termómetro de Risco Fiscal',
    subtitulo: 'Mede a probabilidade de a empresa ser fiscalizada pela AGT',
    oQueFaz: 'Junta todos os problemas encontrados em todos os impostos e calcula o nível de perigo geral da empresa receber uma notificação da fiscalização.',
    oQueEvita: 'Permite à gerência saber onde agir primeiro para proteger a empresa.',
    dicaSimples: 'Mostra num semáforo se a empresa está segura ou se corre perigo de inspeção.',
  },
  M11: {
    codigo: 'M11',
    tituloSimples: '11. Controlo de Prazos da AGT',
    subtitulo: 'Avisa se alguma declaração ou imposto está a passar do prazo',
    oQueFaz: 'Compara as datas das declarações com os prazos oficiais da AGT (ex: final do mês para IVA, dia 10 para INSS) para garantir que nada fica esquecido.',
    oQueEvita: 'Elimina o pagamento desnecessário de juros de mora e coimas por entrega fora do prazo.',
    dicaSimples: 'Um calendário inteligente que não deixa passar as datas limites do Estado.',
  },
  M12: {
    codigo: 'M12',
    tituloSimples: '12. Cálculo de Risco em Dinheiro (Kz)',
    subtitulo: 'Mostra o total em Kwanzas que a empresa arrisca pagar em multas',
    oQueFaz: 'Soma em Kwanzas o valor estimado de todas as correções e diferenças que a AGT pode vir a cobrar se fizer uma inspeção.',
    oQueEvita: 'Dá um número concreto e em dinheiro para os sócios e diretores saberem o tamanho do risco.',
    dicaSimples: 'Transforma erros contabilísticos em valores reais de dinheiro em risco.',
  },
  M13: {
    codigo: 'M13',
    tituloSimples: '13. Enganos Comuns na Escrita',
    subtitulo: 'Detecta enganos como colocar IVA como despesa direta',
    oQueFaz: 'Descobre falhas frequentes de lançamento, como colocar IVA suportado como custo a fundo perdido em vez de o recuperar nas Finanças.',
    oQueEvita: 'Evita perder dinheiro que a empresa tem direito a receber de volta da AGT.',
    dicaSimples: 'Ajuda o contabilista a recuperar impostos que a empresa pagou nas compras.',
  },
  M14: {
    codigo: 'M14',
    tituloSimples: '14. Comparação com Meses Anteriores',
    subtitulo: 'Mostra se as vendas e despesas estão a subir ou a descer normalmente',
    oQueFaz: 'Compara a faturação e os impostos deste mês com os meses anteriores para detetar subidas ou descidas bruscas que possam chamar a atenção da AGT.',
    oQueEvita: 'Evita surpresas e prepara a empresa para justificar oscilações de mercado.',
    dicaSimples: 'Alerta se os gastos ou vendas tiverem uma variação anormal sem explicação.',
  },
  M15: {
    codigo: 'M15',
    tituloSimples: '15. Relatório Pronto para a Gerência',
    subtitulo: 'Gera um documento simples e direto para o patrão e o contabilista',
    oQueFaz: 'Reúne todo o resultado da conferência num relatório claro, com linguagem direta e conselhos práticos sobre o que deve ser feito.',
    oQueEvita: 'Facilita o diálogo entre o empresário e o contabilista sem necessidade de conhecimentos técnicos profundos.',
    dicaSimples: 'Pronto para imprimir ou enviar por WhatsApp/Email à administração.',
  },
};

export const ESTADOS_OCORRENCIA_SIMPLES = [
  { valor: 'POR_REVER', label: 'Pendente de Análise (Ainda não foi visto)' },
  { valor: 'CONFIRMADO', label: 'Confirmado com o Contabilista (Existe a diferença)' },
  { valor: 'JUSTIFICADO', label: 'Justificado com Documento da Empresa' },
  { valor: 'CORRIGIDO', label: 'Já Foi Corrigido na Contabilidade / AGT' },
  { valor: 'FALSO_POSITIVO', label: 'Não se Aplica à Nossa Atividade' },
];

export const getMotorAmigavel = (codigo) => {
  return MOTORES_INFO_AMIGAVEL[codigo] || {
    codigo,
    tituloSimples: `Módulo ${codigo}`,
    subtitulo: 'Verificação fiscal e contabilística',
    oQueFaz: 'Analisa a conformidade dos dados registados.',
    oQueEvita: 'Evita divergências fiscais perante a AGT.',
    dicaSimples: 'Consulte os detalhes abaixo.',
  };
};

export const MOTORES_EXPLICADOS = Object.fromEntries(
  Object.entries(MOTORES_INFO_AMIGAVEL).map(([k, v]) => [
    k,
    {
      ...v,
      tituloAmigavel: v.tituloSimples,
      subtituloAmigavel: v.subtitulo,
    },
  ])
);

