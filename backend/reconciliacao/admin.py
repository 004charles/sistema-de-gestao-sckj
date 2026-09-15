from django.contrib import admin
from .models import (
    Empresa, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta
)


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'nif', 'regime_iva', 'ativo')
    search_fields = ('nome', 'nif')


@admin.register(Contabilidade)
class ContabilidadeAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'conta_codigo', 'conta_descricao', 'ano', 'mes', 'saldo')
    list_filter = ('ano', 'mes', 'empresa')


@admin.register(DeclaracaoAGT)
class DeclaracaoAGTAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'ano', 'mes', 'iva_liquidado', 'iva_pagar')
    list_filter = ('ano', 'mes', 'empresa')


@admin.register(Reconciliacao)
class ReconciliacaoAdmin(admin.ModelAdmin):
    list_display = ('empresa', 'ano', 'mes', 'status', 'total_campos_ok', 'total_campos_divergencia')
    list_filter = ('status', 'ano', 'mes')


@admin.register(ReconciliacaoDetalhe)
class ReconciliacaoDetalheAdmin(admin.ModelAdmin):
    list_display = ('reconciliacao', 'campo', 'valor_contabilidade', 'valor_agt', 'diferenca', 'status')
    list_filter = ('status',)


@admin.register(MapeamentoConta)
class MapeamentoContaAdmin(admin.ModelAdmin):
    list_display = ('conta_contabilidade', 'campo_agt', 'descricao', 'ativo')
