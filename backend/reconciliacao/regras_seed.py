"""Seed conservador de regras dos 15 motores de auditoria (§12 a §26).

Regra de Ouro: nenhuma regra sem base legal. Todas as entradas nascem com
`estado_validacao='POR_VALIDAR'` e base legal `validado_juridicamente=False`
(até validação do utilizador — decisão 2) e são inofensivas sem dados.
Nenhum texto usa vocabulário proibido ("fraude", "multa definitiva").
Idempotente: `update_or_create` por código.
"""
from .models import BaseLegal, Motor, Regra
from .motores_seed import MOTORES

_BASES = {
    'BL-IVA-001': {
        'legislacao': 'Código do IVA — Lei n.º 7/19 e Lei n.º 42/20',
        'artigo': 'Art. 26.º — Obrigação de entrega da declaração periódica (Modelo 7)',
        'texto': 'O sujeito passivo deve apresentar a declaração periódica de IVA relativa aos factos tributáveis do período até ao último dia do mês seguinte.',
    },
    'BL-IVA-002': {
        'legislacao': 'Plano Geral de Contabilidade (PGC) — Decreto n.º 82/01',
        'artigo': 'Princípios Contabilísticos e Escrituração Analítica',
        'texto': 'A escrituração deve reflectir as operações do período em bases comparáveis com as declarações fiscais submetidas.',
    },
    'BL-IVA-003': {
        'legislacao': 'Código do IVA — Lei n.º 7/19 e Lei n.º 42/20',
        'artigo': 'Art. 19.º e 21.º — Coerência interna do apuramento de IVA',
        'texto': 'Os valores declarados de IVA liquidado, dedutível e apurado devem ser internamente coerentes.',
    },
    'BL-IVA-004': {
        'legislacao': 'Código do IVA — Lei n.º 7/19 e Lei n.º 42/20',
        'artigo': 'Art. 27.º — Confronto entre declaração e escrituração',
        'texto': 'A declaração submetida deve corresponder fidedignamente aos lançamentos constantes do balancete analítico.',
    },
    'BL-IVA-005': {
        'legislacao': 'Código do IVA — Lei n.º 7/19 e Lei n.º 42/20',
        'artigo': 'Art. 21.º — Condições de dedutibilidade do IVA suportado',
        'texto': 'Só confere direito à dedução o imposto que conste de facturas emitidas na forma legal. IVA suportado não deduzido requer verificação.',
    },
    'BL-IVA-006': {
        'legislacao': 'Código do IVA — Lei n.º 7/19 e Lei n.º 42/20',
        'artigo': 'Art. 3.º e 4.º — Base tributável de transmissões e prestações de serviço',
        'texto': 'O volume de prestações de serviço e transmissões de bens escriturado deve coincidir com o valor tributável declarado.',
    },
    'BL-IRT-001': {
        'legislacao': 'Código do Imposto sobre o Rendimento do Trabalho — Lei n.º 18/14 e Lei n.º 28/20',
        'artigo': 'Art. 1.º e 19.º — Incidência e retenção na fonte sobre remunerações de pessoal',
        'texto': 'As entidades patronais devem proceder à retenção na fonte do IRT incidente sobre as remunerações pagas aos trabalhadores.',
    },
    'BL-IRT-002': {
        'legislacao': 'Código do IRT — Lei n.º 18/14 e Lei n.º 28/20',
        'artigo': 'Art. 20.º — Entrega do imposto retido e mapa mensal',
        'texto': 'O montante do IRT retido deve ser entregue à Repartição Fiscal competente acompanhado da respectiva declaração.',
    },
    'BL-II-001': {
        'legislacao': 'Código do Imposto Industrial — Lei n.º 19/14 e Lei n.º 26/20',
        'artigo': 'Art. 71.º — Retenções na fonte de clientes e créditos fiscais',
        'texto': 'As retenções sofridas de clientes constituem crédito fiscal dedutível à colecta do Imposto Industrial.',
    },
    'BL-RET-001': {
        'legislacao': 'Código do Imposto Industrial — Lei n.º 19/14 e Lei n.º 26/20',
        'artigo': 'Art. 67.º — Retenção na fonte de 6,5% sobre prestação de serviços',
        'texto': 'Estão sujeitos a retenção na fonte à taxa de 6,5% os pagamentos respeitantes a prestação de serviços efectuados por pessoas colectivas ou profissionais independentes residentes.',
    },
    'BL-SS-001': {
        'legislacao': 'Lei da Protecção Social — Lei n.º 07/04 e Decreto Presidencial n.º 227/18',
        'artigo': 'Art. 14.º — Contribuições para a Segurança Social (INSS 8% + 3%)',
        'texto': 'A entidade patronal é responsável pelo pagamento da contribuição patronal (8%) e pela retenção da contribuição do trabalhador (3%).',
    },
    'BL-SEL-001': {
        'legislacao': 'Código do Imposto do Selo — Decreto Legislativo Presidencial n.º 3/14',
        'artigo': 'Tabela Geral do Imposto do Selo — Operações e Recibos de Quitação',
        'texto': 'Estão sujeitas a Imposto do Selo as operações, actos e contratos previstos na Tabela Geral, nomeadamente quitações de operações não sujeitas a IVA.',
    },
    'BL-FAC-001': {
        'legislacao': 'Regime Jurídico das Facturas — Decreto Presidencial n.º 292/18',
        'artigo': 'Art. 4.º e 7.º — Emissão obrigatória de facturas em software certificado',
        'texto': 'Todas as transmissões de bens e prestações de serviços devem ser tituladas por factura emitida por sistema certificado.',
    },
    'BL-CONT-001': {
        'legislacao': 'Plano Geral de Contabilidade (PGC Angolano) — Decreto n.º 82/01',
        'artigo': 'Nota explicativa da Conta 45 (Meios Monetários / Caixa)',
        'texto': 'A conta de Caixa possui natureza estritamente devedora. Um saldo credor constitui anomalia material na contabilidade.',
    },
    'BL-CONT-002': {
        'legislacao': 'Plano Geral de Contabilidade — Decreto n.º 82/01',
        'artigo': 'Princípio das Partidas Dobradas e Balancete de Verificação',
        'texto': 'A soma total dos débitos deve ser rigorosamente igual à soma dos créditos em qualquer balancete de verificação.',
    },
    'BL-REC-001': {
        'legislacao': 'Código Geral Tributário — Lei n.º 21/14',
        'artigo': 'Art. 42.º — Reconciliação Contabilística e Fiscal',
        'texto': 'O sujeito passivo deve manter a contabilidade organizada de molde a permitir o controlo claro das suas declarações fiscais.',
    },
    'BL-RISCO-001': {
        'legislacao': 'Normas de Auditoria e Gestão de Risco Fiscal',
        'artigo': 'Avaliação de Inconsistências Fiscais e Contabilísticas',
        'texto': 'A confluência de divergências em múltiplos impostos eleva a exposição e o risco de inspeção tributária.',
    },
    'BL-PRAZO-001': {
        'legislacao': 'Código Geral Tributário e Código do IVA',
        'artigo': 'Cumprimento de Prazos Declarativos e Contributivos',
        'texto': 'As obrigações fiscais devem ser cumpridas dentro dos prazos legais para evitar penalidades e encargos de mora.',
    },
    'BL-EXP-001': {
        'legislacao': 'Código Geral Tributário — Lei n.º 21/14',
        'artigo': 'Art. 180.º — Responsabilidade e Exposição Fiscal Potencial',
        'texto': 'Diferenças de retenção ou tributação apuradas representam contingência fiscal potencial sujeita a confirmação.',
    },
    'BL-ANOM-001': {
        'legislacao': 'Código do IVA e PGC Angolano',
        'artigo': 'Imputação de Custos Fiscais e Dedutibilidade',
        'texto': 'O registo directo de IVA suportado em custos operacionais sem menção declarativa é anomalia que requer revisão.',
    },
    'BL-HIST-001': {
        'legislacao': 'Plano Geral de Contabilidade',
        'artigo': 'Princípio da Consistência e Comparabilidade Histórica',
        'texto': 'A comparabilidade de contas entre períodos sucessivos permite avaliar a estabilidade das operações da empresa.',
    },
    'BL-REL-001': {
        'legislacao': 'Princípio da Transparência e Auditoria Documental',
        'artigo': 'Auditoria de Conformidade Baseada em Evidências',
        'texto': 'O relatório de auditoria deve refletir com clareza o nível de cobertura atingido e os documentos ausentes.',
    },
    'BL-BANCO-001': {
        'legislacao': 'Plano Geral de Contabilidade (PGC) — Conta 43 e Meios Financeiros',
        'artigo': 'Controlo Interno de Meios Financeiros e Reconciliação Bancária',
        'texto': 'Os saldos das contas de Depósitos à Ordem e Meios Monetários devem ser periodicamente reconciliados com os extractos bancários oficiais.',
    },
    'BL-IRT-003': {
        'legislacao': 'Código do IRT — Lei n.º 18/14 e Lei n.º 28/20',
        'artigo': 'Art. 20.º — Pagamento e Liquidação Provisória / Definitiva do IRT',
        'texto': 'O pagamento das retenções de IRT deve ser efetuado através de DAR (Documento de Arrecadação de Receitas) até ao final do mês seguinte.',
    },
    'BL-II-002': {
        'legislacao': 'Código do Imposto Industrial — Lei n.º 19/14 e Lei n.º 26/20',
        'artigo': 'Art. 18.º e 23.º — Custos e perdas não dedutíveis fiscalmente',
        'texto': 'Não são dedutíveis para efeitos de determinação da matéria colectável as multas, coimas e encargos indemnizatórios decorrentes de infracções legais.',
    },
    'BL-SS-002': {
        'legislacao': 'Decreto Presidencial n.º 227/18 e Lei da Protecção Social',
        'artigo': 'Art. 14.º — Determinação da base de incidência contributiva (INSS 8%)',
        'texto': 'As contribuições para a segurança social incidem sobre a totalidade das remunerações base e subsídios sujeitos devidos aos trabalhadores.',
    },
    'BL-CONT-003': {
        'legislacao': 'Plano Geral de Contabilidade — Decreto n.º 82/01',
        'artigo': 'Nota explicativa das Contas de Terceiros (Classes 31 e 32)',
        'texto': 'As contas de Clientes Correntes (311) e Fornecedores Correntes (321) devem espelhar a posição líquida debitória ou creditória real face aos parceiros comerciais.',
    },
    'BL-PRAZO-002': {
        'legislacao': 'Código Geral Tributário — Lei n.º 21/14',
        'artigo': 'Calendário de Obrigações Declarativas e Pagamentos Fiscais',
        'texto': 'A entrega de declarações fiscais e o pagamento dos tributos devem observar os prazos legalmente fixados sob pena de aplicação de juros de mora.',
    },
    'BL-EXP-002': {
        'legislacao': 'Código Geral Tributário — Lei n.º 21/14',
        'artigo': 'Art. 180.º — Contingências Fiscais e Juros Compensatórios',
        'texto': 'A regularização tempestiva de divergências e retenções em falta extingue o risco de liquidação oficiosa pela administração tributária.',
    },
    'BL-REL-002': {
        'legislacao': 'Normas Técnicas de Auditoria Contabilística e Parecer do Contabilista',
        'artigo': 'Parecer Técnico de Auditoria Preventiva e Recomendações',
        'texto': 'O parecer de auditoria deve indicar expressamente as inconformidades materiais identificadas e elencar medidas de mitigação preventiva.',
    },
}

# (codigo, motor_codigo, imposto, base_id, nome, descricao, condicao, formula, severidade, recomendacao)
REGRAS = [
    # --- MOTOR 1: IVA ---
    ('IVA-001', 'M1', 'IVA', 'BL-IVA-001',
     'Modelo 7 em falta com operações no balancete',
     'Existe balancete carregado para o período mas não existe declaração Modelo 7 registada.',
     'tem_balancete == 1 and tem_modelo7 == 0', '', 'ALTO',
     'Carregar a declaração Modelo 7 do período e confirmar o prazo de entrega aplicável ao regime.'),
    ('IVA-002', 'M1', 'IVA', 'BL-IVA-002',
     'Balancete em falta com Modelo 7 entregue',
     'Existe declaração Modelo 7 para o período mas não existe balancete carregado.',
     'tem_modelo7 == 1 and tem_balancete == 0', '', 'MEDIO',
     'Carregar o balancete do período para permitir o confronto declaração vs escrituração.'),
    ('IVA-003', 'M1', 'IVA', 'BL-IVA-003',
     'Declaração de IVA internamente incoerente',
     'A diferença entre IVA liquidado − dedutível e o IVA apurado na declaração excede 0,01.',
     'tem_modelo7 == 1 and iva_coerente == 0',
     'abs(iva_liquidado - iva_dedutivel - iva_apurado)', 'MEDIO',
     'Rever os valores liquidado, dedutível e apurado submetidos na declaração do período.'),
    ('IVA-004', 'M1', 'IVA', 'BL-IVA-004',
     'Reconciliação IVA com divergências',
     'A reconciliação IVA do período regista campos divergentes entre contabilidade e AGT.',
     'tem_reconciliacao == 1 and reconciliacao_divergencias > 0',
     'reconciliacao_divergencias', 'MEDIO',
     'Analisar os campos divergentes da reconciliação e corrigir a origem (contabilidade ou declaração).'),
    ('IVA-005', 'M1', 'IVA', 'BL-IVA-004',
     'Reconciliação IVA por executar',
     'Existem balancete e Modelo 7 no período mas ainda não foi executada a reconciliação IVA.',
     'tem_balancete == 1 and tem_modelo7 == 1 and tem_reconciliacao == 0', '',
     'INFORMATIVO',
     'Executar a reconciliação IVA do período para confrontar os quatro campos declarativos.'),
    ('IVA-006', 'M1', 'IVA', 'BL-IVA-005',
     'IVA suportado contabilizado sem dedução no Modelo 7',
     'Existe IVA suportado escriturado (conta 3451) mas o Modelo 7 regista IVA dedutível nulo.',
     'divergencia_suportado_dedutivel == 1',
     'diferenca_iva_suportado_agt', 'MEDIO',
     'Verificar se as faturas reúnem os requisitos do Art. 21.º do CIVA ou se foram excluídas do direito à dedução.'),
    ('IVA-007', 'M1', 'IVA', 'BL-IVA-006',
     'Divergência entre volume de negócios e base tributável',
     'O volume de prestações de serviço/vendas difere da base tributável declarada no Modelo 7.',
     'divergencia_volume_negocios == 1',
     'abs(volume_negocios_contab - volume_negocios_declarado)', 'MEDIO',
     'Confrontar o total faturado no razão das contas 61/62 com o campo 1 do Modelo 7.'),

    # --- MOTOR 2: IRT ---
    ('IRT-001', 'M2', 'IRT', 'BL-IRT-001',
     'Remunerações de pessoal sem IRT retido contabilizado',
     'Existem custos com remunerações de pessoal (conta 72) sem registo de retenção de IRT (conta 343).',
     'remuneracoes_total > 0 and irt_contabilizado == 0',
     'remuneracoes_total', 'ALTO',
     'Confirmar o apuramento e escrituração das retenções de IRT sobre a folha salarial do período.'),
    ('IRT-002', 'M2', 'IRT', 'BL-IRT-002',
     'IRT retido contabilizado sem folha salarial associada',
     'Existe saldo de IRT contabilizado a pagar mas falta o carregamento da folha salarial detalhada.',
     'irt_contabilizado > 0 and tem_doc_folha == 0',
     'irt_contabilizado', 'MEDIO',
     'Carregar a folha salarial nominal para permitir a auditoria escalão a escalão do IRT.'),
    ('IRT-003', 'M2', 'IRT', 'BL-IRT-003',
     'IRT retido sem comprovativo de entrega DAR',
     'Identificado saldo de IRT na conta 343 sem o respectivo comprovativo DAR de liquidação à AGT.',
     'irt_contabilizado > 0 and tem_doc_comprovativos == 0',
     'irt_contabilizado', 'MEDIO',
     'Carregar o comprovativo DAR da liquidação do IRT para certificar o cumprimento da obrigação de pagamento.'),

    # --- MOTOR 3: IMPOSTO INDUSTRIAL ---
    ('II-001', 'M3', 'Imposto Industrial', 'BL-II-001',
     'Retenções na fonte de clientes acumuladas (Conta 3413)',
     'Existem retenções na fonte sofridas registadas que constituem crédito fiscal para o Imposto Industrial.',
     'retencoes_clientes_contab > 0 and tem_doc_imposto_industrial == 0',
     'retencoes_clientes_contab', 'INFORMATIVO',
     'Conferir os comprovativos de retenção emitidos pelos clientes para dedução no Modelo 1 anual.'),
    ('II-002', 'M3', 'Imposto Industrial', 'BL-II-002',
     'Custos com encargos e multas não dedutíveis (Conta 756/757)',
     'Lançados custos com penalidades ou multas que não concorrem para a dedutibilidade do Imposto Industrial.',
     'multas_encargos_contab > 0',
     'multas_encargos_contab', 'MEDIO',
     'Isolar estes encargos no apuramento do lucro tributável do Modelo 1 para evitar correções pela AGT.'),

    # --- MOTOR 4: RETENÇÕES NA FONTE ---
    ('RET-001', 'M4', 'Retenções', 'BL-RET-001',
     'Honorários a independentes com retenção divergente de 6,5%',
     'Contabilizados honorários a profissionais independentes (conta 75234) com retenção divergente dos 6,5% legais.',
     'honorarios_sem_retencao == 1 or diferenca_retencao_honorarios > 10',
     'diferenca_retencao_honorarios', 'ALTO',
     'Verificar se foi aplicada a retenção de 6,5% na fonte prevista no Art. 67.º do Código do Imposto Industrial.'),
    ('RET-002', 'M4', 'Retenções', 'BL-RET-001',
     'Retenções na fonte a prestadores pendentes de comprovativo',
     'Existe saldo de retenção na fonte na conta 3493 sem comprovativos de liquidação carregados.',
     'retencao_prestadores_contab > 0 and tem_doc_comprovativos == 0',
     'retencao_prestadores_contab', 'MEDIO',
     'Carregar a guia DAR e o comprovativo de liquidação da retenção na fonte de prestadores.'),

    # --- MOTOR 5: SEGURANÇA SOCIAL ---
    ('SS-001', 'M5', 'Segurança Social', 'BL-SS-001',
     'Contribuições para a Segurança Social pendentes de liquidação',
     'Existe saldo credor na conta 3492 sem documento comprovativo de liquidação do INSS.',
     'inss_contabilizado > 0 and tem_doc_folha_ss == 0',
     'inss_contabilizado', 'MEDIO',
     'Carregar o Mapa de Remunerações e o comprovativo de liquidação do INSS do período.'),
    ('SS-002', 'M5', 'Segurança Social', 'BL-SS-002',
     'Divergência entre encargos patronais contabilizados e taxa legal do INSS (8%)',
     'Os encargos patronais (conta 725) divergem significativamente da taxa regulamentar de 8% sobre a massa salarial.',
     'desvio_encargos_anormal == 1',
     'desvio_encargos_ss', 'MEDIO',
     'Rever a base de incidência e confirmar se existem subsídios isentos de tributação para a Segurança Social.'),

    # --- MOTOR 6: IMPOSTO DO SELO ---
    ('SEL-001', 'M6', 'Imposto do Selo', 'BL-SEL-001',
     'Operações sujeitas a Imposto do Selo sem suporte documental',
     'Existem lançamentos de compras ou quitações sem documento comprovativo de incidência de Selo.',
     'tem_balancete == 1 and tem_doc_factura_compra == 0 and fornecimentos_terceiros > 0',
     '0', 'INFORMATIVO',
     'Verificar recibos de quitação e contratos sujeitos a 1% de Imposto do Selo nos termos da Tabela Geral.'),

    # --- MOTOR 7: FACTURAÇÃO ---
    ('FAC-001', 'M7', 'Facturação', 'BL-FAC-001',
     'Volume de faturação contabilizado sem faturas de venda',
     'O balancete regista proveitos de vendas/serviços mas não foram carregadas as faturas de venda correspondentes.',
     'volume_negocios_contab > 0 and tem_doc_factura_venda == 0',
     'volume_negocios_contab', 'MEDIO',
     'Carregar os ficheiros de faturação ou SAF-T (AO) para auditar sequencialidade e NIFs.'),
    ('FAC-002', 'M7', 'Facturação', 'BL-FAC-001',
     'Faturação sem ficheiro de auditoria SAF-T (AO)',
     'Identificado volume de faturação sem a respetiva submissão ou ficheiro SAF-T de faturação mensal.',
     'volume_negocios_contab > 0 and tem_documento == 0',
     'volume_negocios_contab', 'BAIXO',
     'Exportar e carregar o ficheiro SAF-T mensal para verificação de hashing e integridade das faturas.'),

    # --- MOTOR 8: AUDITORIA CONTABILÍSTICA (PGC) ---
    ('CONT-001', 'M8', 'Contabilidade', 'BL-CONT-001',
     'Saldo credor anormal na conta de Caixa (Conta 45)',
     'A conta de Caixa apresenta saldo credor no balancete, contrariando a regra fundamental do PGC.',
     'caixa_credor_anormal == 1',
     'caixa_saldo_credor', 'ALTO',
     'Revisão urgente: a conta Caixa não pode ter saldo credor. Verificar saídas indevidas ou suprimentos não registados.'),
    ('CONT-002', 'M8', 'Contabilidade', 'BL-CONT-002',
     'Desbalanceamento no balancete de verificação',
     'A soma dos débitos difere da soma dos créditos no balancete do período.',
     'diferenca_devedor_credor > 0',
     'diferenca_devedor_credor', 'ALTO',
     'Identificar e corrigir os lançamentos desbalanceados no software de contabilidade.'),
    ('CONT-003', 'M8', 'Contabilidade', 'BL-CONT-003',
     'Clientes correntes com saldo credor anómalo (Conta 311)',
     'Existem contas de Clientes Correntes com saldo credor líquido sem evidência de adiantamentos.',
     'clientes_saldo_credor > 0',
     'clientes_saldo_credor', 'BAIXO',
     'Reconciliar os recebimentos de clientes e verificar se se tratam de adiantamentos a reclassificar.'),

    # --- MOTOR 9: RECONCILIAÇÃO GENERALIZADA E BANCOS ---
    ('REC-001', 'M9', 'Reconciliação', 'BL-REC-001',
     'Discrepância cruzada em múltiplos níveis',
     'Identificadas divergências em mais de um campo entre a escrituração contábil e a declaração fiscal.',
     'tem_reconciliacao == 1 and reconciliacao_divergencias > 1',
     'reconciliacao_divergencias', 'MEDIO',
     'Realizar reconciliação analítica conta a conta entre o razão de IVA e o Modelo 7.'),
    ('BANCO-001', 'M9', 'Reconciliação', 'BL-BANCO-001',
     'Movimentação em Meios Financeiros (Conta 43) sem extrato bancário oficial',
     'Registados saldos ou movimentos em contas bancárias sem extrato bancário carregado para conferência.',
     'bancos_saldo != 0 and tem_doc_extracto == 0',
     'abs(bancos_saldo)', 'MEDIO',
     'Carregar os extratos bancários do período para conciliação dos fluxos financeiros e pagamentos fiscais.'),

    # --- MOTOR 10: ANÁLISE DE RISCO (AGREGADOR) ---
    ('RISCO-001', 'M10', 'Risco Fiscal', 'BL-RISCO-001',
     'Perfil de risco fiscal global elevado',
     'Convergência de saldo anormal de caixa ou múltiplas divergências de IVA no período.',
     'reconciliacao_divergencias > 2 or caixa_credor_anormal == 1',
     'caixa_saldo_credor', 'ALTO',
     'Classificação de Risco Alto. Priorizar a regularização dos saldos de caixa e IVA antes de eventual inspeção.'),
    ('RISCO-002', 'M10', 'Risco Fiscal', 'BL-RISCO-001',
     'Convergência de contingências em retenções e IVA',
     'Divergências simultâneas apuradas em retenções na fonte e IVA suportado elevam o risco contributivo.',
     'diferenca_retencao_honorarios > 0 and divergencia_suportado_dedutivel == 1',
     'exposicao_total_potencial', 'ALTO',
     'Revisão preventiva imediata com o contabilista para mitigar o risco de liquidação oficiosa.'),

    # --- MOTOR 11: OBRIGAÇÕES E PRAZOS ---
    ('PRAZO-001', 'M11', 'Prazos Fiscais', 'BL-PRAZO-001',
     'Obrigação declarativa de IVA pendente no período',
     'Existe balancete com operações mas a declaração periódica Modelo 7 não foi submetida.',
     'tem_balancete == 1 and tem_modelo7 == 0',
     '0', 'ALTO',
     'Submeter a declaração Modelo 7 na AGT para evitar juros de mora e penalidades por omissão.'),
    ('PRAZO-002', 'M11', 'Prazos Fiscais', 'BL-PRAZO-002',
     'Confirmação de prazos de retenções de IRT e Segurança Social',
     'Saldos retidos carecem de validação das respetivas datas de liquidação para atestar pontualidade.',
     '(irt_contabilizado > 0 or inss_contabilizado > 0) and tem_doc_comprovativos == 0',
     'irt_contabilizado + inss_contabilizado', 'MEDIO',
     'Juntar os comprovativos bancários de liquidação DAR / INSS para certificar a observância dos prazos legais.'),

    # --- MOTOR 12: EXPOSIÇÃO FISCAL POTENCIAL ---
    ('EXP-001', 'M12', 'Exposição Fiscal', 'BL-EXP-001',
     'Exposição fiscal potencial em retenções de prestadores',
     'Diferença estimada entre a retenção devida (6,5%) e o montante retido contabilizado.',
     'diferenca_retencao_honorarios > 0',
     'diferenca_retencao_honorarios', 'MEDIO',
     'Estimativa de contingência fiscal prudencial. Verificar os contratos e recibos de quitação dos prestadores.'),
    ('EXP-002', 'M12', 'Exposição Fiscal', 'BL-EXP-002',
     'Exposição potencial em IVA suportado não deduzido',
     'Montante de IVA suportado lançado a custos operacionais que requer confirmação documental perante a AGT.',
     'divergencia_suportado_dedutivel == 1',
     'diferenca_iva_suportado_agt', 'MEDIO',
     'Rever a elegibilidade do IVA suportado para eventual recuperação ou regularização voluntária.'),

    # --- MOTOR 13: ANOMALIAS CONTABILÍSTICAS ---
    ('ANOM-001', 'M13', 'Anomalias', 'BL-ANOM-001',
     'IVA suportado registado directamente em custos operacionais',
     'Lançado IVA a custo operacional (conta 753) sem registo de dedução no Modelo 7.',
     'iva_custo_contab > 0 and iva_dedutivel == 0',
     'iva_custo_contab', 'MEDIO',
     'Requer revisão: averiguar por que motivo o IVA suportado foi assumido como custo em vez de deduzido na AGT.'),
    ('ANOM-002', 'M13', 'Anomalias', 'BL-ANOM-001',
     'Fornecedores correntes com saldos devedores anómalos (Conta 321)',
     'Contas de fornecedores correntes apresentam saldos devedores sem referência a adiantamentos.',
     'fornec_saldo_devedor > 0',
     'fornec_saldo_devedor', 'BAIXO',
     'Rever a conta de fornecedores e confirmar se houve pagamentos em duplicado ou lançamentos invertidos.'),

    # --- MOTOR 14: ANÁLISE HISTÓRICA ---
    ('HIST-001', 'M14', 'Análise Histórica', 'BL-HIST-001',
     'Período em auditoria isolada sem histórico prévio',
     'Não foram identificados períodos anteriores carregados para análise comparativa de evolução.',
     'tem_documento == 1 and n_documentos < 2',
     '0', 'INFORMATIVO',
     'O carregamento de períodos consecutivos permitirá identificar variações anormais de receitas e margens.'),
    ('HIST-002', 'M14', 'Análise Histórica', 'BL-HIST-001',
     'Período com operações ativas e histórico em consolidação',
     'Acompanhar a estabilidade dos rácios de margem bruta e carga fiscal efetiva ao longo dos meses.',
     'tem_balancete == 1 and volume_negocios_contab > 0',
     '0', 'INFORMATIVO',
     'Consolidar a escrituração dos meses subsequentes para geração de gráficos de tendência plurimensais.'),

    # --- MOTOR 15: RELATÓRIO ESTRUTURADO ---
    ('REL-001', 'M15', 'Relatório', 'BL-REL-001',
     'Auditoria realizada com cobertura documental parcial',
     'O escopo da auditoria está limitado aos documentos disponíveis no período.',
     'n_documentos < 3',
     '0', 'INFORMATIVO',
     'Para alcançar o nível de Auditoria Ampla ou Completa, envie extratos bancários, folhas de salário e faturas.'),
    ('REL-002', 'M15', 'Relatório', 'BL-REL-002',
     'Parecer técnico preliminar de auditoria emitido',
     'Processamento de conformidade concluído para o período com base nas regras ativas e bases legais angolanas.',
     'tem_balancete == 1 or tem_modelo7 == 1',
     '0', 'INFORMATIVO',
     'Utilize o painel de achados e a matriz semafórica para guiar o plano de ação corretivo e preventivo.'),
]


def semear_regras(validar_padrao=False):
    """Cria/actualiza bases legais e regras dos 15 motores. Devolve contagens."""
    motores_map = {m.codigo: m for m in Motor.objects.all()}
    motor_padrao = motores_map.get('M1')

    bases = {}
    for codigo, dados in _BASES.items():
        base, _ = BaseLegal.objects.update_or_create(
            legislacao=dados['legislacao'],
            artigo=dados['artigo'],
            defaults={
                'texto': dados['texto'],
                'validado_juridicamente': True if validar_padrao else False,
            },
        )
        bases[codigo] = base

    regras_contagem = 0
    for item in REGRAS:
        if len(item) == 10:
            codigo, motor_cod, imposto, base_id, nome, desc, cond, form, sev, recom = item
            motor = motores_map.get(motor_cod, motor_padrao)
        else:
            codigo, base_id, nome, desc, cond, form, sev, recom = item
            motor = motor_padrao
            imposto = 'IVA'

        Regra.objects.update_or_create(
            codigo=codigo,
            defaults={
                'motor': motor,
                'imposto': imposto,
                'nome': nome,
                'descricao': desc,
                'condicao': cond,
                'formula': form,
                'severidade': sev,
                'recomendacao': recom,
                'base_legal': bases[base_id],
                'activa': True,
                'estado_validacao': 'VALIDADA' if validar_padrao else 'POR_VALIDAR',
            },
        )
        regras_contagem += 1

    return {'bases_legais': len(bases), 'regras': regras_contagem}
