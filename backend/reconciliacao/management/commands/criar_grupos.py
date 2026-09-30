from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

ACOES_TODAS = ('view', 'add', 'change', 'delete')

MODELOS_APP = (
    'empresa', 'empresautilizador', 'contabilidade', 'declaracaoagt',
    'reconciliacao', 'reconciliacaodetalhe', 'mapeamentoconta',
    'documentoupload', 'analiseia',
    'motor', 'documentorequerido', 'perfilfiscal',
    'baselegal', 'regra', 'ocorrencia',
)

GRUPOS = {
    'Super Admin': {
        '__all__': True,
    },
    'Administrador': {
        '__app__': True,
        'auth': {
            'user': ACOES_TODAS,
            'group': ACOES_TODAS,
        },
    },
    'Auditor': {
        'reconciliacao': {
            'empresa': ['view'],
            'contabilidade': ['view'],
            'declaracaoagt': ['view'],
            'reconciliacao': ['view', 'add', 'change'],
            'reconciliacaodetalhe': ['view', 'add', 'change'],
            'mapeamentoconta': ['view'],
            'documentoupload': ['view', 'add'],
            'analiseia': ['view', 'add'],
            'ocorrencia': ['view', 'add', 'change'],
            'regra': ['view'],
            'baselegal': ['view'],
        },
    },
    'Contabilista': {
        'reconciliacao': {
            'empresa': ['view'],
            'contabilidade': ['view', 'add', 'change', 'delete'],
            'declaracaoagt': ['view', 'add', 'change'],
            'reconciliacao': ['view'],
            'reconciliacaodetalhe': ['view'],
            'mapeamentoconta': ['view'],
            'documentoupload': ['view', 'add'],
            'analiseia': ['view'],
            'ocorrencia': ['view'],
            'regra': ['view'],
            'baselegal': ['view'],
        },
    },
    'Fiscalista': {
        'reconciliacao': {
            'empresa': ['view'],
            'contabilidade': ['view'],
            'declaracaoagt': ['view', 'add', 'change'],
            'reconciliacao': ['view', 'add', 'change'],
            'reconciliacaodetalhe': ['view', 'add', 'change'],
            'mapeamentoconta': ['view', 'add', 'change'],
            'documentoupload': ['view', 'add'],
            'analiseia': ['view'],
            'ocorrencia': ['view', 'add', 'change'],
            'regra': ['view', 'change'],
            'baselegal': ['view', 'change'],
        },
    },
    'Analista': {
        'reconciliacao': {
            'empresa': ['view'],
            'contabilidade': ['view'],
            'declaracaoagt': ['view'],
            'reconciliacao': ['view'],
            'reconciliacaodetalhe': ['view'],
            'mapeamentoconta': ['view'],
            'documentoupload': ['view', 'add'],
            'analiseia': ['view', 'add'],
            'ocorrencia': ['view', 'add', 'change'],
            'regra': ['view'],
            'baselegal': ['view'],
        },
    },
    'Consulta': {
        'reconciliacao': {
            'empresa': ['view'],
            'contabilidade': ['view'],
            'declaracaoagt': ['view'],
            'reconciliacao': ['view'],
            'reconciliacaodetalhe': ['view'],
            'mapeamentoconta': ['view'],
            'documentoupload': ['view'],
            'analiseia': ['view'],
            'ocorrencia': ['view'],
            'regra': ['view'],
            'baselegal': ['view'],
        },
    },
}


class Command(BaseCommand):
    help = (
        'Cria (ou sincroniza) os grupos do sistema e as suas permissões: '
        + ', '.join(GRUPOS)
    )

    def _permissao(self, app_label, model, acao):
        return Permission.objects.filter(
            content_type__app_label=app_label,
            content_type__model=model,
            codename=f'{acao}_{model}',
        ).first()

    def resolver(self, config):
        permissoes = []
        if config.get('__all__'):
            return list(Permission.objects.all())
        if config.get('__app__'):
            permissoes.extend(
                Permission.objects.filter(content_type__app_label='reconciliacao')
            )
            config = {k: v for k, v in config.items() if not k.startswith('__')}
        for app_label, modelos in config.items():
            for model, acoes in modelos.items():
                for acao in acoes:
                    perm = self._permissao(app_label, model, acao)
                    if perm is None:
                        self.stdout.write(
                            f'  Aviso: permissão nao encontrada: {app_label}.{acao}_{model}'
                        )
                    else:
                        permissoes.append(perm)
        return permissoes

    def handle(self, *args, **options):
        if not Permission.objects.exists():
            self.stdout.write(self.style.ERROR(
                'Nao existem permissoes no sistema. Execute primeiro: python manage.py migrate'
            ))
            return

        for nome, config in GRUPOS.items():
            grupo, created = Group.objects.get_or_create(name=nome)
            permissoes = self.resolver(config)
            grupo.permissions.set(permissoes)
            acao = 'criado' if created else 'sincronizado'
            self.stdout.write(self.style.SUCCESS(
                f'Grupo {acao}: {nome} ({len(permissoes)} permissoes)'
            ))

        self.stdout.write(self.style.SUCCESS('Grupos e permissoes prontos.'))
