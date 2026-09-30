import logging
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.permissions import DjangoModelPermissions
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import (
    Empresa, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, AnaliseIA, Regra, Ocorrencia,
)
from .serializers import (
    EmpresaSerializer,
    ContabilidadeSerializer, DeclaracaoAGTSerializer,
    ReconciliacaoSerializer, ReconciliacaoDetalheSerializer,
    MapeamentoContaSerializer, LoginSerializer,
    ReconciliacaoExecutarSerializer
)
from . import pdf_service
from . import extracao_service
from . import classificador_service
from . import cobertura_service

logger = logging.getLogger('reconciliacao')


def empresas_acessiveis(user):
    if not user or not user.is_authenticated:
        return Empresa.objects.none()
    # Se o utilizador tem empresas vinculadas em EmpresaUtilizador, restringe estritamente a elas
    vinculos = Empresa.objects.filter(
        acessos__utilizador=user,
        acessos__ativo=True,
    ).distinct()
    if vinculos.exists():
        return vinculos
    if user.is_superuser:
        return Empresa.objects.all()
    return Empresa.objects.none()


def verificar_permissao(user, codename):
    return user.is_superuser or user.has_perm(f'reconciliacao.{codename}')


def documentos_acessiveis(user):
    if not user or not user.is_authenticated:
        return DocumentoUpload.objects.none()
    if user.is_superuser:
        return DocumentoUpload.objects.all()
    return DocumentoUpload.objects.filter(empresa__in=empresas_acessiveis(user))


def _inteiro_opcional(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)
        if user is not None and user.is_active:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'token': token.key,
                    'grupos': list(user.groups.values_list('name', flat=True)),
                }
            })
        return Response({'error': 'Credenciais inválidas'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


login_view.cls.permission_classes = [AllowAny]


class EmpresaViewSet(ReadOnlyModelViewSet):
    """Apenas consulta. A criação/edição é feita no Django Admin."""

    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = empresas_acessiveis(self.request.user)
        nome = self.request.query_params.get('nome')
        nif = self.request.query_params.get('nif')
        estado = self.request.query_params.get('estado')
        if nome:
            queryset = queryset.filter(nome__icontains=nome)
        if nif:
            queryset = queryset.filter(nif__icontains=nif)
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset


class ContabilidadeViewSet(viewsets.ModelViewSet):
    queryset = Contabilidade.objects.select_related('empresa').all()
    serializer_class = ContabilidadeSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]

    def get_queryset(self):
        queryset = Contabilidade.objects.select_related('empresa').filter(
            empresa__in=empresas_acessiveis(self.request.user)
        )
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
    permission_classes = [IsAuthenticated, DjangoModelPermissions]

    def get_queryset(self):
        queryset = DeclaracaoAGT.objects.select_related('empresa').filter(
            empresa__in=empresas_acessiveis(self.request.user)
        )
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
    permission_classes = [IsAuthenticated, DjangoModelPermissions]

    def get_queryset(self):
        queryset = Reconciliacao.objects.select_related('empresa').prefetch_related('detalhes').filter(
            empresa__in=empresas_acessiveis(self.request.user)
        )
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


class ReconciliacaoDetalheViewSet(ReadOnlyModelViewSet):
    queryset = ReconciliacaoDetalhe.objects.all()
    serializer_class = ReconciliacaoDetalheSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ReconciliacaoDetalhe.objects.filter(
            reconciliacao__empresa__in=empresas_acessiveis(self.request.user)
        )
        reconciliacao_id = self.request.query_params.get('reconciliacao_id')
        if reconciliacao_id:
            queryset = queryset.filter(reconciliacao_id=reconciliacao_id)
        return queryset


class MapeamentoContaViewSet(viewsets.ModelViewSet):
    queryset = MapeamentoConta.objects.all()
    serializer_class = MapeamentoContaSerializer
    permission_classes = [IsAuthenticated, DjangoModelPermissions]


@api_view(['GET'])
def dashboard_view(request, empresa_id):
    try:
        empresa = empresas_acessiveis(request.user).get(pk=empresa_id)
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
    empresas = empresas_acessiveis(request.user)
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
    if not verificar_permissao(request.user, 'add_documentoupload'):
        return Response(
            {'error': 'Sem permissão para carregar documentos.'},
            status=status.HTTP_403_FORBIDDEN
        )
    arquivo = request.FILES.get('arquivo')
    tipo = (request.data.get('tipo') or '').strip()
    empresa_id = request.data.get('empresa_id')
    ano = _inteiro_opcional(request.data.get('ano'))
    mes = _inteiro_opcional(request.data.get('mes'))

    if not arquivo:
        return Response(
            {'error': 'arquivo é obrigatório'},
            status=status.HTTP_400_BAD_REQUEST
        )

    tipos_validos = [c[0] for c in DocumentoUpload.TIPO_CHOICES]
    if tipo and tipo not in tipos_validos:
        return Response(
            {'error': f'tipo deve ser um de: {", ".join(tipos_validos)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not empresa_id:
        return Response(
            {'error': 'empresa_id é obrigatório'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if ano is None or mes is None or not (2000 <= ano <= 2100) or not (1 <= mes <= 12):
        return Response(
            {'error': 'ano (2000-2100) e mes (1-12) são obrigatórios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    empresa = empresas_acessiveis(request.user).filter(pk=empresa_id).first()
    if empresa is None:
        return Response(
            {'error': 'Empresa não encontrada ou sem acesso.'},
            status=status.HTTP_404_NOT_FOUND
        )

    extensao = ('.' + arquivo.name.rsplit('.', 1)[-1].lower()
                if '.' in arquivo.name else '')
    if extensao not in extracao_service.EXTENSOES_ACEITAS:
        aceites = ', '.join(extracao_service.EXTENSOES_ACEITAS)
        return Response(
            {'error': f'Formato não suportado ({extensao or "sem extensão"}). Aceites: {aceites}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    documento = DocumentoUpload.objects.create(
        arquivo=arquivo,
        empresa=empresa,
        ano=ano,
        mes=mes,
        tipo=tipo or 'OUTRO',
        estado='PROCESSANDO',
        nome_arquivo=request.data.get('nome') or arquivo.name,
    )

    resultado = extracao_service.extrair_conteudo(documento.arquivo.path, arquivo.name)
    texto = resultado['texto']

    sugestao = classificador_service.classificar(documento.nome_arquivo, texto)
    documento.tipo_sugerido = sugestao['tipo']
    if not tipo:
        documento.tipo = sugestao['tipo']

    if resultado['erro'] or (texto or '').startswith('Erro ao extrair texto'):
        documento.estado = 'ERRO'
    elif not (texto or '').strip():
        documento.estado = 'ILEGIVEL'
    else:
        documento.estado = 'VALIDADO'
    documento.texto_extraido = texto
    documento.save()

    return Response({
        'success': True,
        'documento': {
            'id': documento.id,
            'tipo': documento.tipo,
            'tipo_sugerido': documento.tipo_sugerido,
            'classificado_automaticamente': not bool(tipo),
            'formato': resultado['formato'],
            'estado': documento.estado,
            'empresa': empresa.id,
            'empresa_nome': empresa.nome,
            'ano': documento.ano,
            'mes': documento.mes,
            'nome_arquivo': documento.nome_arquivo,
            'texto_preview': texto[:500] + '...' if len(texto) > 500 else texto,
        }
    })


@api_view(['POST'])
def analisar_documentos_view(request):
    if not verificar_permissao(request.user, 'add_analiseia'):
        return Response(
            {'error': 'Sem permissão para criar análises.'},
            status=status.HTTP_403_FORBIDDEN
        )
    logger.info("=== INÍCIO DA ANÁLISE DE DOCUMENTOS ===")
    
    doc_contab_id = request.data.get('documento_contabilidade_id')
    doc_agt_id = request.data.get('documento_agt_id')
    idioma = request.data.get('idioma', 'pt')

    logger.info(f"Recebido: doc_contab_id={doc_contab_id}, doc_agt_id={doc_agt_id}, idioma={idioma}")

    if not doc_contab_id or not doc_agt_id:
        logger.error("IDs dos documentos não fornecidos")
        return Response(
            {'error': 'documento_contabilidade_id e documento_agt_id são obrigatórios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        docs_usuario = documentos_acessiveis(request.user)
        doc_contab = docs_usuario.filter(pk=doc_contab_id, tipo='BALANCETE').first()
        doc_agt = docs_usuario.filter(pk=doc_agt_id, tipo='MODELO7').first()
        if doc_contab is None or doc_agt is None:
            raise DocumentoUpload.DoesNotExist
        logger.info(f"Documentos encontrados: contab={doc_contab.nome_arquivo}, agt={doc_agt.nome_arquivo}")
    except DocumentoUpload.DoesNotExist:
        logger.error(f"Documento não encontrado: contab_id={doc_contab_id}, agt_id={doc_agt_id}")
        return Response(
            {'error': 'Documentos não encontrados ou sem acesso (esperado: Balancete + Modelo 7).'},
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
        doc_agt.texto_extraido,
        idioma
    )

    logger.info(f"Resultado da análise: success={resultado.get('success')}")

    if resultado.get('success'):
        analise.resultado = resultado['analise']
        analise.status = 'CONCLUIDA'
        analise.save()
        DocumentoUpload.objects.filter(
            pk__in=[doc_contab.pk, doc_agt.pk]
        ).update(estado='UTILIZADO')
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
    if not verificar_permissao(request.user, 'add_analiseia'):
        return Response(
            {'error': 'Sem permissão para criar análises.'},
            status=status.HTTP_403_FORBIDDEN
        )
    documento_id = request.data.get('documento_id')
    idioma = request.data.get('idioma', 'pt')

    if not documento_id:
        return Response(
            {'error': 'documento_id é obrigatório'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        documento = documentos_acessiveis(request.user).filter(pk=documento_id).first()
        if documento is None:
            raise DocumentoUpload.DoesNotExist
    except DocumentoUpload.DoesNotExist:
        return Response(
            {'error': 'Documento não encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    resultado = pdf_service.analisar_documento_unico(
        documento.texto_extraido,
        documento.tipo,
        idioma
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
    documentos = documentos_acessiveis(request.user)

    empresa_id = _inteiro_opcional(request.query_params.get('empresa'))
    if empresa_id:
        documentos = documentos.filter(empresa_id=empresa_id)
    ano = _inteiro_opcional(request.query_params.get('ano'))
    if ano:
        documentos = documentos.filter(ano=ano)
    mes = _inteiro_opcional(request.query_params.get('mes'))
    if mes:
        documentos = documentos.filter(mes=mes)
    tipo = request.query_params.get('tipo')
    if tipo:
        documentos = documentos.filter(tipo=tipo)
    estado = request.query_params.get('estado')
    if estado:
        documentos = documentos.filter(estado=estado)

    dados = []
    for doc in documentos:
        dados.append({
            'id': doc.id,
            'tipo': doc.tipo,
            'tipo_sugerido': doc.tipo_sugerido,
            'estado': doc.estado,
            'empresa': doc.empresa_id,
            'empresa_nome': doc.empresa.nome if doc.empresa else None,
            'ano': doc.ano,
            'mes': doc.mes,
            'nome_arquivo': doc.nome_arquivo,
            'arquivo_url': doc.arquivo.url if doc.arquivo else None,
            'created_at': doc.created_at,
        })
    return Response(dados)


@api_view(['DELETE'])
def deletar_documento_view(request, documento_id):
    if not verificar_permissao(request.user, 'delete_documentoupload'):
        return Response(
            {'error': 'Sem permissão para eliminar documentos.'},
            status=status.HTTP_403_FORBIDDEN
        )
    documento = documentos_acessiveis(request.user).filter(pk=documento_id).first()
    if documento is None:
        return Response({'error': 'Documento não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    documento.delete()
    return Response({'success': True})


@api_view(['GET'])
def historico_analises_view(request):
    docs_usuario = documentos_acessiveis(request.user)
    analises = AnaliseIA.objects.select_related(
        'documento_contabilidade', 'documento_agt'
    ).filter(
        Q(documento_contabilidade__in=docs_usuario)
        | Q(documento_agt__in=docs_usuario)
    )
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
    if not verificar_permissao(request.user, 'delete_analiseia'):
        return Response(
            {'error': 'Sem permissão para eliminar análises.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        docs_usuario = documentos_acessiveis(request.user)
        analise = AnaliseIA.objects.filter(pk=analise_id).filter(
            Q(documento_contabilidade__in=docs_usuario)
            | Q(documento_agt__in=docs_usuario)
        ).first()
        if analise is None:
            return Response({'error': 'Análise não encontrada'}, status=404)
        analise.delete()
        return Response({'success': True})
    except Exception:
        return Response({'error': 'Análise não encontrada'}, status=404)


@api_view(['GET'])
def cobertura_view(request, empresa_id, ano, mes):
    """Cobertura de auditoria do período — Fase 3 (§10, §11)."""
    if not (2000 <= ano <= 2100) or not (1 <= mes <= 12):
        return Response(
            {'error': 'ano (2000-2100) e mes (1-12) inválidos'},
            status=status.HTTP_400_BAD_REQUEST
        )
    empresa = empresas_acessiveis(request.user).filter(pk=empresa_id).first()
    if empresa is None:
        return Response(
            {'error': 'Empresa não encontrada ou sem acesso.'},
            status=status.HTTP_404_NOT_FOUND
        )
    return Response(cobertura_service.calcular(empresa, ano, mes))


@api_view(['GET'])
def dashboard_auditoria_periodo_view(request, empresa_id, ano, mes):
    """Retorna a visão unificada do dashboard de auditoria do período (§33)."""
    if not (2000 <= ano <= 2100 and 1 <= mes <= 12):
        return Response(
            {'error': 'ano (2000-2100) e mes (1-12) inválidos'},
            status=status.HTTP_400_BAD_REQUEST
        )
    empresa = empresas_acessiveis(request.user).filter(pk=empresa_id).first()
    if empresa is None:
        return Response(
            {'error': 'Empresa não encontrada ou sem acesso.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 1. Cobertura documental
    cobertura = cobertura_service.calcular(empresa, ano, mes)

    # 2. Ocorrências / Alertas do período
    ocorrencias_qs = Ocorrencia.objects.filter(
        empresa=empresa, ano=ano, mes=mes
    ).select_related('regra', 'regra__motor', 'regra__base_legal', 'empresa').order_by('-severidade', 'id')

    alertas_resumo = {
        'alto': ocorrencias_qs.filter(severidade='ALTO').count(),
        'medio': ocorrencias_qs.filter(severidade='MEDIO').count(),
        'baixo': ocorrencias_qs.filter(severidade='BAIXO').count(),
        'informativo': ocorrencias_qs.filter(severidade='INFORMATIVO').count(),
        'total': ocorrencias_qs.count(),
    }

    # 3. Status semafórico por motor (§33)
    motores_status = []
    for m in cobertura['motores']:
        occs_motor = ocorrencias_qs.filter(regra__motor__codigo=m['codigo'])
        m_copy = dict(m)
        m_copy['alertas_alto'] = occs_motor.filter(severidade='ALTO').count()
        m_copy['alertas_medio'] = occs_motor.filter(severidade='MEDIO').count()
        m_copy['alertas_total'] = occs_motor.count()

        if m['estado'] in ('VAZIO', 'SEM_MATRIZ'):
            m_copy['status_semaforo'] = 'NAO_ANALISADO'  # ⚪
        elif m_copy['alertas_alto'] > 0:
            m_copy['status_semaforo'] = 'ALERTA'         # 🔴
        elif m_copy['alertas_medio'] > 0 or m['estado'] == 'PARCIAL':
            m_copy['status_semaforo'] = 'ATENCAO'        # 🟡
        else:
            m_copy['status_semaforo'] = 'CONFORME'       # 🟢
        motores_status.append(m_copy)

    # 4. Indicadores contábeis e fiscais do período
    from . import regra_engine
    contexto, _ = regra_engine.construir_contexto(empresa, ano, mes)

    # 5. Dois documentos mestres do período (Contabilidade e Portal AGT)
    doc_balancete = DocumentoUpload.objects.filter(
        empresa=empresa, ano=ano, mes=mes, tipo='BALANCETE'
    ).order_by('-id').first()
    doc_agt = DocumentoUpload.objects.filter(
        empresa=empresa, ano=ano, mes=mes, tipo__in=['MODELO7', 'COMPROVATIVOS']
    ).order_by('-id').first()

    documentos_base = {
        'balancete': {
            'presente': doc_balancete is not None,
            'id': doc_balancete.id if doc_balancete else None,
            'nome': doc_balancete.nome_arquivo if doc_balancete else None,
            'estado': doc_balancete.estado if doc_balancete else None,
            'data': doc_balancete.created_at.strftime('%d/%m/%Y %H:%M') if doc_balancete and doc_balancete.created_at else None,
        },
        'portal_agt': {
            'presente': doc_agt is not None,
            'id': doc_agt.id if doc_agt else None,
            'nome': doc_agt.nome_arquivo if doc_agt else None,
            'tipo': doc_agt.tipo if doc_agt else None,
            'estado': doc_agt.estado if doc_agt else None,
            'data': doc_agt.created_at.strftime('%d/%m/%Y %H:%M') if doc_agt and doc_agt.created_at else None,
        },
    }

    return Response({
        'empresa': EmpresaSerializer(empresa).data,
        'ano': ano,
        'mes': mes,
        'cobertura': cobertura,
        'documentos_base': documentos_base,
        'alertas_resumo': alertas_resumo,
        'motores': motores_status,
        'ocorrencias': [_serializar_ocorrencia(o, completo=True) for o in ocorrencias_qs],
        'indicadores': {
            'volume_negocios': str(contexto.get('volume_negocios_contab', '0.00')),
            'iva_liquidado': str(contexto.get('iva_liquidado', '0.00')),
            'iva_dedutivel': str(contexto.get('iva_dedutivel', '0.00')),
            'iva_pagar': str(contexto.get('iva_pagar', '0.00')),
            'caixa_saldo_credor': str(contexto.get('caixa_saldo_credor', '0.00')),
            'caixa_credor_anormal': bool(contexto.get('caixa_credor_anormal', 0)),
            'irt_contabilizado': str(contexto.get('irt_contabilizado', '0.00')),
            'inss_contabilizado': str(contexto.get('inss_contabilizado', '0.00')),
            'honorarios_prestadores': str(contexto.get('honorarios_prestadores', '0.00')),
            'retencao_prestadores': str(contexto.get('retencao_prestadores_contab', '0.00')),
            'remuneracoes_total': str(contexto.get('remuneracoes_total', '0.00')),
            'bancos_saldo': str(contexto.get('bancos_saldo', '0.00')),
            'exposicao_total_potencial': str(contexto.get('exposicao_total_potencial', '0.00')),
            'iva_suportado_contab': str(contexto.get('iva_suportado_contab', '0.00')),
            'retencoes_clientes_contab': str(contexto.get('retencoes_clientes_contab', '0.00')),
        }
    })


def _serializar_regra(regra, completo=False):
    base = regra.base_legal
    dados = {
        'id': regra.id,
        'codigo': regra.codigo,
        'nome': regra.nome,
        'imposto': regra.imposto,
        'motor': regra.motor.codigo,
        'motor_nome': regra.motor.nome,
        'severidade': regra.severidade,
        'estado_validacao': regra.estado_validacao,
        'activa': regra.activa,
        'versao': regra.versao,
        'base_legal': {
            'legislacao': base.legislacao,
            'artigo': base.artigo,
            'texto': base.texto,
            'fonte_oficial': base.fonte_oficial,
            'validado_juridicamente': base.validado_juridicamente,
        },
    }
    if completo:
        dados.update({
            'descricao': regra.descricao,
            'condicao': regra.condicao,
            'formula': regra.formula,
            'recomendacao': regra.recomendacao,
            'validado_por': regra.validado_por.username if regra.validado_por else None,
            'validado_em': regra.validado_em,
            'validacao_nota': regra.validacao_nota,
        })
    return dados


def _serializar_ocorrencia(ocorrencia, completo=False):
    dados = {
        'id': ocorrencia.id,
        'empresa': ocorrencia.empresa_id,
        'empresa_nome': ocorrencia.empresa.nome,
        'ano': ocorrencia.ano,
        'mes': ocorrencia.mes,
        'regra': _serializar_regra(ocorrencia.regra, completo=completo),
        'severidade': ocorrencia.severidade,
        'valor_envolvido': str(ocorrencia.valor_envolvido),
        'estado': ocorrencia.estado,
        'versao_regra': ocorrencia.versao_regra,
        'created_at': ocorrencia.created_at,
        'revisado_por': (
            ocorrencia.revisado_por.username if ocorrencia.revisado_por else None
        ),
        'revisado_em': ocorrencia.revisado_em,
    }
    if completo:
        dados.update({
            'evidencia': ocorrencia.evidencia,
            'recomendacao': ocorrencia.recomendacao,
        })
    return dados


@api_view(['GET'])
def listar_ocorrencias_view(request):
    """Alertas do período (§21) — sempre dentro de empresas acessíveis."""
    ocorrencias = Ocorrencia.objects.filter(
        empresa__in=empresas_acessiveis(request.user)
    ).select_related('regra', 'regra__motor', 'regra__base_legal', 'empresa')

    empresa_id = _inteiro_opcional(request.query_params.get('empresa'))
    if empresa_id:
        ocorrencias = ocorrencias.filter(empresa_id=empresa_id)
    ano = _inteiro_opcional(request.query_params.get('ano'))
    if ano:
        ocorrencias = ocorrencias.filter(ano=ano)
    mes = _inteiro_opcional(request.query_params.get('mes'))
    if mes:
        ocorrencias = ocorrencias.filter(mes=mes)
    severidade = request.query_params.get('severidade')
    if severidade:
        ocorrencias = ocorrencias.filter(severidade=severidade)
    estado = request.query_params.get('estado')
    if estado:
        ocorrencias = ocorrencias.filter(estado=estado)

    return Response([
        _serializar_ocorrencia(o) for o in ocorrencias
    ])


@api_view(['GET', 'PATCH'])
def detalhe_ocorrencia_view(request, ocorrencia_id):
    ocorrencia = Ocorrencia.objects.filter(
        pk=ocorrencia_id,
        empresa__in=empresas_acessiveis(request.user),
    ).select_related('regra', 'regra__motor', 'regra__base_legal', 'empresa').first()
    if ocorrencia is None:
        return Response({'error': 'Ocorrência não encontrada'}, status=404)

    if request.method == 'GET':
        return Response(_serializar_ocorrencia(ocorrencia, completo=True))

    if not verificar_permissao(request.user, 'change_ocorrencia'):
        return Response(
            {'error': 'Sem permissão para rever ocorrências.'},
            status=status.HTTP_403_FORBIDDEN
        )
    novo_estado = request.data.get('estado')
    estados = [c[0] for c in Ocorrencia.ESTADO_CHOICES]
    if novo_estado not in estados:
        return Response(
            {'error': f'estado deve ser um de: {", ".join(estados)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    from django.utils import timezone
    ocorrencia.estado = novo_estado
    ocorrencia.revisado_por = request.user
    ocorrencia.revisado_em = timezone.now()
    ocorrencia.save()
    return Response(_serializar_ocorrencia(ocorrencia, completo=True))


@api_view(['POST'])
def executar_ocorrencias_view(request):
    """Executa o Rule Engine sobre (empresa, ano, mes) — só regras VALIDADAS."""
    if not verificar_permissao(request.user, 'add_ocorrencia'):
        return Response(
            {'error': 'Sem permissão para executar o motor de regras.'},
            status=status.HTTP_403_FORBIDDEN
        )
    empresa_id = _inteiro_opcional(request.data.get('empresa'))
    ano = _inteiro_opcional(request.data.get('ano'))
    mes = _inteiro_opcional(request.data.get('mes'))
    if not empresa_id or ano is None or mes is None:
        return Response(
            {'error': 'empresa, ano e mes são obrigatórios'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not (2000 <= ano <= 2100 and 1 <= mes <= 12):
        return Response(
            {'error': 'ano (2000-2100) e mes (1-12) inválidos'},
            status=status.HTTP_400_BAD_REQUEST
        )
    empresa = empresas_acessiveis(request.user).filter(pk=empresa_id).first()
    if empresa is None:
        return Response(
            {'error': 'Empresa não encontrada ou sem acesso.'},
            status=status.HTTP_404_NOT_FOUND
        )
    from . import regra_engine
    resumo = regra_engine.executar(empresa, ano, mes)
    return Response({'success': True, 'empresa': empresa.id, 'ano': ano, 'mes': mes, **resumo})


@api_view(['GET'])
def listar_regras_view(request):
    regras = Regra.objects.select_related('motor', 'base_legal')
    estado = request.query_params.get('estado')
    if estado:
        regras = regras.filter(estado_validacao=estado)
    motor = request.query_params.get('motor')
    if motor:
        regras = regras.filter(motor__codigo=motor)
    imposto = request.query_params.get('imposto')
    if imposto:
        regras = regras.filter(imposto=imposto)
    return Response([
        _serializar_regra(r, completo=True) for r in regras
    ])


@api_view(['PATCH'])
def validar_regra_view(request, regra_id):
    """Validação humana de regras (decisão 2): POR_VALIDAR → VALIDADA/REJEITADA."""
    if not verificar_permissao(request.user, 'change_regra'):
        return Response(
            {'error': 'Sem permissão para validar regras.'},
            status=status.HTTP_403_FORBIDDEN
        )
    regra = Regra.objects.filter(pk=regra_id).first()
    if regra is None:
        return Response({'error': 'Regra não encontrada'}, status=404)
    novo_estado = request.data.get('estado_validacao')
    estados = [c[0] for c in Regra.ESTADO_VALIDACAO_CHOICES]
    if novo_estado not in estados:
        return Response(
            {'error': f'estado_validacao deve ser um de: {", ".join(estados)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    from django.utils import timezone
    regra.estado_validacao = novo_estado
    regra.validado_por = request.user
    regra.validado_em = timezone.now()
    regra.validacao_nota = str(request.data.get('nota') or '')[:2000]
    regra.save()
    return Response(_serializar_regra(regra, completo=True))
