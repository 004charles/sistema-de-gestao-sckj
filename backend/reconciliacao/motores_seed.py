"""Seed do catálogo de 15 motores e da matriz documental §7 (Fase 3).

Idempotente: correr várias vezes não duplica. Usado pelo comando
`manage.py seed_motores` e pelos testes.
"""
from .models import DocumentoRequerido, Motor

# (codigo, nome, descricao, ordem, implementacao, matriz de documentos)
MOTORES = [
    ('M1', 'Motor IVA completo',
     'Liquidado, dedutível, apurar/pagar/recuperar, taxas, operações tributáveis e isentas.',
     1, 'ACTIVO',
     ['BALANCETE', 'MODELO7']),
    ('M2', 'IRT (Imposto sobre o Rendimento do Trabalho)',
     'Retenções de IRT na fonte sobre salários e folha, confronto com declarações.',
     2, 'ACTIVO',
     ['BALANCETE']),
    ('M3', 'Imposto Industrial',
     'Lucro tributável estimado, retenções na fonte de clientes e ajustamentos fiscais.',
     3, 'ACTIVO',
     ['BALANCETE']),
    ('M4', 'Retenções na Fonte',
     'Taxas e valores retidos a fornecedores e colaboradores vs declarações e pagamentos.',
     4, 'ACTIVO',
     ['BALANCETE']),
    ('M5', 'Segurança Social',
     'Contribuições de empresa (8%) e trabalhador (3%) vs folha e pagamentos ao INSS.',
     5, 'ACTIVO',
     ['BALANCETE']),
    ('M6', 'Imposto do Selo',
     'Operações sujeitas a selo, recibos de quitação e documentos contratuais.',
     6, 'ACTIVO',
     ['BALANCETE']),
    ('M7', 'Facturação',
     'Duplicações, saltos de numeração, NIF de clientes/fornecedores e taxas em factura.',
     7, 'ACTIVO',
     ['BALANCETE', 'MODELO7']),
    ('M8', 'Auditoria Contabilística (PGC)',
     'Saldos anormais/negativos de caixa e terceiros, balanceamento e coerência de razão.',
     8, 'ACTIVO',
     ['BALANCETE']),
    ('M9', 'Reconciliação Generalizada',
     'Factura → contabilidade → balancete → declaração → pagamento.',
     9, 'ACTIVO',
     ['BALANCETE', 'MODELO7']),
    ('M10', 'Análise de Risco (agregador)',
     'Combina ocorrências dos restantes motores num nível de risco consolidado.',
     10, 'ACTIVO',
     []),
    ('M11', 'Obrigações e Prazos',
     'Obrigações declarativas e de pagamento do período vs prazos fiscais angolanos.',
     11, 'ACTIVO',
     ['MODELO7']),
    ('M12', 'Exposição Potencial',
     'Agrega contingências potenciais com fundamentação legal sem pré-julgar multas.',
     12, 'ACTIVO',
     []),
    ('M13', 'Anomalias Contabilísticas',
     'Variações bruscas, saldos anormais e custos sem correspondência. "Requer revisão".',
     13, 'ACTIVO',
     ['BALANCETE']),
    ('M14', 'Análise Histórica',
     'Variações mês-a-mês de receitas, IVA e custos entre períodos.',
     14, 'ACTIVO',
     ['BALANCETE']),
    ('M15', 'Relatório Estruturado',
     'Relatório de auditoria começando pela cobertura, evidências completas e recomendações.',
     15, 'ACTIVO',
     ['BALANCETE', 'MODELO7']),
]

DISCLAIMER_COBERTURA = (
    'Cobertura calculada apenas sobre documentos com estado Validado ou '
    'Utilizado do período indicado e sobre os motores aplicáveis com matriz '
    'documental. Não substitui validação jurídica nem análise completa.'
)


def semear_motores():
    """Cria/actualiza os 15 motores e sincroniza a matriz. Devolve contagens."""
    total_motores = 0
    total_requeridos = 0
    for codigo, nome, descricao, ordem, implementacao, matriz in MOTORES:
        motor, _ = Motor.objects.update_or_create(
            codigo=codigo,
            defaults={
                'nome': nome,
                'descricao': descricao,
                'ordem': ordem,
                'implementacao': implementacao,
                'ativo': True,
            },
        )
        total_motores += 1
        esperados = set(matriz)
        existentes = set(
            motor.documentos_requeridos.values_list('tipo_documento', flat=True)
        )
        for tipo in existentes - esperados:
            motor.documentos_requeridos.filter(tipo_documento=tipo).delete()
        for tipo in esperados - existentes:
            DocumentoRequerido.objects.create(motor=motor, tipo_documento=tipo)
        total_requeridos += len(esperados)
    return {'motores': total_motores, 'documentos_requeridos': total_requeridos}
