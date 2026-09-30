"""Cálculo de cobertura de auditoria por (empresa, ano, mes) — Fase 3.

Regras (Regra de Ouro do plano):
- Só entram motores APPLICÁVEIS (perfil fiscal ou default por regime) e activos.
- Só contam documentos do período com estado VALIDADO ou UTILIZADO.
- % geral = docs disponíveis necessários / docs necessários (ponderada por motor:
  motores com mais documentos pesam mais).
- Níveis: LIMITADA < 40% ≤ PARCIAL < 75% ≤ AMPLA < 100% = COMPLETA.
- "COMPLETA" nunca esconde lacunas: motors sem matriz são listados à parte
  (SEM_MATRIZ) e o disclaimer é sempre devolvido.
"""
from .models import DocumentoUpload, Motor, PerfilFiscal
from .motores_seed import DISCLAIMER_COBERTURA

ESTADOS_CONTAM = ('VALIDADO', 'UTILIZADO')


def nivel_para_percentagem(percentual):
    if percentual is None:
        return 'NAO_CALCULAVEL'
    if percentual >= 100:
        return 'COMPLETA'
    if percentual >= 75:
        return 'AMPLA'
    if percentual >= 40:
        return 'PARCIAL'
    return 'LIMITADA'


def motores_aplicaveis(empresa):
    """Motores activos aplicáveis: perfil fiscal (se definido) ∩ regime."""
    base = Motor.objects.filter(ativo=True)
    perfil = PerfilFiscal.objects.filter(empresa=empresa).first()
    if perfil is not None:
        ids = list(perfil.motores_aplicaveis.values_list('id', flat=True))
        if ids:
            base = base.filter(id__in=ids)
    return [
        motor for motor in base.order_by('ordem', 'codigo')
        if not motor.regimes_aplicaveis
        or empresa.regime_iva in motor.regimes_aplicaveis
    ]


def calcular(empresa, ano, mes):
    """Devolve o dicionário completo de cobertura do período."""
    tipos_disponiveis = set(
        DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, mes=mes,
            estado__in=ESTADOS_CONTAM,
        ).values_list('tipo', flat=True)
    )

    motores = motores_aplicaveis(empresa)
    por_motor = []
    em_falta = {}
    total_requeridos = 0
    total_disponiveis = 0
    sem_matriz = []

    for motor in motores:
        requeridos = list(motor.documentos_requeridos.all())
        if not requeridos:
            sem_matriz.append({'codigo': motor.codigo, 'nome': motor.nome})
            por_motor.append({
                'codigo': motor.codigo,
                'nome': motor.nome,
                'implementacao': motor.implementacao,
                'cobertura': None,
                'estado': 'SEM_MATRIZ',
                'requeridos': 0,
                'disponiveis': 0,
            })
            continue

        presentes = [
            r.tipo_documento for r in requeridos
            if r.tipo_documento in tipos_disponiveis
        ]
        percentual = round(len(presentes) / len(requeridos) * 100, 1)
        total_requeridos += len(requeridos)
        total_disponiveis += len(presentes)

        for requerido in requeridos:
            if requerido.tipo_documento not in tipos_disponiveis:
                entrada = em_falta.setdefault(requerido.tipo_documento, {
                    'tipo': requerido.tipo_documento,
                    'motores': [],
                })
                if motor.codigo not in [m['codigo'] for m in entrada['motores']]:
                    entrada['motores'].append({
                        'codigo': motor.codigo, 'nome': motor.nome,
                    })

        if percentual >= 100:
            estado_motor = 'COMPLETO'
        elif percentual == 0:
            estado_motor = 'VAZIO'
        else:
            estado_motor = 'PARCIAL'

        por_motor.append({
            'codigo': motor.codigo,
            'nome': motor.nome,
            'implementacao': motor.implementacao,
            'cobertura': percentual,
            'estado': estado_motor,
            'requeridos': len(requeridos),
            'disponiveis': len(presentes),
        })

    if total_requeridos:
        geral = round(total_disponiveis / total_requeridos * 100, 1)
    else:
        geral = None

    periodo = f'{mes:02d}/{ano}'
    documentos_em_falta = []
    for tipo, entrada in sorted(em_falta.items()):
        nomes = ', '.join(m['nome'] for m in entrada['motores'])
        documentos_em_falta.append({
            'tipo': tipo,
            'motores': entrada['motores'],
            'periodo': periodo,
            'disponivel': False,
            'desbloqueia': f'desbloqueia {nomes}; período {periodo}',
        })

    return {
        'empresa': empresa.id,
        'empresa_nome': empresa.nome,
        'ano': ano,
        'mes': mes,
        'cobertura_geral': geral,
        'nivel': nivel_para_percentagem(geral),
        'motores': por_motor,
        'motores_sem_matriz': sem_matriz,
        'documentos_disponiveis': sorted(tipos_disponiveis),
        'documentos_em_falta': documentos_em_falta,
        'disclaimer': DISCLAIMER_COBERTURA,
    }
