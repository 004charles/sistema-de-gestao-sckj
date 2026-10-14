"""
Compêndio Oficial da Legislação Fiscal da República de Angola.
Contém os principais diplomas e códigos tributários em vigor:
- Código Geral Tributário (Lei n.º 21/14)
- Código do Imposto sobre o Valor Acrescentado - CIVA (Lei n.º 7/19, alterada pelas Leis n.º 42/20 e 24/23)
- Código do Imposto Industrial - CII (Lei n.º 19/14, alterada pela Lei n.º 26/20)
- Código do Imposto sobre o Rendimento do Trabalho - CIRT (Lei n.º 18/14, alterada pela Lei n.º 28/20)
- Código do Imposto de Selo - CIS (Lei n.º 3/14, alterada pela Lei n.º 18/20)
- Regime Jurídico das Facturas e Documentos Equivalentes - RJFDE (Decreto Presidencial n.º 292/18)
- Regime do SAF-T de Angola e Submissão Electrónica (Decreto Presidencial n.º 312/18)
- Regime de Segurança Social / INSS (Lei n.º 07/04 e Decreto Presidencial n.º 227/18)
"""

DIPLOMAS_FISCAIS = [
    {
        "codigo": "CIVA",
        "nome": "Código do Imposto sobre o Valor Acrescentado (CIVA)",
        "diploma": "Lei n.º 7/19, de 24 de Abril (alterada pelas Leis n.º 42/20 e n.º 24/23)",
        "ambito": "Incidência, Isenções, Determinação da Matéria Coletável, Taxas, Deduções e Obrigações Declarativas de IVA em Angola.",
        "taxa_geral": "14%",
        "taxas_reduzidas": "7% (bens da cesta básica e insumos agrícolas), 5% (produtos alimentares essenciais), 1% (Província de Cabinda)",
        "resumo": "O CIVA tributa as transmissões de bens, prestações de serviços e importações realizadas no território angolano. O sistema funciona pelo método de crédito de imposto (IVA liquidado nas vendas menos IVA suportado e dedutível nas compras).",
        "artigos_chave": [
            {
                "artigo": "Artigo 1.º",
                "titulo": "Incidência Objectiva",
                "conteudo": "Estão sujeitas a IVA as transmissões de bens e as prestações de serviços efectuadas no território nacional, a título oneroso, por um sujeito passivo agindo como tal, bem como as importações de bens."
            },
            {
                "artigo": "Artigo 2.º",
                "titulo": "Incidência Subjectiva (Sujeitos Passivos)",
                "conteudo": "São sujeitos passivos do imposto as pessoas singulares ou colectivas que exerçam, de modo independente e com carácter habitual, actividades económicas de produção, comércio ou prestação de serviços."
            },
            {
                "artigo": "Artigo 12.º",
                "titulo": "Isenções nas Operações Internas",
                "conteudo": "Estão isentas de imposto: transmissões de medicamentos de uso humano, produtos farmacêuticos, equipamentos médicos, livros e manuais escolares, transporte público regular colectivo de passageiros e serviços de saúde e ensino."
            },
            {
                "artigo": "Artigo 15.º",
                "titulo": "Taxas do Imposto",
                "conteudo": "A taxa geral do imposto é de 14%. Aplica-se a taxa reduzida de 7% e 5% a determinados bens da cesta básica e factores de produção agrícola. Na Província de Cabinda a taxa é de 1% sob o regime especial."
            },
            {
                "artigo": "Artigo 19.º e 20.º",
                "titulo": "Direito à Dedução",
                "conteudo": "Para apuramento do imposto a entregar, os sujeitos passivos no Regime Geral deduzem ao imposto liquidado nos seus proveitos o imposto suportado nas suas aquisições de bens e serviços afectos à actividade tributável, comprovado por factura legal e certificada."
            },
            {
                "artigo": "Artigo 26.º",
                "titulo": "Declaração Periódica (Modelo 7)",
                "conteudo": "Os sujeitos passivos do Regime Geral devem submeter a declaração periódica (Modelo 7) e proceder ao pagamento do imposto apurado até ao último dia do mês seguinte àquele a que respeitam as operações."
            },
            {
                "artigo": "Regime de Cativação",
                "titulo": "Cativação de IVA (Decreto Presidencial n.º 180/19)",
                "conteudo": "O Estado e entidades públicas cativam 100% do IVA faturado nas aquisições. Grandes Contribuintes e entidades designadas cativam 50% do IVA faturado pelos fornecedores e entregam diretamente à AGT."
            }
        ]
    },
    {
        "codigo": "CII",
        "nome": "Código do Imposto Industrial (CII)",
        "diploma": "Lei n.º 19/14, de 22 de Outubro (alterada pela Lei n.º 26/20)",
        "ambito": "Tributação dos lucros imputáveis ao exercício de qualquer actividade de natureza comercial ou industrial em Angola.",
        "taxa_geral": "25%",
        "taxas_reduzidas": "15% (sector agrícola, silvícola e pecuário), 35% (sector bancário, telecomunicações e segurador)",
        "resumo": "O Imposto Industrial incide sobre o lucro real das empresas no Regime Geral e sobre o volume de receitas no Regime Simplificado. Prevê liquidação provisória em Agosto e declaração final anual em Maio.",
        "artigos_chave": [
            {
                "artigo": "Artigo 1.º e 2.º",
                "titulo": "Incidência e Sujeição",
                "conteudo": "O Imposto Industrial incide sobre os lucros obtidos pelas pessoas colectivas e singulares que exerçam actividades comerciais, industriais ou de prestação de serviços no território angolano."
            },
            {
                "artigo": "Artigo 13.º e 14.º",
                "titulo": "Custos e Proveitos Dedutíveis",
                "conteudo": "Consideram-se custos ou perdas os encargos comprovadamente indispensáveis para a realização dos proveitos ou ganhos sujeitos a imposto e para a manutenção da fonte produtora."
            },
            {
                "artigo": "Artigo 17.º",
                "titulo": "Custos Não Dedutíveis",
                "conteudo": "Não são aceites fiscalmente como custos: despesas não documentadas, multas e coimas fiscais, donativos fora dos limites da Lei do Mecenato, despesas com combustíveis e viaturas ligeiras de passageiros acima dos limites legais."
            },
            {
                "artigo": "Artigo 45.º",
                "titulo": "Taxas do Imposto Industrial",
                "conteudo": "A taxa geral do Imposto Industrial é de 25%. Para actividades exclusivamente agrícolas, silvícolas e pecuárias a taxa é de 15%. Para bancos, seguradoras e telecomunicações aplica-se a taxa de 35%."
            },
            {
                "artigo": "Artigo 65.º",
                "titulo": "Liquidação Provisória sobre Vendas (2%)",
                "conteudo": "Os sujeitos passivos do Regime Geral procedem ao pagamento provisório do imposto de 2% sobre o volume total de vendas do primeiro semestre, liquidado e pago até ao último dia útil do mês de Agosto."
            },
            {
                "artigo": "Artigo 67.º e 68.º",
                "titulo": "Retenção na Fonte de 6,5%",
                "conteudo": "As prestações de serviços efetuadas por residentes e não residentes estão sujeitas a retenção na fonte à taxa de 6,5%, que tem natureza de pagamento por conta do Imposto Industrial final."
            },
            {
                "artigo": "Artigo 52.º",
                "titulo": "Declaração Anual de Rendimentos (Modelo 1)",
                "conteudo": "A Declaração Modelo 1 de Imposto Industrial e as Demonstrações Financeiras auditadas devem ser entregues até ao último dia útil do mês de Maio do ano seguinte ao exercício a que respeitam."
            }
        ]
    },
    {
        "codigo": "CIRT",
        "nome": "Código do Imposto sobre o Rendimento do Trabalho (CIRT)",
        "diploma": "Lei n.º 18/14, de 22 de Outubro (alterada pela Lei n.º 28/20)",
        "ambito": "Tributação dos rendimentos do trabalho dependente (conta de outrem) e independente (conta própria) auferidos em Angola.",
        "taxa_geral": "Tabela Progressiva de 0% a 25% (Grupo A) | 6,5% / 15% (Grupo B e C)",
        "taxas_reduzidas": "Isenção total até 100.000 Kz de salário mensal",
        "resumo": "O IRT tributa todas as remunerações, salários, subsídios, honorários e avenças auferidos por trabalhadores no território nacional, aplicando tabelas progressivas e retenção na fonte pela entidade patronal.",
        "artigos_chave": [
            {
                "artigo": "Artigo 1.º e 2.º",
                "titulo": "Grupos de Tributação (A, B e C)",
                "conteudo": "Grupo A: rendimentos auferidos por trabalhadores por conta de outrem; Grupo B: profissionais liberais e trabalhadores independentes; Grupo C: actividades industriais e comerciais individuais da tabela de lucros mínimos."
            },
            {
                "artigo": "Artigo 3.º",
                "titulo": "Isenções e Não Sujeições Salariais",
                "conteudo": "Não estão sujeitos a IRT: subsídio de alimentação até 100.000 Kz/mês, subsídio de transporte até 100.000 Kz/mês, prestações sociais de segurança social, abonos de família e compensações por cessação de contrato nos limites legais."
            },
            {
                "artigo": "Tabela Anexa",
                "titulo": "Escalões Progressivos de IRT (Grupo A)",
                "conteudo": "Até 100.000 Kz: Isento (0%). De 100.001 a 150.000 Kz: 13% sobre o excedente. De 150.001 a 200.000 Kz: 12.500 Kz + 16%. De 200.001 a 300.000 Kz: 31.250 Kz + 18%. De 300.001 a 500.000 Kz: 49.250 Kz + 19%. De 500.001 a 1.000.000 Kz: 87.250 Kz + 20%. De 1.000.001 a 1.500.000 Kz: 187.250 Kz + 21%. De 1.500.001 a 2.500.000 Kz: 292.250 Kz + 22%. De 2.500.001 a 5.000.000 Kz: 512.250 Kz + 23%. De 5.000.001 a 10.000.000 Kz: 1.087.250 Kz + 24%. Mais de 10.000.000 Kz: 2.287.250 Kz + 25% sobre o excedente."
            },
            {
                "artigo": "Artigo 20.º",
                "titulo": "Retenção na Fonte e Entrega",
                "conteudo": "As entidades empregadoras e adquirentes são obrigadas a reter o IRT no momento do pagamento e entregar aos cofres do Estado até ao último dia do mês seguinte ao da retenção."
            }
        ]
    },
    {
        "codigo": "CIS",
        "nome": "Código do Imposto de Selo (CIS)",
        "diploma": "Lei n.º 3/14, de 18 de Junho (alterada pela Lei n.º 18/20)",
        "ambito": "Tributação sobre todos os actos, contratos, documentos, títulos, livros, papéis e operações que não estejam sujeitos a IVA.",
        "taxa_geral": "1% (Recibos de Quitação), 0,1% a 0,5% (Operações Bancárias e Crédito)",
        "taxas_reduzidas": "0,1% sobre garantias e cauções",
        "resumo": "O Imposto de Selo incide sobre documentos e operações financeiras. Em obediência ao princípio da não-cumulação, operações tributadas e não isentas de IVA não sofrem tributação em Imposto de Selo de recibo.",
        "artigos_chave": [
            {
                "artigo": "Artigo 1.º",
                "titulo": "Incidência",
                "conteudo": "O Imposto de Selo incide sobre todos os actos, contratos, documentos, títulos, operações e outros factos previstos na Tabela Anexa à presente Lei."
            },
            {
                "artigo": "Artigo 4.º",
                "titulo": "Não Cumulação com o IVA",
                "conteudo": "Estão excluídas da incidência do Imposto de Selo as operações que tenham sido efectivamente sujeitas e não isentas de Imposto sobre o Valor Acrescentado (IVA)."
            },
            {
                "artigo": "Tabela Anexa - Ponto 23",
                "titulo": "Recibos de Quitação e Pagamento",
                "conteudo": "Aplica-se a taxa de 1% sobre recibos ou documentos de quitação por quaisquer quantias recebidas, salvo quando a operação estiver abrangida por IVA."
            },
            {
                "artigo": "Tabela Anexa - Ponto 11",
                "titulo": "Operações Financeiras e Bancárias",
                "conteudo": "Crédito utilizado: 0,1% a 0,5% conforme o prazo (inferior a 1 ano, de 1 a 5 anos ou superior a 5 anos). Juros e comissões bancárias: 0,1%."
            }
        ]
    },
    {
        "codigo": "CGT",
        "nome": "Código Geral Tributário (CGT)",
        "diploma": "Lei n.º 21/14, de 22 de Outubro",
        "ambito": "Princípios fundamentais, normas gerais de direito tributário, procedimento tributário e garantias dos contribuintes.",
        "taxa_geral": "Normativo Estruturante do Sistema Fiscal de Angola",
        "taxas_reduzidas": "N/A",
        "resumo": "O Código Geral Tributário estabelece os princípios gerais de legalidade, justiça, tipicidade e capacidade contributiva, regulando as relações entre a Administração Tributária (AGT) e os contribuintes.",
        "artigos_chave": [
            {
                "artigo": "Artigo 3.º",
                "titulo": "Princípio da Legalidade Tributária",
                "conteudo": "Os impostos só podem ser criados, alterados ou extintos por Lei da Assembleia Nacional, que determina a incidência, as taxas, as isenções e as garantias dos contribuintes."
            },
            {
                "artigo": "Artigo 45.º",
                "titulo": "Prazo de Caducidade",
                "conteudo": "O direito de a Administração Geral Tributária liquidar os tributos caduca se a liquidação não for validamente notificada ao contribuinte no prazo de 5 (cinco) anos contados a partir do início do ano civil seguinte àquele em que se verificou o facto tributário."
            },
            {
                "artigo": "Artigo 48.º",
                "titulo": "Prazo de Prescrição",
                "conteudo": "As dívidas tributárias prescrevem no prazo de 5 (cinco) anos contados a partir da data em que se tornou exigível o seu pagamento ou do início do ano seguinte à liquidação."
            },
            {
                "artigo": "Artigo 58.º a 70.º",
                "titulo": "Garantias dos Contribuintes e Impugnação",
                "conteudo": "Os contribuintes têm direito de resposta, audiência prévia, Reclamação Graciosa perante a Repartição Fiscal, Recurso Hierárquico para o Conselho de Administração da AGT e Impugnação Judicial para a Sala do Contencioso Fiscal e Aduaneiro dos Tribunais de Comarca."
            }
        ]
    },
    {
        "codigo": "RJFDE",
        "nome": "Regime Jurídico das Facturas e Documentos Equivalentes (RJFDE)",
        "diploma": "Decreto Presidencial n.º 292/18, de 3 de Dezembro",
        "ambito": "Regras de emissão, conteúdo, prazos e certificação de programas informáticos de facturação.",
        "taxa_geral": "Software Certificado Obrigatório",
        "taxas_reduzidas": "N/A",
        "resumo": "Regulamenta a emissão obrigatória de faturas por programas informáticos certificados pela AGT, definindo os requisitos de integridade, numeração sequencial ininterrupta e assinatura digital hash.",
        "artigos_chave": [
            {
                "artigo": "Artigo 2.º e 3.º",
                "titulo": "Obrigatoriedade de Emissão de Fatura",
                "conteudo": "É obrigatória a emissão de fatura ou documento equivalente em todas as transmissões de bens e prestações de serviços realizadas no território nacional, mesmo quando o adquirente seja particular."
            },
            {
                "artigo": "Artigo 6.º",
                "titulo": "Elementos Obrigatórios da Factura",
                "conteudo": "A fatura deve conter: data e hora de emissão, número sequencial por série, nome/firma, NIF e morada do fornecedor e do adquirente, descrição clara das mercadorias/serviços, preço unitário, taxas de IVA discriminadas e código hash de validação da AGT."
            },
            {
                "artigo": "Artigo 8.º",
                "titulo": "Prazo de Emissão",
                "conteudo": "A fatura deve ser emitida o mais tardar no 5.º dia útil seguinte ao do momento em que os bens foram colocados à disposição ou os serviços foram concluídos."
            },
            {
                "artigo": "Artigo 12.º",
                "titulo": "Certificação de Sistemas de Facturação",
                "conteudo": "Os sujeitos passivos são obrigados a utilizar exclusivamente programas de facturação previamente certificados e validados pela Administração Geral Tributária (AGT)."
            },
            {
                "artigo": "Artigo 16.º",
                "titulo": "Prazo de Conservação e Arquivo",
                "conteudo": "As faturas e documentos equivalentes emitidos ou recebidos devem ser conservados e mantidos em arquivo pelo prazo mínimo de 5 (cinco) anos civis subsequentes."
            }
        ]
    },
    {
        "codigo": "INSS",
        "nome": "Regime de Protecção Social e Segurança Social (INSS)",
        "diploma": "Lei n.º 07/04, de 15 de Outubro e Decreto Presidencial n.º 227/18",
        "ambito": "Contribuições obrigatórias para a Segurança Social dos trabalhadores em Angola.",
        "taxa_geral": "11% Global (8% Entidade Empregadora + 3% Trabalhador)",
        "taxas_reduzidas": "N/A",
        "resumo": "Regula a protecção social e as contribuições obrigatórias para o Instituto Nacional de Segurança Social (INSS) sobre a totalidade das remunerações pagas aos trabalhadores.",
        "artigos_chave": [
            {
                "artigo": "Artigo 14.º",
                "titulo": "Taxas Contributivas",
                "conteudo": "A taxa global de contribuição para a Segurança Social é de 11% incidente sobre a massa salarial ilíquida, sendo 8% a cargo da entidade empregadora e 3% deduzida no vencimento do trabalhador."
            },
            {
                "artigo": "Artigo 16.º",
                "titulo": "Prazo de Entrega das Contribuições",
                "conteudo": "As contribuições retidas e patronais devem ser entregues ao INSS até ao dia 10 do mês seguinte àquele a que respeitam as remunerações pagas."
            }
        ]
    }
]


def get_diplomas_fiscais(filtro_codigo=None, termo_pesquisa=None):
    """Filtra e retorna os diplomas fiscais de Angola."""
    lista = DIPLOMAS_FISCAIS
    if filtro_codigo and filtro_codigo != 'TODOS':
        lista = [d for d in lista if d['codigo'] == filtro_codigo]

    if termo_pesquisa:
        termo = termo_pesquisa.lower().strip()
        filtrados = []
        for d in lista:
            matches_diploma = (
                termo in d['nome'].lower()
                or termo in d['diploma'].lower()
                or termo in d['ambito'].lower()
                or termo in d['resumo'].lower()
            )
            artigos_match = [
                a for a in d['artigos_chave']
                if termo in a['artigo'].lower()
                or termo in a['titulo'].lower()
                or termo in a['conteudo'].lower()
            ]
            if matches_diploma or artigos_match:
                item = d.copy()
                if artigos_match and not matches_diploma:
                    item['artigos_chave'] = artigos_match
                filtrados.append(item)
        return filtrados
    return lista
