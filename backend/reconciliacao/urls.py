from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'empresas', views.EmpresaViewSet)
router.register(r'contabilidade', views.ContabilidadeViewSet)
router.register(r'declaracoes-agt', views.DeclaracaoAGTViewSet)
router.register(r'reconciliacoes', views.ReconciliacaoViewSet)
router.register(r'reconciliacao-detalhes', views.ReconciliacaoDetalheViewSet)
router.register(r'mapeamento-contas', views.MapeamentoContaViewSet)

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('contabilidade/lancamentos/', views.listar_criar_lancamentos_view, name='contabilidade-lancamentos'),
    path('contabilidade/lancamentos/<int:lancamento_id>/', views.detalhe_lancamento_view, name='contabilidade-lancamento-detalhe'),
    path('contabilidade/razao/', views.razao_contabilistico_view, name='contabilidade-razao'),
    path('contabilidade/balancete-gerado/', views.balancete_gerado_view, name='contabilidade-balancete-gerado'),
    path('dashboard/<int:empresa_id>/', views.dashboard_view, name='dashboard'),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/cobertura/',
        views.cobertura_view, name='cobertura',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/numeros/',
        views.numeros_view, name='numeros',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/prazos/',
        views.prazos_view, name='prazos',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/dashboard/',
        views.dashboard_auditoria_periodo_view, name='dashboard-auditoria-periodo',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/rasto/',
        views.rasto_auditoria_view, name='rasto-auditoria',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/parecer/',
        views.parecer_ia_view, name='parecer-ia',
    ),
    path('relatorios/resumo/', views.relatorio_resumo_view, name='relatorio-resumo'),
    path('admin/estatisticas/', views.admin_estatisticas_view, name='admin-estatisticas'),
    path('admin/configuracoes/', views.admin_configuracoes_view, name='admin-configuracoes'),
    path('admin/utilizadores/', views.admin_utilizadores_view, name='admin-utilizadores'),
    path('admin/utilizadores/<int:user_id>/', views.admin_utilizador_detalhe_view, name='admin-utilizador-detalhe'),
    path('admin/registro-tentativa/', views.admin_registrar_tentativa_view, name='admin-registrar-tentativa'),
    path('admin/registros-acesso/', views.admin_listar_registros_acesso_view, name='admin-listar-registros-acesso'),
    path('admin/pgc/', views.admin_pgc_view, name='admin-pgc'),
    path('admin/pgc/exportar-excel/', views.admin_pgc_export_excel_view, name='admin-pgc-exportar-excel'),
    path('pgc/', views.admin_pgc_view, name='pgc-view'),
    path('pgc/exportar-excel/', views.admin_pgc_export_excel_view, name='pgc-export-excel'),
    path('legislacao/', views.legislacao_fiscal_view, name='legislacao-fiscal'),
    path('legislacao/exportar-excel/', views.legislacao_fiscal_export_excel_view, name='legislacao-fiscal-export-excel'),
    path('documentos/detectar/', views.detectar_documento_view, name='detectar-documento'),
    path('documentos/upload/', views.upload_documento_view, name='upload-documento'),
    path('documentos/listar/', views.listar_documentos_view, name='listar-documentos'),
    path('documentos/<int:documento_id>/', views.deletar_documento_view, name='deletar-documento'),
    path('analises/analise-documentos/', views.analisar_documentos_view, name='analisar-documentos'),
    path('analises/analise-documento/', views.analisar_documento_unico_view, name='analisar-documento'),
    path('analises/historico/', views.historico_analises_view, name='historico-analises'),
    path('analises/historico/<int:analise_id>/', views.deletar_analise_view, name='deletar-analise'),
    path('analises/exportar-excel/', views.confronto_export_excel_view, name='confronto-export-excel-post'),
    path('analises/<int:analise_id>/exportar-excel/', views.confronto_export_excel_view, name='confronto-export-excel'),
    path('consolidacao-anual/<int:empresa_id>/<int:ano>/', views.consolidacao_anual_view, name='consolidacao-anual'),
    path('consolidacao-anual/<int:empresa_id>/<int:ano>/exportar-excel/', views.consolidacao_anual_exportar_excel_view, name='consolidacao-anual-exportar-excel'),
    path('ocorrencias/', views.listar_ocorrencias_view, name='listar-ocorrencias'),
    path('ocorrencias/executar/', views.executar_ocorrencias_view, name='executar-ocorrencias'),
    path('ocorrencias/<int:ocorrencia_id>/', views.detalhe_ocorrencia_view, name='detalhe-ocorrencia'),
    path('taxas/', views.taxas_view, name='taxas'),
    path('regras/', views.listar_regras_view, name='listar-regras'),
    path('regras/<int:regra_id>/', views.validar_regra_view, name='validar-regra'),
    path('facturas/scan/', views.scan_factura_view, name='facturas-scan'),
    path('facturas/', views.listar_facturas_view, name='facturas-listar'),
    path('facturas/<int:factura_id>/lancar/', views.lancar_factura_contabilidade_view, name='facturas-lancar'),
    path('facturas/<int:factura_id>/', views.deletar_factura_view, name='facturas-deletar'),
    path('facturas/exportar-excel/', views.exportar_facturas_excel_view, name='facturas-exportar-excel'),
    path('', include(router.urls)),
]

