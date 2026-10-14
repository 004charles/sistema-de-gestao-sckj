"""Actualiza as bases legais de IRT já gravadas para a Lei n.º 14/25.

O seed cria bases novas, mas as que já estão na base de dados continuariam a
citar apenas a Lei 18/14 e a Lei 28/20 — e são essas que aparecem na evidência
de cada ocorrência. Uma citação legal desactualizada numa evidência é pior do
que nenhuma, porque parece verificada.

Como a redacção mudou, a validação jurídica anterior deixa de valer: as bases
alteradas voltam a `validado_juridicamente=False`, para serem reconfirmadas.
"""
from django.db import migrations

ANTIGA = 'Lei n.º 18/14 e Lei n.º 28/20'
NOVA = (
    'Lei n.º 18/14, alterada pela Lei n.º 28/20 e pela Lei n.º 14/25 (OGE 2026)'
)


def actualizar(apps, schema_editor):
    BaseLegal = apps.get_model('reconciliacao', 'BaseLegal')
    for base in BaseLegal.objects.filter(legislacao__contains=ANTIGA):
        base.legislacao = base.legislacao.replace(ANTIGA, NOVA)
        base.validado_juridicamente = False
        base.validado_por = None
        base.validado_em = None
        base.save(update_fields=[
            'legislacao', 'validado_juridicamente', 'validado_por', 'validado_em',
        ])


def reverter(apps, schema_editor):
    BaseLegal = apps.get_model('reconciliacao', 'BaseLegal')
    for base in BaseLegal.objects.filter(legislacao__contains=NOVA):
        base.legislacao = base.legislacao.replace(NOVA, ANTIGA)
        base.save(update_fields=['legislacao'])


class Migration(migrations.Migration):

    dependencies = [
        ('reconciliacao', '0010_normalizar_regimes'),
    ]

    operations = [
        migrations.RunPython(actualizar, reverter),
    ]
