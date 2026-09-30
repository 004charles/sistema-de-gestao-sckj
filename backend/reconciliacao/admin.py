from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User
from .models import (
    Empresa, EmpresaUtilizador, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, Motor, DocumentoRequerido, PerfilFiscal,
    BaseLegal, Regra, Ocorrencia,
)


admin.site.site_header = "Administração do Sistema"
admin.site.site_title = "Administração do Sistema"
admin.site.index_title = "Painel de Administração"

class EmpresaUtilizadorInline(admin.TabularInline):
    model = EmpresaUtilizador
    fk_name = 'empresa'
    autocomplete_fields = ('utilizador',)
    extra = 1
    fields = ('utilizador', 'perfil_acesso', 'ativo')
    readonly_fields = ('created_at', 'updated_at')


class UserEmpresaInline(admin.TabularInline):
    model = EmpresaUtilizador
    fk_name = 'utilizador'
    autocomplete_fields = ('empresa',)
    extra = 1
    fields = ('empresa', 'perfil_acesso', 'ativo')


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = (
        'nome', 'nif', 'tipo_entidade', 'estado',
        'regime_iva', 'provincia', 'created_at',
    )
    list_filter = ('estado', 'tipo_entidade', 'provincia', 'regime_iva')
    search_fields = ('nome', 'nome_comercial', 'nif')
    ordering = ('nome',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at', 'info_historico')
    inlines = [EmpresaUtilizadorInline]
    fieldsets = (
        ('Identificação', {
            'fields': ('nome', 'nome_comercial', 'nif', 'tipo_entidade', 'regime_iva'),
        }),
        ('Constituição e atividade', {
            'fields': (
                'data_constituicao', 'data_inicio_atividade',
                'atividade_principal', 'cae_principal',
            ),
        }),
        ('Localização', {
            'fields': ('provincia', 'municipio', 'comuna', 'endereco'),
        }),
        ('Contactos', {
            'fields': ('telefone', 'email', 'website'),
        }),
        ('Dados fiscais e contabilista', {
            'fields': (
                'reparticao_fiscal', 'contabilista_nome',
                'contabilista_contacto', 'periodo_inicial_analise',
            ),
        }),
        ('Estado', {
            'fields': ('estado', 'info_historico'),
            'description': (
                'Prefira marcar como INATIVA ou ENCERRADA. '
                'Empresas com histórico fiscal não podem ser eliminadas fisicamente.'
            ),
        }),
        ('Auditoria técnica', {
            'fields': ('created_at', 'updated_at'),
        }),
    )
    actions = ['marcar_como_inativa', 'marcar_como_encerrada']

    @admin.display(description='Histórico fiscal')
    def info_historico(self, obj):
        if not obj.pk:
            return '—'
        contab = obj.contabilidade.count()
        decl = obj.declaracoes_agt.count()
        reconc = obj.reconciliacoes.count()
        docs = obj.documentos.count()
        resumo = (
            f'{contab} lançamentos, {decl} declarações, '
            f'{reconc} reconciliações, {docs} documentos'
        )
        if obj.tem_historico_fiscal:
            return f'{resumo} — eliminação física bloqueada'
        return f'{resumo} — sem histórico (eliminação permitida)'

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.tem_historico_fiscal:
            return False
        return super().has_delete_permission(request, obj)

    @admin.action(description='Marcar empresas selecionadas como INATIVA')
    def marcar_como_inativa(self, request, queryset):
        updated = queryset.update(estado='INATIVA')
        self.message_user(request, f'{updated} empresa(s) marcada(s) como INATIVA.')

    @admin.action(description='Marcar empresas selecionadas como ENCERRADA')
    def marcar_como_encerrada(self, request, queryset):
        updated = queryset.update(estado='ENCERRADA')
        self.message_user(request, f'{updated} empresa(s) marcada(s) como ENCERRADA.')


@admin.register(EmpresaUtilizador)
class EmpresaUtilizadorAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'empresa', 'perfil_acesso', 'ativo', 'updated_at')
    list_filter = ('perfil_acesso', 'ativo', 'empresa')
    search_fields = (
        'utilizador__username', 'utilizador__first_name',
        'utilizador__last_name', 'empresa__nome', 'empresa__nif',
    )
    autocomplete_fields = ('empresa', 'utilizador')
    readonly_fields = ('created_at', 'updated_at')


admin.site.unregister(User)


@admin.register(User)
class UtilizadorAdmin(DjangoUserAdmin):
    inlines = list(DjangoUserAdmin.inlines) + [UserEmpresaInline]


@admin.register(Contabilidade)
class ContabilidadeAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'conta_codigo', 'conta_descricao', 'ano', 'mes', 'saldo')
    list_filter = ('ano', 'mes', 'empresa')
    search_fields = ('empresa__nome', 'empresa__nif', 'conta_codigo')


@admin.register(DeclaracaoAGT)
class DeclaracaoAGTAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'ano', 'mes', 'iva_liquidado', 'iva_pagar')
    list_filter = ('ano', 'mes', 'empresa')
    search_fields = ('empresa__nome', 'empresa__nif')


@admin.register(Reconciliacao)
class ReconciliacaoAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'ano', 'mes', 'status', 'total_campos_ok', 'total_campos_divergencia')
    list_filter = ('status', 'ano', 'mes')
    search_fields = ('empresa__nome', 'empresa__nif')


@admin.register(ReconciliacaoDetalhe)
class ReconciliacaoDetalheAdmin(admin.ModelAdmin):
    list_display = ('reconciliacao', 'campo', 'valor_contabilidade', 'valor_agt', 'diferenca', 'status')
    list_filter = ('status',)


@admin.register(MapeamentoConta)
class MapeamentoContaAdmin(admin.ModelAdmin):
    list_display = ('conta_contabilidade', 'campo_agt', 'descricao', 'ativo')
    list_filter = ('ativo',)


@admin.register(DocumentoUpload)
class DocumentoUploadAdmin(admin.ModelAdmin):
    list_display = (
        'nome_arquivo', 'tipo', 'estado', 'empresa',
        'mes', 'ano', 'created_at',
    )
    list_filter = ('estado', 'tipo', 'ano', 'mes', 'empresa')
    search_fields = ('nome_arquivo', 'empresa__nome', 'empresa__nif')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'texto_extraido')

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


class DocumentoRequeridoInline(admin.TabularInline):
    model = DocumentoRequerido
    extra = 1


@admin.register(Motor)
class MotorAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'ordem', 'implementacao', 'ativo')
    list_filter = ('implementacao', 'ativo')
    search_fields = ('codigo', 'nome')


@admin.register(PerfilFiscal)
class PerfilFiscalAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'updated_at')
    filter_horizontal = ('motores_aplicaveis',)
    search_fields = ('empresa__nome', 'empresa__nif')


@admin.register(BaseLegal)
class BaseLegalAdmin(admin.ModelAdmin):
    list_display = ('legislacao', 'artigo', 'validado_juridicamente', 'validado_por')
    list_filter = ('validado_juridicamente',)
    search_fields = ('legislacao', 'artigo')


@admin.register(Regra)
class RegraAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'imposto', 'motor', 'severidade',
                    'estado_validacao', 'activa', 'versao')
    list_filter = ('estado_validacao', 'severidade', 'imposto', 'activa')
    search_fields = ('codigo', 'nome')
    readonly_fields = ('validado_por', 'validado_em', 'created_at', 'updated_at')


@admin.register(Ocorrencia)
class OcorrenciaAdmin(admin.ModelAdmin):
    list_display = ('regra', 'empresa', 'mes', 'ano', 'severidade',
                    'valor_envolvido', 'estado', 'created_at')
    list_filter = ('severidade', 'estado', 'ano', 'mes')
    search_fields = ('regra__codigo', 'regra__nome', 'empresa__nome')
    readonly_fields = ('evidencia', 'versao_regra', 'revisado_por',
                       'revisado_em', 'created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
