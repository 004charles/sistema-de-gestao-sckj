import logging
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import (
    Empresa, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, AnaliseIA
)
from .serializers import (
    EmpresaSerializer, ContabilidadeSerializer, DeclaracaoAGTSerializer,
    ReconciliacaoSerializer, ReconciliacaoDetalheSerializer,
    MapeamentoContaSerializer, LoginSerializer,
    ReconciliacaoExecutarSerializer
)
from . import pdf_service

logger = logging.getLogger('reconciliacao')


@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(username=username)
            if user.check_password(password):
                return Response({
                    'success': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    }
                })
        except User.DoesNotExist:
            pass
        return Response({'error': 'Credenciais inválidas'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

    def get_queryset(self):
        queryset = Empresa.objects.all()
        nome = self.request.query_params.get('nome')
        nif = self.request.query_params.get('nif')
        if nome:
            queryset = queryset.filter(nome__icontains=nome)
        if nif:
            queryset = queryset.filter(nif__icontains=nif)
        return queryset


class ContabilidadeViewSet(viewsets.ModelViewSet):
    queryset = Contabilidade.objects.select_related('empresa').all()
    serializer_class = ContabilidadeSerializer

    def get_queryset(self):
        queryset = Contabilidade.objects.select_related('empresa').all()
        empresa_id = self.request.query_params.get('empresa_id')
        ano = self.request.query_params.get('ano')
        mes = self.request.query_params.get('mes')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        if ano:
            queryset = queryset.filter(ano=ano)
        if mes:
            queryset = queryset.filter(mes=mes)
        return queryset


class DeclaracaoAGTViewSet(viewsets.ModelViewSet):
    queryset = DeclaracaoAGT.objects.select_related('empresa').all()
    serializer_class = DeclaracaoAGTSerializer

    def get_queryset(self):
        queryset = DeclaracaoAGT.objects.select_related('empresa').all()
        empresa_id = self.request.query_params.get('empresa_id')
        ano = self.request.query_params.get('ano')
        mes = self.request.query_params.get('mes')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        if ano:
            queryset = queryset.filter(ano=ano)
        if mes:
            queryset = queryset.filter(mes=mes)
        return queryset


class ReconciliacaoViewSet(viewsets.ModelViewSet):
    queryset = Reconciliacao.objects.select_related('empresa').prefetch_related('detalhes').all()
    serializer_class = ReconciliacaoSerializer

    def get_queryset(self):
        queryset = Reconciliacao.objects.select_related('empresa').prefetch_related('detalhes').all()
        empresa_id = self.request.query_params.get('empresa_id')
        ano = self.request.query_params.get('ano')
        mes = self.request.query_params.get('mes')
        status_filter = self.request.query_params.get('status')
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        if ano:
            queryset = queryset.filter(ano=ano)
        if mes:
            queryset = queryset.filter(mes=mes)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['post'])
    def executar(self, request):
        serializer = ReconciliacaoExecutarSerializer(data=request.data)
        if serializer.is_valid():
            empresa_id = serializer.validated_data['empresa_id']
            ano = serializer.validated_data['ano']
            mes = serializer.validated_data['mes']
            resultado = self._executar_reconciliacao(empresa_id, ano, mes)
            return Response(resultado)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _executar_reconciliacao(self, empresa_id, ano, mes):
        try:
            empresa = Empresa.objects.get(pk=empresa_id)
        except Empresa.DoesNotExist:
            return {'error': 'Empresa não encontrada'}

        dados_contab = Contabilidade.objects.filter(
            empresa_id=empresa_id, ano=ano, mes=mes
        )
        dados_agt = DeclaracaoAGT.objects.filter(
            empresa_id=empresa_id, ano=ano, mes=mes
        ).first()

        if not dados_agt:
            return {'error': f'Declaração AGT não encontrada para {mes}/{ano}'}

        contab_normalizado = self._normalizar_contabilidade(dados_contab)

        reconciliacao = Reconciliacao.objects.create(
            empresa_id=empresa_id,
            ano=ano,
            mes=mes,
            status='PENDENTE'
        )

        campos_comparacao = [
            {'campo': 'IVA Liquidado', 'contab': 'iva_liquidado', 'agt': 'iva_liquidado'},
            {'campo': 'IVA Dedutível', 'contab': 'iva_dedutivel', 'agt': 'iva_dedutivel'},
            {'campo': 'IVA Apuramento', 'contab': 'iva_apuramento', 'agt': 'iva_apurado'},
            {'campo': 'IVA a Pagar', 'contab': 'iva_pagar', 'agt': 'iva_pagar'},
            {'campo': 'IVA a Recuperar', 'contab': 'iva_recuperar', 'agt': 'iva_recuperar'},
        ]

        total_ok = 0
        total_divergencia = 0

        for item in campos_comparacao:
            valor_contab = float(contab_normalizado.get(item['contab'], 0))
            valor_agt = float(getattr(dados_agt, item['agt'], 0))
            diferenca = valor_contab - valor_agt
            status_campo = 'OK' if abs(diferenca) < 0.01 else 'DIVERGENCIA'

            if status_campo == 'OK':
                total_ok += 1
            else:
                total_divergencia += 1

            ReconciliacaoDetalhe.objects.create(
                reconciliacao=reconciliacao,
                campo=item['campo'],
                descricao=f"Comparação {item['campo']}",
                valor_contabilidade=valor_contab,
                valor_agt=valor_agt,
                diferenca=diferenca,
                status=status_campo,
                nivel=2
            )

        reconciliacao.total_campos_ok = total_ok
        reconciliacao.total_campos_divergencia = total_divergencia
        reconciliacao.status = 'CONCILIADO' if total_divergencia == 0 else 'DIVERGENCIA'
        reconciliacao.save()

        return ReconciliacaoSerializer(reconciliacao).data

    def _normalizar_contabilidade(self, dados):
        resultado = {
            'iva_liquidado': 0,
            'iva_dedutivel': 0,
            'iva_apuramento': 0,
            'iva_pagar': 0,
            'iva_recuperar': 0,
        }
        for item in dados:
            codigo = item.conta_codigo.upper()
            saldo = abs(float(item.saldo))
            if 'LIQUIDADO' in codigo or '24.4.1' in codigo:
                resultado['iva_liquidado'] += saldo
            elif 'DEDUTIVEL' in codigo or '24.4.2' in codigo:
                resultado['iva_dedutivel'] += saldo
            elif 'APURAMENTO' in codigo or '24.4.3' in codigo:
                resultado['iva_apuramento'] += saldo
            elif 'A PAGAR' in codigo or '24.4.4' in codigo:
                resultado['iva_pagar'] += saldo
            elif 'A RECUPERAR' in codigo or '24.4.5' in codigo:
                resultado['iva_recuperar'] += saldo
        return resultado


class ReconciliacaoDetalheViewSet(viewsets.ModelViewSet):
    queryset = ReconciliacaoDetalhe.objects.all()
    serializer_class = ReconciliacaoDetalheSerializer

    def get_queryset(self):
        queryset = ReconciliacaoDetalhe.objects.all()
        reconciliacao_id = self.request.query_params.get('reconciliacao_id')
        if reconciliacao_id:
            queryset = queryset.filter(reconciliacao_id=reconciliacao_id)
        return queryset


class MapeamentoContaViewSet(viewsets.ModelViewSet):
    queryset = MapeamentoConta.objects.all()
    serializer_class = MapeamentoContaSerializer


@api_view(['GET'])
def dashboard_view(request, empresa_id):
    try:
        empresa = Empresa.objects.get(pk=empresa_id)
    except Empresa.DoesNotExist:
        return Response({'error': 'Empresa não encontrada'}, status=404)

    total_reconciliacoes = Reconciliacao.objects.filter(empresa_id=empresa_id).count()
    reconciliacoes_ok = Reconciliacao.objects.filter(empresa_id=empresa_id, status='CONCILIADO').count()
    reconciliacoes_divergencia = Reconciliacao.objects.filter(empresa_id=empresa_id, status='DIVERGENCIA').count()

    ultimas_reconciliacoes = Reconciliacao.objects.filter(empresa_id=empresa_id)[:5]

    return Response({
        'empresa': EmpresaSerializer(empresa).data,
        'estatisticas': {
            'total_reconciliacoes': total_reconciliacoes,
            'conciliadas': reconciliacoes_ok,
            'divergencias': reconciliacoes_divergencia,
        },
        'ultimas_reconciliacoes': ReconciliacaoSerializer(ultimas_reconciliacoes, many=True).data
    })


@api_view(['GET'])
def relatorio_resumo_view(request):
    empresas = Empresa.objects.all()
    dados = []
    for empresa in empresas:
        total = Reconciliacao.objects.filter(empresa=empresa).count()
        ok = Reconciliacao.objects.filter(empresa=empresa, status='CONCILIADO').count()
        div = Reconciliacao.objects.filter(empresa=empresa, status='DIVERGENCIA').count()
        dados.append({
            'empresa': EmpresaSerializer(empresa).data,
            'total': total,
            'conciliadas': ok,
            'divergencias': div,
        })
    return Response(dados)


@api_view(['POST'])
def upload_documento_view(request):
    arquivo = request.FILES.get('arquivo')
    tipo = request.data.get('tipo')

    if not arquivo or not tipo:
        return Response(
            {'error': 'arquivo e tipo são obrigatórios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if tipo not in ['CONTABILIDADE', 'AGT']:
        return Response(
            {'error': 'tipo deve ser CONTABILIDADE ou AGT'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not arquivo.name.lower().endswith('.pdf'):
        return Response(
            {'error': 'Apenas arquivos PDF são aceitos'},
            status=status.HTTP_400_BAD_REQUEST
        )

    documento = DocumentoUpload.objects.create(
        arquivo=arquivo,
        tipo=tipo,
        nome_arquivo=arquivo.name,
    )

    texto = pdf_service.extrair_texto_pdf(documento.arquivo.path)
    documento.texto_extraido = texto
    documento.save()

    return Response({
        'success': True,
        'documento': {
            'id': documento.id,
            'tipo': documento.tipo,
            'nome_arquivo': documento.nome_arquivo,
            'texto_preview': texto[:500] + '...' if len(texto) > 500 else texto,
        }
    })


@api_view(['POST'])
def analisar_documentos_view(request):
    logger.info("=== INÍCIO DA ANÁLISE DE DOCUMENTOS ===")
    
    doc_contab_id = request.data.get('documento_contabilidade_id')
    doc_agt_id = request.data.get('documento_agt_id')

    logger.info(f"Recebido: doc_contab_id={doc_contab_id}, doc_agt_id={doc_agt_id}")

    if not doc_contab_id or not doc_agt_id:
        logger.error("IDs dos documentos não fornecidos")
        return Response(
            {'error': 'documento_contabilidade_id e documento_agt_id são obrigatórios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        doc_contab = DocumentoUpload.objects.get(pk=doc_contab_id, tipo='CONTABILIDADE')
        doc_agt = DocumentoUpload.objects.get(pk=doc_agt_id, tipo='AGT')
        logger.info(f"Documentos encontrados: contab={doc_contab.nome_arquivo}, agt={doc_agt.nome_arquivo}")
    except DocumentoUpload.DoesNotExist:
        logger.error(f"Documento não encontrado: contab_id={doc_contab_id}, agt_id={doc_agt_id}")
        return Response(
            {'error': 'Documentos não encontrados'},
            status=status.HTTP_404_NOT_FOUND
        )

    logger.info(f"Texto extraído contabilidade: {len(doc_contab.texto_extraido or '')} chars")
    logger.info(f"Texto extraído AGT: {len(doc_agt.texto_extraido or '')} chars")

    analise = AnaliseIA.objects.create(
        documento_contabilidade=doc_contab,
        documento_agt=doc_agt,
        status='PENDENTE'
    )
    logger.info(f"Análise criada com ID: {analise.id}")

    logger.info("Chamando pdf_service.analisar_documentos...")
    resultado = pdf_service.analisar_documentos(
        doc_contab.texto_extraido,
        doc_agt.texto_extraido
    )

    logger.info(f"Resultado da análise: success={resultado.get('success')}")

    if resultado.get('success'):
        analise.resultado = resultado['analise']
        analise.status = 'CONCLUIDA'
        analise.save()
        logger.info("Análise concluída com sucesso")
        return Response({
            'success': True,
            'analise_id': analise.id,
            'resultado': resultado['analise'],
            'model': resultado.get('model'),
        })
    else:
        analise.status = 'ERRO'
        analise.save()
        error_msg = resultado.get('error')
        logger.error(f"Erro na análise: {error_msg}")
        return Response(
            {'error': error_msg},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def analisar_documento_unico_view(request):
    documento_id = request.data.get('documento_id')

    if not documento_id:
        return Response(
            {'error': 'documento_id é obrigatório'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        documento = DocumentoUpload.objects.get(pk=documento_id)
    except DocumentoUpload.DoesNotExist:
        return Response(
            {'error': 'Documento não encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    resultado = pdf_service.analisar_documento_unico(
        documento.texto_extraido,
        documento.tipo
    )

    if resultado.get('success'):
        return Response({
            'success': True,
            'resultado': resultado['analise'],
            'model': resultado.get('model'),
        })
    else:
        return Response(
            {'error': resultado.get('error')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def listar_documentos_view(request):
    documentos = DocumentoUpload.objects.all()
    dados = []
    for doc in documentos:
        dados.append({
            'id': doc.id,
            'tipo': doc.tipo,
            'nome_arquivo': doc.nome_arquivo,
            'created_at': doc.created_at,
        })
    return Response(dados)


@api_view(['GET'])
def historico_analises_view(request):
    analises = AnaliseIA.objects.select_related(
        'documento_contabilidade', 'documento_agt'
    ).all()
    dados = []
    for a in analises:
        dados.append({
            'id': a.id,
            'documento_contabilidade': {
                'id': a.documento_contabilidade.id if a.documento_contabilidade else None,
                'nome_arquivo': a.documento_contabilidade.nome_arquivo if a.documento_contabilidade else None,
            },
            'documento_agt': {
                'id': a.documento_agt.id if a.documento_agt else None,
                'nome_arquivo': a.documento_agt.nome_arquivo if a.documento_agt else None,
            },
            'status': a.status,
            'resultado': a.resultado[:500] + '...' if a.resultado and len(a.resultado) > 500 else a.resultado,
            'created_at': a.created_at,
        })
    return Response(dados)


@api_view(['DELETE'])
def deletar_analise_view(request, analise_id):
    try:
        analise = AnaliseIA.objects.get(pk=analise_id)
        analise.delete()
        return Response({'success': True})
    except AnaliseIA.DoesNotExist:
        return Response({'error': 'Análise não encontrada'}, status=404)
