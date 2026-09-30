from django.core.management.base import BaseCommand

from reconciliacao.motores_seed import semear_motores


class Command(BaseCommand):
    help = 'Cria/actualiza os 15 motores de auditoria e a matriz documental (idempotente).'

    def handle(self, *args, **options):
        contagem = semear_motores()
        self.stdout.write(self.style.SUCCESS(
            f"Motores: {contagem['motores']} | Documentos requeridos: "
            f"{contagem['documentos_requeridos']}"
        ))
