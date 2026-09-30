from django.core.management.base import BaseCommand

from reconciliacao.regras_seed import semear_regras


class Command(BaseCommand):
    help = (
        'Cria/actualiza as regras IVA iniciais com base legal '
        '(POR_VALIDAR, idempotente).'
    )

    def handle(self, *args, **options):
        contagem = semear_regras()
        self.stdout.write(self.style.SUCCESS(
            f"Bases legais: {contagem['bases_legais']} | Regras: {contagem['regras']}"
        ))
