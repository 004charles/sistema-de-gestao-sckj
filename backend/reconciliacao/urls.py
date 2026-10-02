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
    path('', include(router.urls)),
    path('dashboard/<int:empresa_id>/', views.dashboard_view, name='dashboard'),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/cobertura/',
        views.cobertura_view, name='cobertura',
    ),
    path(
        'auditoria/<int:empresa_id>/<int:ano>/<int:mes>/dashboard/',
        views.dashboard_auditoria_periodo_view, name='dashboard-auditoria-periodo',
    ),
    path('relatorios/resumo/', views.relatorio_resumo_view, name='relatorio-resumo'),
    path('documentos/detectar/', views.detectar_documento_view, name='detectar-documento'),
    path('documentos/upload/', views.upload_documento_view, name='upload-documento'),
    path('documentos/listar/', views.listar_documentos_view, name='listar-documentos'),
    path('documentos/<int:documento_id>/', views.deletar_documento_view, name='deletar-documento'),
    path('analises/analise-documentos/', views.analisar_documentos_view, name='analisar-documentos'),
    path('analises/analise-documento/', views.analisar_documento_unico_view, name='analisar-documento'),
    path('analises/historico/', views.historico_analises_view, name='historico-analises'),
    path('analises/historico/<int:analise_id>/', views.deletar_analise_view, name='deletar-analise'),
    path('ocorrencias/', views.listar_ocorrencias_view, name='listar-ocorrencias'),
    path('ocorrencias/executar/', views.executar_ocorrencias_view, name='executar-ocorrencias'),
    path('ocorrencias/<int:ocorrencia_id>/', views.detalhe_ocorrencia_view, name='detalhe-ocorrencia'),
    path('regras/', views.listar_regras_view, name='listar-regras'),
    path('regras/<int:regra_id>/', views.validar_regra_view, name='validar-regra'),
]
