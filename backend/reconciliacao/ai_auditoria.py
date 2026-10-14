"""Camada de IA da auditoria — comenta, não decide.

A empresa pediu inteligência artificial em todo o sistema. A forma de o fazer
sem destruir o que o sistema tem de mais valioso é a que o próprio PROMPT
MESTRE fixa (§32): **legislação → regra → cálculo → resultado → a IA explica**.

Porquê. Uma ocorrência deste sistema é oponível: traz as fontes documentais,
os valores, a fórmula, a diferença e o artigo. Se fosse um modelo de
linguagem a decidir se há ou não infracção, nada disso existiria — o número
mudaria entre execuções e não haveria como o defender perante a AGT. Por isso
a IA aqui recebe factos já apurados e produz três coisas que o Rule Engine não
sabe fazer: redacção técnica, leitura de risco e prioridade de actuação.

Garantias:
- A IA nunca vê o pedido do utilizador, só o rasto da auditoria.
- Os montantes do parecer são os do rasto; há verificação de que não inventou
  valores novos (`_validar_montantes`).
- Se a IA falhar ou estiver indisponível, devolve-se o parecer determinístico.
  O sistema nunca fica sem resposta por causa do modelo.
"""
import logging
import re
from decimal import Decimal

from .pdf_service import MODELS_DISPONIVEIS, get_groq_client

logger = logging.getLogger('reconciliacao')

MAX_PASSOS_NO_PROMPT = 60
TEMPERATURA = 0.15
MAX_TOKENS = 1800

SISTEMA = """És auditor fiscal sénior em Angola, a redigir para um colega \
contabilista. Escreves em português de Angola, com terminologia técnica \
correcta: contas do PGC (Decreto n.º 82/01), Código do IVA (Lei n.º 7/19 e \
42/20), Código do IRT (Lei n.º 18/14, 28/20 e 14/25), Código do Imposto \
Industrial (Lei n.º 19/14 e 26/20), Lei n.º 07/04 da Protecção Social.

REGRAS ABSOLUTAS:
1. Usa APENAS os valores que constam do rasto fornecido. Não calcules \
montantes novos nem arredondes os existentes.
2. Se um dado não constar do rasto, escreve "não apurado". Nunca presumas.
3. Não uses as palavras "fraude", "crime", "evasão", nem afirmes que há multa \
devida. Escreve "requer revisão", "exposição potencial", "contingência".
4. Toda a afirmação de direito indica a norma que a sustenta.
5. Não repitas o rasto linha a linha: interpreta-o."""


def _kz(valor):
    return f'{Decimal(str(valor)):,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')


def _montantes(texto):
    """Montantes citados num texto, para confrontar com os do rasto."""
    return {
        m.replace('.', '').replace(',', '.')
        for m in re.findall(r'\d{1,3}(?:\.\d{3})*,\d{2}', texto or '')
    }


def _resumir_rasto(rasto):
    """O rasto em texto, só com o que é facto verificável."""
    linhas = [
        f"EMPRESA: {rasto['empresa']} (NIF {rasto['nif']})",
        f"PERÍODO: {rasto['periodo']}",
        '',
        'RASTO DA AUDITORIA:',
    ]
    fase_actual = None
    # Alertas e falhas primeiro: são o que interessa comentar, e o contexto
    # tem limite.
    ordenados = sorted(
        rasto['passos'],
        key=lambda p: {'FALHA': 0, 'ALERTA': 1, 'INFO': 2, 'OK': 3}.get(p['estado'], 9),
    )[:MAX_PASSOS_NO_PROMPT]
    # Repõe a ordem original para o relato ficar cronológico.
    ordem = {id(p): i for i, p in enumerate(rasto['passos'])}
    for passo in sorted(ordenados, key=lambda p: ordem[id(p)]):
        if passo['fase'] != fase_actual:
            fase_actual = passo['fase']
            linhas.append(f'\n[{fase_actual}]')
        parte = f"  {passo['estado']:<7} {passo['codigo']:<12} {passo['texto']}"
        if passo['valor']:
            parte += f" | valor: {passo['valor']} Kz"
        if passo['norma']:
            parte += f" | norma: {passo['norma']}"
        linhas.append(parte)
    return '\n'.join(linhas)


def _chamar(mensagens, max_tokens=MAX_TOKENS):
    """Primeira resposta não-vazia entre os modelos disponíveis."""
    cliente = get_groq_client()
    ultimo_erro = None
    for modelo in MODELS_DISPONIVEIS:
        try:
            resposta = cliente.chat.completions.create(
                model=modelo, messages=mensagens,
                temperature=TEMPERATURA, max_tokens=max_tokens,
            )
            conteudo = (resposta.choices[0].message.content or '').strip()
            if conteudo:
                logger.info('Parecer gerado com %s', modelo)
                return conteudo, modelo
            logger.warning('Modelo %s devolveu resposta vazia.', modelo)
        except Exception as exc:
            ultimo_erro = exc
            logger.warning('Modelo %s indisponível: %s', modelo, exc)
    raise RuntimeError(f'Nenhum modelo respondeu. Último erro: {ultimo_erro}')


def _validar_montantes(texto, rasto):
    """Montantes do parecer que não existem no rasto.

    Não serve para censurar o texto — serve para o marcar. Um parecer com
    números que a auditoria não produziu não pode ser apresentado como
    verificado, e quem o lê tem direito a saber disso.
    """
    do_rasto = set()
    for passo in rasto['passos']:
        if passo['valor']:
            do_rasto.add(passo['valor'].replace('.', '').replace(',', '.'))
        do_rasto |= _montantes(passo['texto'])
    return sorted(_montantes(texto) - do_rasto)


def parecer(rasto, numeros):
    """Parecer técnico sobre o período, para o contabilista.

    Devolve sempre um resultado: se a IA não responder, vem o parecer
    determinístico, assinalado como tal.
    """
    resumo = _resumir_rasto(rasto)
    pedido = f"""{resumo}

Redige o parecer técnico do período, em Markdown, com esta estrutura exacta:

## Enquadramento
Dois períodos sobre o enquadramento da empresa e a cobertura documental da
auditoria. Diz o que foi possível auditar e o que ficou de fora.

## Achados
Um ponto por achado, do mais grave para o menos. Em cada um: a conta do PGC
ou o campo da declaração, o valor, a norma, e o que o contabilista deve fazer
no lançamento ou na declaração.

## Exposição
Que contingência a empresa corre se isto não for corrigido, e porquê. Não
quantifiques multas; indica o montante em causa e a natureza do risco.

## Prioridade
Lista numerada do que fazer primeiro, com o prazo quando houver."""

    try:
        texto, modelo = _chamar([
            {'role': 'system', 'content': SISTEMA},
            {'role': 'user', 'content': pedido},
        ])
    except Exception as exc:
        logger.exception('Parecer por IA indisponível')
        return {
            'texto': parecer_deterministico(rasto, numeros),
            'origem': 'DETERMINISTICO',
            'modelo': None,
            'aviso': (
                'Parecer gerado sem IA (modelo indisponível). O conteúdo vem '
                'directamente do rasto da auditoria.'
            ),
            'erro': str(exc)[:200],
            'montantes_nao_verificados': [],
        }

    nao_verificados = _validar_montantes(texto, rasto)
    return {
        'texto': texto,
        'origem': 'IA',
        'modelo': modelo,
        'aviso': (
            'Redacção assistida por IA sobre factos apurados pelo motor '
            'determinístico. Os cálculos não são da IA.'
        ),
        'montantes_nao_verificados': nao_verificados,
    }


def riscos(rasto, numeros):
    """Leitura de risco: a que é que a empresa está exposta, e porquê."""
    linhas_erro = [
        l for l in numeros.get('linhas', [])
        if l['gravidade'] in ('ALTO', 'MEDIO') and not l['agregador']
    ]
    if not linhas_erro:
        return {
            'texto': (
                'Não foram identificados achados de gravidade alta ou média no '
                'período, dentro do âmbito auditado.'
            ),
            'origem': 'DETERMINISTICO',
            'modelo': None,
            'montantes_nao_verificados': [],
        }

    inventario = '\n'.join(
        '- [{}] {} | {} | valor {} Kz | {}'.format(
            l['gravidade'], l['codigo'], l['onde'], l['valor'],
            (l['detalhe'] or {}).get('referencia_legal', 'sem norma'),
        )
        for l in linhas_erro
    )
    prazos = numeros.get('prazos', {})
    pendentes = [
        o for o in prazos.get('obrigacoes', [])
        if o['estado'] in ('VENCIDA', 'CUMPRIDA_FORA_PRAZO')
    ]
    texto_prazos = '\n'.join(
        '- {} ({}) — {} — limite {} — por liquidar {} Kz'.format(
            o['imposto'], o['tipo'].lower(), o['estado'],
            o['data_limite'], o['em_falta'],
        )
        for o in pendentes
    ) or '- Sem obrigações vencidas no período.'

    pedido = f"""EMPRESA: {rasto['empresa']} (NIF {rasto['nif']})
PERÍODO: {rasto['periodo']}
MONTANTE AGREGADO EM CAUSA: {numeros['em_risco']} Kz

ACHADOS:
{inventario}

OBRIGAÇÕES EM ATRASO:
{texto_prazos}

Para um contabilista, em Markdown e sem repetir a lista acima:

## Riscos
Três a cinco riscos concretos, cada um com: a que está exposta, que norma o
fundamenta, e o que o despoleta numa inspecção. Começa pelo mais provável.

## O que agrava
Factores que tornam estes achados mais perigosos do que parecem isoladamente
(acumulação entre períodos, cruzamentos que a AGT faz, obrigações acessórias).

## O que o protege
O que já está correcto e serve de defesa documental."""

    try:
        texto, modelo = _chamar([
            {'role': 'system', 'content': SISTEMA},
            {'role': 'user', 'content': pedido},
        ], max_tokens=1400)
    except Exception as exc:
        logger.exception('Leitura de risco por IA indisponível')
        return {
            'texto': _riscos_deterministicos(linhas_erro, pendentes),
            'origem': 'DETERMINISTICO',
            'modelo': None,
            'erro': str(exc)[:200],
            'montantes_nao_verificados': [],
        }

    return {
        'texto': texto,
        'origem': 'IA',
        'modelo': modelo,
        'montantes_nao_verificados': _validar_montantes(texto, rasto),
    }


def parecer_deterministico(rasto, numeros):
    """Parecer sem IA — o rasto organizado. Nunca falha."""
    linhas = [
        f"# Parecer técnico — {rasto['empresa']}",
        f"**Período:** {rasto['periodo']} · **NIF:** {rasto['nif']}",
        '',
        '## Enquadramento',
        f"Foram executados {rasto['total']} passos de verificação, "
        f"com {rasto['alertas']} alertas e {rasto['falhas']} falhas de leitura.",
        '',
        '## Achados',
    ]
    for passo in rasto['passos']:
        if passo['estado'] != 'ALERTA':
            continue
        linha = f"- **{passo['codigo']}** — {passo['texto']}"
        if passo['valor']:
            linha += f" · **{passo['valor']} Kz**"
        if passo['norma']:
            linha += f" · _{passo['norma']}_"
        linhas.append(linha)
    if rasto['alertas'] == 0:
        linhas.append('- Sem achados no âmbito auditado.')

    linhas += [
        '',
        '## Exposição',
        f"Montante agregado em causa: **{_kz(numeros['em_risco'])} Kz** "
        f"em {numeros['contadores']['erros']} achados.",
        '',
        '## Prioridade',
    ]
    for i, linha_erro in enumerate(
        [l for l in numeros.get('linhas', []) if not l['agregador']][:5], 1
    ):
        linhas.append(f"{i}. {linha_erro['onde']} — {linha_erro['accao']}")
    return '\n'.join(linhas)


def _riscos_deterministicos(linhas_erro, pendentes):
    partes = ['## Riscos', '']
    for linha in linhas_erro[:5]:
        referencia = (linha['detalhe'] or {}).get('referencia_legal', '')
        partes.append(
            f"- **{linha['onde']}** — {linha['valor']} Kz. {linha['accao']} "
            f"{('_' + referencia + '_') if referencia else ''}"
        )
    if pendentes:
        partes += ['', '## Obrigações em atraso', '']
        partes += [
            f"- {o['imposto']} ({o['tipo'].lower()}) — limite {o['data_limite']}, "
            f"por liquidar {o['em_falta']} Kz"
            for o in pendentes
        ]
    return '\n'.join(partes)
