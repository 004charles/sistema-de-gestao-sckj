import logging
from decimal import Decimal
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
from . import validacao_documental
from . import dossie_service
from . import regra_engine

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
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.has_perm(f'reconciliacao.{codename}')


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
        res = dossie_service.executar_reconciliacao_automatica(empresa_id, ano, mes)
        if not res:
            return {'error': f'Dados insuficientes para reconciliação em {mes}/{ano}'}
        reconciliacao = Reconciliacao.objects.get(pk=res['id'])
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


TIPOS_UNICOS_POR_PERIODO = ('BALANCETE', 'MODELO7', 'IMPOSTO_INDUSTRIAL', 'DECLARACAO_IRT')


def _documento_duplicado(empresa, ano, mes, tipo, nome_arquivo=None, excluir_pk=None):
    """Documento do mesmo tipo no mesmo período que bloqueia novo upload.

    Documentos ilegíveis ou com erro não bloqueiam: permitem tentar de novo.
    Para declarações periódicas e balancetes (BALANCETE, MODELO7, etc.), admite apenas 1 por período.
    Para documentos de suporte e arquivo (faturas, comprovativos, folhas, etc.), permite múltiplos,
    barrando apenas se já existir ficheiro com o mesmo nome no mesmo período.
    """
    qs = DocumentoUpload.objects.filter(
        empresa=empresa, ano=ano, mes=mes, tipo=tipo,
    ).exclude(estado__in=('ERRO', 'ILEGIVEL'))
    if excluir_pk:
        qs = qs.exclude(pk=excluir_pk)
    if tipo in TIPOS_UNICOS_POR_PERIODO:
        return qs.order_by('-id').first()
    if nome_arquivo:
        return qs.filter(nome_arquivo=nome_arquivo).order_by('-id').first()
    return None


def _resposta_duplicado(duplicado, tipo, ano, mes):
    return Response(
        {
            'error': (
                f'Já existe um documento do tipo {tipo} para {mes:02d}/{ano} '
                f'("{duplicado.nome_arquivo}"). Elimine-o antes de subir outro.'
            )
        },
        status=status.HTTP_409_CONFLICT,
    )


@api_view(['POST'])
def upload_documento_view(request):
    if not verificar_permissao(request.user, 'add_documentoupload'):
        return Response(
            {'error': 'Sem permissão para carregar documentos.'},
            status=status.HTTP_403_FORBIDDEN
        )
    arquivo = request.FILES.get('arquivo')
    tipo = (request.data.get('tipo') or '').strip()
    empresa_id = request.data.get('empresa_id') or request.data.get('empresa')
    ano = _inteiro_opcional(request.data.get('ano'))
    mes = _inteiro_opcional(request.data.get('mes'))
    substituir = str(request.data.get('substituir', '')).lower() in ('1', 'true', 'yes', 'on')

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

    if tipo:
        nome_doc = request.data.get('nome') or arquivo.name
        duplicado = _documento_duplicado(empresa, ano, mes, tipo, nome_arquivo=nome_doc)
        if duplicado is not None:
            if substituir:
                duplicado.delete()
            else:
                return _resposta_duplicado(duplicado, tipo, ano, mes)

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
        duplicado = _documento_duplicado(
            empresa, ano, mes, documento.tipo, nome_arquivo=documento.nome_arquivo, excluir_pk=documento.pk
        )
        if duplicado is not None:
            if substituir:
                duplicado.delete()
            else:
                tipo_efetivo = documento.tipo
                arquivo_salvo = documento.arquivo
                documento.delete()
                arquivo_salvo.delete(save=False)
                return _resposta_duplicado(duplicado, tipo_efetivo, ano, mes)

    if resultado['erro'] or (texto or '').startswith('Erro ao extrair texto'):
        documento.estado = 'ERRO'
    elif not (texto or '').strip():
        documento.estado = 'ILEGIVEL'
    else:
        documento.estado = 'VALIDADO'

    # Processamento especial de Dossiê Mensal Completo (Envelope Fiscal multi-documentos)
    is_dossie = (tipo == 'DOSSIE_MENSAL') or (
        extensao == '.pdf' and dossie_service.is_dossie_mensal(documento.arquivo.path)
    )
    if is_dossie and documento.estado == 'VALIDADO':
        documento.tipo = 'DOSSIE_MENSAL'
        documento.tipo_sugerido = 'DOSSIE_MENSAL'
        documento.texto_extraido = texto
        documento.save()
        res_dossie = dossie_service.desmembrar_e_processar_dossie(
            documento.arquivo.path, empresa, ano, mes
        )
        return Response({
            'success': True,
            'is_dossie': True,
            'mensagem': res_dossie['mensagem'],
            'ano': res_dossie.get('ano') or documento.ano,
            'mes': res_dossie.get('mes') or documento.mes,
            'empresa_id': empresa.id,
            'documento': {
                'id': documento.id,
                'tipo': 'DOSSIE_MENSAL',
                'tipo_sugerido': 'DOSSIE_MENSAL',
                'classificado_automaticamente': not bool(tipo),
                'formato': resultado['formato'],
                'estado': 'VALIDADO',
                'empresa': empresa.id,
                'empresa_nome': empresa.nome,
                'ano': res_dossie.get('ano') or documento.ano,
                'mes': res_dossie.get('mes') or documento.mes,
                'nome_arquivo': documento.nome_arquivo,
            },
            'documentos_criados': res_dossie['documentos_criados'],
            'auditoria': res_dossie.get('auditoria'),
            'reconciliacao': res_dossie.get('reconciliacao'),
            'analise_ia_id': res_dossie.get('analise_ia_id'),
        })

    # Validação estrita de conteúdo para BALANCETE e MODELO7 em documentos validados
    if documento.estado == 'VALIDADO' and documento.tipo in ('BALANCETE', 'MODELO7'):
        valido, motivo_erro = validacao_documental.validar_documento_para_tipo(
            documento.tipo, texto, documento.nome_arquivo
        )
        if not valido:
            arquivo_salvo = documento.arquivo
            documento.delete()
            arquivo_salvo.delete(save=False)
            logger.warning(f"Upload rejeitado por validação estrita ({documento.tipo}): {motivo_erro}")
            return Response(
                {'error': motivo_erro},
                status=status.HTTP_400_BAD_REQUEST
            )

    documento.texto_extraido = texto
    documento.save()

    # Automação de Ponta a Ponta: Se o documento for validado e contiver ano e mês,
    # sincroniza Contabilidade/Declarações, executa o motor de 15 regras fiscais,
    # reconcilia e processa IA se ambos os documentos já estiverem disponíveis.
    auditoria_auto = None
    reconciliacao_auto = None
    analise_ia_id = None
    if documento.estado == 'VALIDADO' and documento.ano and documento.mes:
        try:
            doc_b = documento if documento.tipo == 'BALANCETE' else DocumentoUpload.objects.filter(
                empresa=empresa, ano=documento.ano, mes=documento.mes, tipo='BALANCETE'
            ).order_by('-id').first()
            doc_m = documento if documento.tipo in ('MODELO7', 'COMPROVATIVOS') else DocumentoUpload.objects.filter(
                empresa=empresa, ano=documento.ano, tipo__in=['MODELO7', 'COMPROVATIVOS']
            ).order_by('-id').first()

            _sincronizar_dados_documentos(empresa, documento.ano, documento.mes, doc_b, doc_m)
            auditoria_auto = regra_engine.executar(empresa, documento.ano, documento.mes)
            reconciliacao_auto = dossie_service.executar_reconciliacao_automatica(empresa, documento.ano, documento.mes)

            if doc_b and doc_m and doc_b.texto_extraido and doc_m.texto_extraido:
                if not AnaliseIA.objects.filter(documento_contabilidade=doc_b, documento_agt=doc_m, status='CONCLUIDA').exclude(resultado='').exists():
                    res_ia = pdf_service.analisar_documentos(doc_b.texto_extraido, doc_m.texto_extraido, 'pt')
                    if res_ia.get('success'):
                        analise_ia_obj = AnaliseIA.objects.create(
                            documento_contabilidade=doc_b,
                            documento_agt=doc_m,
                            resultado=res_ia.get('analise'),
                            status='CONCLUIDA'
                        )
                        analise_ia_id = analise_ia_obj.id
        except Exception as e:
            logger.warning(f"Erro no auto-processamento de auditoria pós-upload: {e}")

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
        },
        'auditoria': auditoria_auto,
        'reconciliacao': reconciliacao_auto,
        'analise_ia_id': analise_ia_id,
    })


@api_view(['POST'])
def detectar_documento_view(request):
    """Inspeciona o documento antes do upload final para identificar automaticamente:
    - Empresa (através do NIF ou Razão Social no texto)
    - Período (Ano e Mês)
    - Tipo de documento (Dossiê Completo, Balancete, Modelo 7, etc.)
    """
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return Response({'error': 'Ficheiro não fornecido'}, status=status.HTTP_400_BAD_REQUEST)

    import tempfile
    import os
    import unicodedata
    extensao = ('.' + arquivo.name.rsplit('.', 1)[-1].lower() if '.' in arquivo.name else '')
    
    with tempfile.NamedTemporaryFile(suffix=extensao, delete=False) as tmp:
        for chunk in arquivo.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        resultado = extracao_service.extrair_conteudo(tmp_path, arquivo.name)
        texto = resultado.get('texto') or ''

        is_dossie = False
        if extensao == '.pdf':
            is_dossie = dossie_service.is_dossie_mensal(tmp_path)

        if is_dossie:
            tipo = 'DOSSIE_MENSAL'
            tipo_nome = 'Dossiê Mensal Completo (Envelope Fiscal Único)'
        else:
            sugestao = classificador_service.classificar(arquivo.name, texto)
            tipo = sugestao['tipo']
            tipo_nome = dict(DocumentoUpload.TIPO_CHOICES).get(tipo, tipo)

        # Detectar Empresa
        empresas = empresas_acessiveis(request.user)
        empresa_detetada = None
        texto_norm = unicodedata.normalize('NFKD', texto).lower()

        for emp in empresas:
            if emp.nif and emp.nif in texto:
                empresa_detetada = emp
                break

        if not empresa_detetada:
            for emp in empresas:
                nome_simplificado = ''.join(c for c in unicodedata.normalize('NFKD', emp.nome) if c.isalnum() or c.isspace()).lower()
                partes = [p for p in nome_simplificado.split() if len(p) > 3][:3]
                if partes and all(p in texto_norm for p in partes):
                    empresa_detetada = emp
                    break

        ano, mes, _ = dossie_service.detectar_periodo_e_nif(texto)

        return Response({
            'success': True,
            'arquivo_nome': arquivo.name,
            'is_dossie': is_dossie,
            'tipo': tipo,
            'tipo_nome': tipo_nome,
            'empresa_id': empresa_detetada.id if empresa_detetada else None,
            'empresa_nome': empresa_detetada.nome if empresa_detetada else None,
            'empresa_nif': empresa_detetada.nif if empresa_detetada else None,
            'ano': ano,
            'mes': mes,
        })
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _sincronizar_dados_documentos(empresa, ano, mes, doc_balancete=None, doc_agt=None):
    """Sincroniza automaticamente Contabilidade e DeclaracaoAGT com os ficheiros PDF carregados."""
    try:
        if doc_balancete and doc_balancete.texto_extraido and not Contabilidade.objects.filter(empresa=empresa, ano=ano, mes=mes).exists():
            b_dados = pdf_service.extrair_dados_balancete(doc_balancete.texto_extraido)
            contas = [
                ('6211', 'Prestações de Serviço - Mercado Nacional', Decimal('0'), b_dados['vendas'], -b_dados['vendas']),
                ('4511', 'Caixa Kwanza', Decimal('0'), b_dados['caixa_saldo_credor'], -b_dados['caixa_saldo_credor']),
                ('3453', 'IVA Liquidado - Operações Gerais', b_dados['iva_liquidado'], b_dados['iva_liquidado'], Decimal('0')),
                ('3451', 'IVA Suportado / Dedutível', b_dados['iva_suportado'], b_dados['iva_suportado'], Decimal('0')),
                ('3456', 'IVA a Pagar de Apuramento', Decimal('0'), b_dados['iva_pagar'], -b_dados['iva_pagar']),
                ('3431', 'Imposto de Rendimento do Trabalho (IRT)', Decimal('0'), b_dados['irt_retido'], -b_dados['irt_retido']),
                ('3492', 'Segurança Social (INSS)', Decimal('0'), b_dados['inss_retido'], -b_dados['inss_retido']),
                ('3493', 'Retenção na Fonte Prestadores (6,5%)', Decimal('0'), b_dados['retencao_prestadores'], -b_dados['retencao_prestadores']),
                ('3413', 'Retenção na Fonte Clientes', b_dados['retencao_clientes'], Decimal('0'), b_dados['retencao_clientes']),
                ('75234', 'Honorários e Avenças (Prestadores)', b_dados['honorarios_prestadores'], Decimal('0'), b_dados['honorarios_prestadores']),
                ('722', 'Remunerações - Pessoal', b_dados['remuneracoes'], Decimal('0'), b_dados['remuneracoes']),
                ('75312', 'IVA Lançado em Custos', b_dados['iva_custo'], Decimal('0'), b_dados['iva_custo']),
            ]
            for cod, desc, deb, cred, sal in contas:
                if deb > 0 or cred > 0:
                    Contabilidade.objects.create(
                        empresa=empresa,
                        ano=ano,
                        mes=mes,
                        conta_codigo=cod,
                        conta_descricao=desc,
                        valor_debito=deb,
                        valor_credito=cred,
                        saldo=sal,
                    )
        if doc_agt and doc_agt.texto_extraido and not DeclaracaoAGT.objects.filter(empresa=empresa, ano=ano, mes=mes).exists():
            m_dados = pdf_service.extrair_dados_modelo7(doc_agt.texto_extraido)
            if m_dados['base_tributavel'] > 0 or m_dados['iva_liquidado'] > 0 or m_dados['iva_pagar'] > 0:
                DeclaracaoAGT.objects.create(
                    empresa=empresa,
                    ano=ano,
                    mes=mes,
                    nif=empresa.nif,
                    razao_social=empresa.nome,
                    regime_iva=empresa.regime_iva or 'Regime Geral',
                    iva_liquidado=m_dados['iva_liquidado'],
                    iva_dedutivel=m_dados['iva_dedutivel'],
                    iva_apurado=m_dados['iva_liquidado'] - m_dados['iva_dedutivel'],
                    iva_pagar=m_dados['iva_pagar'],
                    iva_recuperar=m_dados['iva_recuperar'],
                )
    except Exception as e:
        logger.warning(f"Erro na sincronização de documentos para contabilidade/agt: {e}")


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
        doc_contab = docs_usuario.filter(pk=doc_contab_id).first()
        doc_agt = docs_usuario.filter(pk=doc_agt_id).first()
        if doc_contab is None or doc_agt is None:
            raise DocumentoUpload.DoesNotExist
        logger.info(f"Documentos encontrados: contab={doc_contab.nome_arquivo}, agt={doc_agt.nome_arquivo}")
    except DocumentoUpload.DoesNotExist:
        logger.error(f"Documento não encontrado: contab_id={doc_contab_id}, agt_id={doc_agt_id}")
        return Response(
            {'error': 'Documentos não encontrados ou sem acesso.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Re-extrair texto se vazio
    if not (doc_contab.texto_extraido or '').strip() and doc_contab.arquivo:
        try:
            res_c = extracao_service.extrair_conteudo(doc_contab.arquivo.path, doc_contab.nome_arquivo)
            if res_c.get('texto'):
                doc_contab.texto_extraido = res_c['texto']
                doc_contab.save(update_fields=['texto_extraido'])
        except Exception as e:
            logger.warning(f"Erro ao extrair contab: {e}")

    if not (doc_agt.texto_extraido or '').strip() and doc_agt.arquivo:
        try:
            res_a = extracao_service.extrair_conteudo(doc_agt.arquivo.path, doc_agt.nome_arquivo)
            if res_a.get('texto'):
                doc_agt.texto_extraido = res_a['texto']
                doc_agt.save(update_fields=['texto_extraido'])
        except Exception as e:
            logger.warning(f"Erro ao extrair agt: {e}")

    logger.info(f"Texto extraído contabilidade: {len(doc_contab.texto_extraido or '')} chars")
    logger.info(f"Texto extraído AGT: {len(doc_agt.texto_extraido or '')} chars")

    # Validação estrita antes de acionar a Inteligência Artificial
    val_c, err_c = validacao_documental.validar_balancete(doc_contab.texto_extraido, doc_contab.nome_arquivo)
    if not val_c:
        logger.warning(f"Análise rejeitada: Balancete inválido ({err_c})")
        return Response(
            {'error': f"Documento de contabilidade inválido: {err_c}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    val_a, err_a = validacao_documental.validar_modelo7(doc_agt.texto_extraido, doc_agt.nome_arquivo)
    if not val_a:
        logger.warning(f"Análise rejeitada: Modelo 7 inválido ({err_a})")
        return Response(
            {'error': f"Documento da AGT inválido: {err_a}"},
            status=status.HTTP_400_BAD_REQUEST
        )

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
        # Sincronizar dados estruturados com tabelas contabilidade e agt
        emp = doc_contab.empresa or doc_agt.empresa
        ano_doc = doc_contab.ano or doc_agt.ano
        mes_doc = doc_contab.mes or doc_agt.mes
        if emp and ano_doc and mes_doc:
            _sincronizar_dados_documentos(emp, ano_doc, mes_doc, doc_contab, doc_agt)
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
    empresa_id, ano, mes = documento.empresa_id, documento.ano, documento.mes
    documento.delete()

    # Sem documentos no período não podem sobrar resultados de análise.
    limpos = {'ocorrencias': 0, 'reconciliacoes': 0}
    if ano is not None and mes is not None:
        restam = DocumentoUpload.objects.filter(
            empresa_id=empresa_id, ano=ano, mes=mes
        ).exists()
        if not restam:
            limpos['ocorrencias'], _ = Ocorrencia.objects.filter(
                empresa_id=empresa_id, ano=ano, mes=mes
            ).delete()
            limpos['reconciliacoes'], _ = Reconciliacao.objects.filter(
                empresa_id=empresa_id, ano=ano, mes=mes
            ).delete()
    return Response({'success': True, 'resultados_limpos': limpos})


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

    # 4. Dois documentos mestres do período (Contabilidade e Portal AGT)
    doc_balancete = DocumentoUpload.objects.filter(
        empresa=empresa, ano=ano, mes=mes, tipo='BALANCETE'
    ).order_by('-id').first()
    if not doc_balancete:
        doc_balancete = DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, mes=mes, tipo='DOSSIE_MENSAL'
        ).order_by('-id').first()

    # Procurar AnaliseIA existente para a contabilidade deste período
    analise_ia_obj = None
    if doc_balancete:
        analise_ia_obj = AnaliseIA.objects.filter(
            documento_contabilidade=doc_balancete,
            status='CONCLUIDA'
        ).exclude(resultado='').order_by('-id').first()

    doc_agt = DocumentoUpload.objects.filter(
        empresa=empresa, ano=ano, mes=mes, tipo__in=['MODELO7', 'COMPROVATIVOS']
    ).order_by('-id').first()

    # Se não houver Modelo 7 no mês exato mas há AnaliseIA, resolve o doc_agt a partir da análise
    if not doc_agt and analise_ia_obj:
        doc_agt = analise_ia_obj.documento_agt

    # Se ainda não houver, procura Modelo 7 mais recente da empresa no mesmo ano (ex: Junho anexado em Julho)
    if not doc_agt:
        doc_agt = DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, tipo__in=['MODELO7', 'COMPROVATIVOS']
        ).order_by('-mes', '-id').first()

    # Se ainda não houver, procura Dossiê Mensal do período
    if not doc_agt:
        doc_agt = DocumentoUpload.objects.filter(
            empresa=empresa, ano=ano, mes=mes, tipo='DOSSIE_MENSAL'
        ).order_by('-id').first()

    if not analise_ia_obj and doc_balancete and doc_agt:
        analise_ia_obj = AnaliseIA.objects.filter(
            documento_contabilidade=doc_balancete,
            documento_agt=doc_agt,
            status='CONCLUIDA'
        ).exclude(resultado='').order_by('-id').first()

    # Sincronizar dados estruturados se ainda não gravados
    _sincronizar_dados_documentos(empresa, ano, mes, doc_balancete, doc_agt)

    # 5. Indicadores contábeis e fiscais do período
    from . import regra_engine
    contexto, _ = regra_engine.construir_contexto(empresa, ano, mes)

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
        'analise_ia': analise_ia_obj.resultado if analise_ia_obj else None,
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
