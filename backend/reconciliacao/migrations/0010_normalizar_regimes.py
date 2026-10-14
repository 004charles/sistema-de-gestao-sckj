"""Normaliza as grafias de regime de IVA já gravadas.

A base tinha "Geral", "Regime Geral" e "Simplificado" a conviver, o que
impedia filtrar motores por regime: três grafias para dois regimes.
"""
from django.db import migrations


def normalizar(apps, schema_editor):
    from reconciliacao.taxas import normalizar_regime, REGIME_GERAL

    Empresa = apps.get_model('reconciliacao', 'Empresa')
    for empresa in Empresa.objects.all():
        canonico = normalizar_regime(empresa.regime_iva) or REGIME_GERAL
        if canonico != empresa.regime_iva:
            empresa.regime_iva = canonico
            empresa.save(update_fields=['regime_iva'])


def reverter(apps, schema_editor):
    """Volta às designações por extenso, sem perder a distinção."""
    Empresa = apps.get_model('reconciliacao', 'Empresa')
    legivel = {
        'GERAL': 'Geral',
        'SIMPLIFICADO': 'Simplificado',
        'EXCLUSAO': 'Exclusão',
    }
    for empresa in Empresa.objects.all():
        if empresa.regime_iva in legivel:
            empresa.regime_iva = legivel[empresa.regime_iva]
            empresa.save(update_fields=['regime_iva'])


class Migration(migrations.Migration):

    dependencies = [
        ('reconciliacao', '0009_regime_iva_estruturado'),
    ]

    operations = [
        migrations.RunPython(normalizar, reverter),
    ]
