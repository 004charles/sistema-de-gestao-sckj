"""Tradução da auditoria para números com acção.

O sistema já sabia detectar problemas, mas comunicava-os como prosa jurídica:
«Honorários a independentes com retenção divergente de 6,5%. Verificar se foi
aplicada a retenção na fonte prevista no Art. 67.º...». Quem gere a empresa não
sabe o que fazer com isso.

Aqui cada ocorrência vira a mesma coisa que um extracto bancário mostra: um
valor, onde está, o que devia estar lá, e o que fazer a seguir. A base legal e
o cálculo continuam presentes — passam para `detalhe`, que a interface esconde
atrás de "ver detalhe" e o contabilista abre quando precisa.
"""
from decimal import Decimal

from .models import Ocorrencia
from . import calendario_service, cobertura_service, regra_engine

# Como apresentar cada regra em números.
#   onde    — a conta ou documento onde o utilizador vai corrigir
#   tem     — variável do contexto com o valor actual
#   devia   — variável do contexto com o valor correcto
#   accao   — uma frase, imperativa, sem citar legislação
APRESENTACAO = {
    'RET-001': {
        'onde': 'Retenção a prestadores — conta 3493',
        'tem': 'retencao_prestadores_contab',
        'devia': 'retencao_devida_estimada',
        'accao': 'Reter 6,5% sobre os honorários e entregar a diferença na próxima guia.',
    },
    'EXP-001': {
        'onde': 'Retenção a prestadores — conta 3493',
        'tem': 'retencao_prestadores_contab',
        'devia': 'retencao_devida_estimada',
        'accao': 'Regularizar voluntariamente antes de uma eventual inspecção.',
    },
    'CONT-001': {
        'onde': 'Caixa — conta 45',
        'tem': 'caixa_saldo_credor',
        'devia': None,
        'accao': 'A caixa não pode ficar negativa. Procurar saídas por registar ou suprimentos em falta.',
    },
    'CONT-002': {
        'onde': 'Balancete — totais',
        'tem': 'total_debito_raiz',
        'devia': 'total_credito_raiz',
        'accao': 'O débito tem de igualar o crédito. Rever os lançamentos do mês.',
    },
    'IVA-003': {
        'onde': 'Modelo 7 — campos 31, 32 e 33',
        'tem': 'iva_apurado',
        'devia': None,
        'accao': 'Os valores declarados não fecham entre si. Rever a declaração antes de submeter.',
    },
    'IVA-004': {
        'onde': 'IVA liquidado — conta 3453 vs Modelo 7',
        'tem': None,
        'devia': None,
        'unidade': 'contagem',
        'sufixo': 'campos divergentes',
        'accao': 'O que está na contabilidade não é o que foi declarado à AGT. Confirmar qual está certo.',
    },
    'IVA-006': {
        'onde': 'IVA suportado — conta 3451',
        'tem': 'iva_suportado_contab',
        'devia': 'iva_dedutivel',
        'accao': 'Há IVA pago que não foi deduzido. Confirmar se as facturas dão direito à dedução.',
    },
    'EXP-002': {
        'onde': 'IVA suportado — conta 3451',
        'tem': 'iva_suportado_contab',
        'devia': 'iva_dedutivel',
        'accao': 'Verificar se este IVA ainda pode ser recuperado no próximo período.',
    },
    'IVA-007': {
        'onde': 'Prestações de serviço — conta 62 vs Modelo 7 campo 31',
        'tem': 'volume_negocios_contab',
        'devia': 'volume_negocios_declarado',
        'accao': 'A facturação do mês não coincide com a base declarada. Confirmar qual está certa.',
    },
    'SS-002': {
        'onde': 'Segurança Social — contas 725 e 3492',
        'tem': 'inss_contabilizado',
        'devia': 'inss_esperado_total',
        'accao': 'Os 8% da empresa e os 3% do trabalhador têm de incidir sobre a mesma base.',
    },
    'PRAZO-001': {
        'onde': 'Modelo 7 do período',
        'tem': None,
        'devia': None,
        'accao': 'Submeter a declaração na AGT. Cada dia de atraso acrescenta juros.',
    },
    'IVA-001': {
        'onde': 'Modelo 7 do período — em falta',
        'tem': None,
        'devia': None,
        'accao': 'Houve facturação este mês mas não há declaração. Submeter o Modelo 7 na AGT.',
    },
    'IVA-002': {
        'onde': 'Balancete do período',
        'tem': None,
        'devia': None,
        'accao': 'Há declaração entregue mas não há balancete. Carregar o balancete do mês.',
    },
    'IRT-001': {
        'onde': 'IRT — conta 343',
        'tem': 'irt_contabilizado',
        'devia': None,
        'accao': 'Pagaram-se salários sem IRT retido. Confirmar se algum trabalhador está isento.',
    },
    'II-002': {
        'onde': 'Multas e encargos — contas 756 e 757',
        'tem': 'multas_encargos_contab',
        'devia': None,
        'accao': 'Estes custos não baixam o imposto a pagar. Separá-los no apuramento do lucro.',
    },
    'CONT-003': {
        'onde': 'Clientes — conta 311',
        'tem': 'clientes_saldo_credor',
        'devia': None,
        'accao': 'Há clientes a dever-nos ao contrário. Verificar recebimentos lançados a mais.',
    },
    'REC-001': {
        'onde': 'Contabilidade vs Modelo 7',
        'tem': None,
        'devia': None,
        'unidade': 'contagem',
        'sufixo': 'campos divergentes',
        'accao': 'Os dois documentos não contam a mesma história. Ver as diferenças campo a campo.',
    },
    'RISCO-001': {
        'onde': 'Risco geral do mês',
        'tem': 'caixa_saldo_credor',
        'devia': None,
        'accao': 'Vários sinais juntos num só mês. Começar pelos erros marcados "Corrigir já".',
    },
    'RISCO-002': {
        'onde': 'Exposição acumulada',
        'tem': 'exposicao_total_potencial',
        'devia': None,
        'accao': 'Soma do que pode ser exigido numa inspecção. Regularizar antes reduz o valor.',
    },
    'ANOM-001': {
        'onde': 'IVA lançado a custo — conta 75312',
        'tem': 'iva_custo_contab',
        'devia': None,
        'accao': 'Este IVA virou despesa em vez de ser deduzido. Confirmar se foi de propósito.',
    },
    'IVA-008': {
        'onde': 'Taxa de IVA do período',
        'tem': 'taxa_iva_valor',
        'devia': None,
        'unidade': 'contagem',
        'sufixo': '% liquidado',
        'accao': 'Esta taxa não é nenhuma das taxas legais. Se a declaração junta '
                 'operações a taxas diferentes, está correcto.',
    },
    'IVA-009': {
        'onde': 'Taxa de IVA vs regime da empresa',
        'tem': 'iva_liquidado',
        'devia': None,
        'accao': 'A taxa liquidada não é a do regime registado. Confirmar qual está certo.',
    },
    'IVA-010': {
        'onde': 'Regime de exclusão — IVA liquidado',
        'tem': 'iva_liquidado',
        'devia': None,
        'accao': 'Quem está no regime de exclusão não liquida IVA. Rever o enquadramento.',
    },
    'IVA-011': {
        # O volume de negócios é contexto, não dinheiro em risco — por isso
        # aparece em "tem" e o valor da ocorrência é zero.
        'onde': 'Regime de IVA registado',
        'tem': 'volume_negocios_anual',
        'devia': None,
        'accao': 'O volume de negócios impõe outro regime. Confirmar junto da AGT.',
    },
    'ANOM-002': {
        'onde': 'Fornecedores — conta 321',
        'tem': 'fornec_saldo_devedor',
        'devia': None,
        'accao': 'Pagou-se a fornecedores mais do que se devia. Verificar adiantamentos ou duplicados.',
    },
}

# Severidades que contam como "erro" no contador do cabeçalho.
SEVERIDADES_ERRO = ('ALTO', 'MEDIO', 'BAIXO')

# M10 (Análise de Risco) e M12 (Exposição Potencial) não encontram nada por si:
# por desenho, agregam o que os outros motores já encontraram. Somá-los ao
# valor do topo contaria o mesmo problema duas vezes — a retenção em falta
# apareceria uma vez como RET-001 e outra como EXP-001, e o número que a
# empresa lê ficaria inflacionado. Continuam visíveis na lista, assinalados.
MOTORES_AGREGADORES = ('M10', 'M12')


def _dec(valor):
    if valor is None:
        return None
    try:
        return Decimal(str(valor)).quantize(Decimal('0.01'))
    except Exception:
        return None


def _linha(ocorrencia, contexto):
    """Uma ocorrência como número + onde + acção."""
    regra = ocorrencia.regra
    spec = APRESENTACAO.get(regra.codigo, {})
    evidencia = ocorrencia.evidencia or {}

    tem = _dec(contexto.get(spec.get('tem'))) if spec.get('tem') else None
    devia = _dec(contexto.get(spec.get('devia'))) if spec.get('devia') else None
    diferenca = (
        (devia - tem) if (tem is not None and devia is not None) else None
    )

    return {
        'id': ocorrencia.id,
        'codigo': regra.codigo,
        'motor': regra.motor.codigo,
        'agregador': regra.motor.codigo in MOTORES_AGREGADORES,
        'gravidade': ocorrencia.severidade,
        'estado': ocorrencia.estado,
        'valor': str(ocorrencia.valor_envolvido),
        # 'kz' ou 'contagem'. Uma regra que conta campos divergentes devolve
        # "4"; apresentá-lo como "4 Kz" é falso e somá-lo ao valor em risco
        # mistura kwanzas com unidades que não são dinheiro.
        'unidade': spec.get('unidade', 'kz'),
        'sufixo': spec.get('sufixo'),
        'onde': spec.get('onde') or regra.motor.nome,
        'tem': str(tem) if tem is not None else None,
        'devia': str(devia) if devia is not None else None,
        'diferenca': str(diferenca) if diferenca is not None else None,
        'accao': spec.get('accao') or regra.recomendacao,
        # Tudo o que é jurídico e técnico fica aqui, fora do primeiro olhar.
        'detalhe': {
            'nome_regra': regra.nome,
            'descricao': regra.descricao,
            'condicao': evidencia.get('condicao'),
            'calculo': evidencia.get('calculo'),
            'valores': evidencia.get('valores', {}),
            'fontes': evidencia.get('fontes', []),
            'referencia_legal': evidencia.get('referencia_legal'),
            'recomendacao_tecnica': regra.recomendacao,
            'requer_validacao_juridica': evidencia.get(
                'requer_validacao_juridica', False
            ),
        },
    }


def calcular(empresa, ano, mes, hoje=None):
    """Os números do período, prontos para a interface.

    Não executa as regras: lê o que o Rule Engine já gravou. Quem quiser
    recalcular chama `regra_engine.executar` antes (é o que o upload faz).
    """
    contexto, _fontes = regra_engine.construir_contexto(empresa, ano, mes)
    cobertura = cobertura_service.calcular(empresa, ano, mes)
    prazos = calendario_service.resumo(empresa, ano, mes, hoje=hoje)

    ocorrencias = list(
        Ocorrencia.objects
        .filter(empresa=empresa, ano=ano, mes=mes)
        .exclude(estado='IGNORADA')
        .select_related('regra', 'regra__motor', 'regra__base_legal')
    )

    linhas = [_linha(o, contexto) for o in ocorrencias]
    # Mais grave primeiro; dentro da mesma gravidade, maior valor primeiro.
    # Agregadores por último: resumem, não acrescentam.
    ordem = {'ALTO': 0, 'MEDIO': 1, 'BAIXO': 2, 'INFORMATIVO': 3}
    linhas.sort(
        key=lambda l: (
            l['agregador'], ordem.get(l['gravidade'], 9),
            -(Decimal(l['valor']) if l['unidade'] == 'kz' else Decimal('0')),
        )
    )

    erros = [
        l for l in linhas
        if l['gravidade'] in SEVERIDADES_ERRO and not l['agregador']
    ]
    agregados = [l for l in linhas if l['agregador']]
    em_risco = sum(
        (Decimal(l['valor']) for l in erros if l['unidade'] == 'kz'),
        Decimal('0.00'),
    )

    # "OK" = verificações que correram e não acusaram nada. É o número que
    # dá confiança: mostra que o sistema olhou e não encontrou problema.
    regras_avaliadas = regra_engine.contar_avaliaveis(empresa, ano, mes)
    verificacoes_ok = max(regras_avaliadas - len(erros), 0)

    return {
        'empresa': empresa.id,
        'empresa_nome': empresa.nome,
        'ano': ano,
        'mes': mes,
        'em_risco': str(em_risco),
        'contadores': {
            'erros': len(erros),
            'ok': verificacoes_ok,
            'faltam': len(cobertura['documentos_em_falta']),
            'informativos': len(linhas) - len(erros) - len(agregados),
        },
        'gravidade': {
            'alto': sum(1 for l in linhas if l['gravidade'] == 'ALTO'),
            'medio': sum(1 for l in linhas if l['gravidade'] == 'MEDIO'),
            'baixo': sum(1 for l in linhas if l['gravidade'] == 'BAIXO'),
        },
        'linhas': linhas,
        'prazos': prazos,
        'cobertura': {
            'percentagem': cobertura['cobertura_geral'],
            'nivel': cobertura['nivel'],
            'em_falta': cobertura['documentos_em_falta'],
            'disclaimer': cobertura['disclaimer'],
        },
    }
