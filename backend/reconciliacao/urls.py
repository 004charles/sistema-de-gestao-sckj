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
    path('relatorios/resumo/', views.relatorio_resumo_view, name='relatorio-resumo'),
    path('documentos/upload/', views.upload_documento_view, name='upload-documento'),
    path('documentos/listar/', views.listar_documentos_view, name='listar-documentos'),
    path('analises/analise-documentos/', views.analisar_documentos_view, name='analisar-documentos'),
    path('analises/analise-documento/', views.analisar_documento_unico_view, name='analisar-documento'),
    path('analises/historico/', views.historico_analises_view, name='historico-analises'),
    path('analises/historico/<int:analise_id>/', views.deletar_analise_view, name='deletar-analise'),
]
