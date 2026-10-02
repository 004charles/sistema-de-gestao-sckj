from decimal import Decimal, ROUND_HALF_UP
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Empresa(models.Model):
    TIPO_ENTIDADE_CHOICES = [
        ('PS', 'Pessoa Singular'),
        ('ENI', 'Empresário em Nome Individual'),
        ('SQ', 'Sociedade por Quotas'),
        ('SA', 'Sociedade Anónima'),
        ('COOP', 'Cooperativa'),
        ('ASS', 'Associação'),
        ('FUND', 'Fundação'),
        ('OUTRO', 'Outro'),
    ]

    ESTADO_CHOICES = [
        ('ATIVA', 'Ativa'),
        ('INATIVA', 'Inativa'),
        ('SUSPENSA', 'Suspensa'),
        ('ENCERRADA', 'Encerrada'),
    ]

    nome = models.CharField(max_length=200)
    nome_comercial = models.CharField(max_length=200, blank=True, default='')
    nif = models.CharField(
        max_length=14,
        unique=True,
        error_messages={
            'unique': 'Já existe uma empresa registada com este NIF.',
        },
    )
    tipo_entidade = models.CharField(
        max_length=10, choices=TIPO_ENTIDADE_CHOICES, blank=True, default=''
    )

    data_constituicao = models.DateField(null=True, blank=True)
    data_inicio_atividade = models.DateField(null=True, blank=True)
    atividade_principal = models.CharField(max_length=200, blank=True, default='')
    cae_principal = models.CharField(max_length=20, blank=True, default='')

    provincia = models.CharField(max_length=100, blank=True, default='')
    municipio = models.CharField(max_length=100, blank=True, default='')
    comuna = models.CharField(max_length=100, blank=True, default='')
    endereco = models.TextField(blank=True, null=True)

    telefone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)

    regime_iva = models.CharField(max_length=50)

    reparticao_fiscal = models.CharField(max_length=100, blank=True, default='')
    contabilista_nome = models.CharField(max_length=120, blank=True, default='')
    contabilista_contacto = models.CharField(max_length=120, blank=True, default='')
    periodo_inicial_analise = models.DateField(null=True, blank=True)

    estado = models.CharField(
        max_length=15, choices=ESTADO_CHOICES, default='ATIVA'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'empresas'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} - NIF: {self.nif}"

    def clean(self):
        super().clean()
        if (
            self.data_constituicao
            and self.data_inicio_atividade
            and self.data_inicio_atividade < self.data_constituicao
        ):
            raise ValidationError({
                'data_inicio_atividade':
                    'A data de início de atividade não pode ser anterior à data de constituição.'
            })

    @property
    def tem_historico_fiscal(self):
        return (
            self.contabilidade.exists()
            or self.declaracoes_agt.exists()
            or self.reconciliacoes.exists()
            or self.documentos.exists()
        )


class EmpresaUtilizador(models.Model):
    PERFIL_ACESSO_CHOICES = [
        ('ADMIN', 'Administrador'),
        ('AUDITOR', 'Auditor'),
        ('CONTABILISTA', 'Contabilista'),
        ('FISCALISTA', 'Fiscalista'),
        ('ANALISTA', 'Analista'),
        ('CONSULTA', 'Consulta'),
    ]

    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name='acessos'
    )
    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='acessos_empresas',
    )
    perfil_acesso = models.CharField(
        max_length=20, choices=PERFIL_ACESSO_CHOICES, default='CONSULTA'
    )
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'empresa_utilizadores'
        ordering = ['empresa', 'utilizador']
        unique_together = ('empresa', 'utilizador')

    def __str__(self):
        return f"{self.utilizador} -> {self.empresa} [{self.perfil_acesso}]"


class Contabilidade(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='contabilidade')
    ano = models.IntegerField()
    mes = models.IntegerField()
    conta_codigo = models.CharField(max_length=20)
    conta_descricao = models.CharField(max_length=200)
    valor_debito = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_credito = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    saldo = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contabilidade'
        ordering = ['conta_codigo']

    def __str__(self):
        return f"{self.conta_codigo} - {self.conta_descricao}"


class DeclaracaoAGT(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='declaracoes_agt')
    ano = models.IntegerField()
    mes = models.IntegerField()
    nif = models.CharField(max_length=14)
    razao_social = models.CharField(max_length=200, blank=True, null=True)
    regime_iva = models.CharField(max_length=50)
    iva_liquidado = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_dedutivel = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_apurado = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_pagar = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    iva_recuperar = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agt_declaracoes'
        ordering = ['-ano', '-mes']

    def __str__(self):
        return f"AGT {self.empresa.nome} - {self.mes}/{self.ano}"


class Reconciliacao(models.Model):
    STATUS_CHOICES = [
        ('CONCILIADO', 'Conciliado'),
        ('DIVERGENCIA', 'Divergência'),
        ('PENDENTE', 'Pendente'),
    ]

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='reconciliacoes')
    ano = models.IntegerField()
    mes = models.IntegerField()
    data_reconciliacao = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    total_campos_ok = models.IntegerField(default=0)
    total_campos_divergencia = models.IntegerField(default=0)
    observacoes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reconciliacoes'
        ordering = ['-ano', '-mes']

    def __str__(self):
        return f"Reconciliação {self.empresa.nome} - {self.mes}/{self.ano} [{self.status}]"


class ReconciliacaoDetalhe(models.Model):
    STATUS_CHOICES = [
        ('OK', 'OK'),
        ('DIVERGENCIA', 'Divergência'),
    ]

    reconciliacao = models.ForeignKey(Reconciliacao, on_delete=models.CASCADE, related_name='detalhes')
    campo = models.CharField(max_length=100)
    descricao = models.CharField(max_length=200, blank=True, null=True)
    valor_contabilidade = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    valor_agt = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    diferenca = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    nivel = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reconciliacao_detalhes'
        ordering = ['nivel', 'campo']

    def __str__(self):
        return f"{self.campo} - {self.status}"


class MapeamentoConta(models.Model):
    conta_contabilidade = models.CharField(max_length=20)
    campo_agt = models.CharField(max_length=100)
    descricao = models.CharField(max_length=200, blank=True, null=True)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mapeamento_contas'

    def __str__(self):
        return f"{self.conta_contabilidade} -> {self.campo_agt}"


class DocumentoUpload(models.Model):
    TIPO_CHOICES = [
        ('BALANCETE', 'Balancete'),
        ('MODELO7', 'Modelo 7 (IVA)'),
        ('FACTURA_VENDA', 'Facturas de Venda'),
        ('FACTURA_COMPRA', 'Facturas de Compra'),
        ('FOLHA_SALARIAL', 'Folha Salarial'),
        ('EXTRACTO_BANCARIO', 'Extracto Bancário'),
        ('RETENCOES', 'Retenções'),
        ('COMPROVATIVOS', 'Comprovativos de Pagamento'),
        ('IMPOSTO_INDUSTRIAL', 'Imposto Industrial'),
        ('DECLARACAO_IRT', 'Declaração de IRT'),
        ('FOLHA_SS', 'Folha Segurança Social'),
        ('DOSSIE_MENSAL', 'Dossiê Mensal Completo'),
        ('OUTRO', 'Outro'),
    ]
    ESTADO_CHOICES = [
        ('RECEBIDO', 'Recebido'),
        ('PROCESSANDO', 'Processando'),
        ('PROCESSADO', 'Processado'),
        ('VALIDADO', 'Validado'),
        ('UTILIZADO', 'Utilizado na auditoria'),
        ('ERRO', 'Processamento falhou'),
        ('ILEGIVEL', 'Documento ilegível'),
        ('PERIODO_ERRADO', 'Período incorrecto'),
        ('TIPO_DESCONHECIDO', 'Tipo desconhecido'),
    ]

    empresa = models.ForeignKey(
        Empresa, on_delete=models.PROTECT, related_name='documentos',
        null=True, blank=True,
    )
    ano = models.IntegerField(null=True, blank=True)
    mes = models.IntegerField(null=True, blank=True)
    arquivo = models.FileField(upload_to='documentos/%Y/%m/')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    tipo_sugerido = models.CharField(
        max_length=20, choices=TIPO_CHOICES, null=True, blank=True,
        help_text='Classificação automática (Fase 2); o utilizador pode corrigir via "tipo".'
    )
    estado = models.CharField(
        max_length=20, choices=ESTADO_CHOICES, default='RECEBIDO'
    )
    nome_arquivo = models.CharField(max_length=255)
    texto_extraido = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'documentos_upload'
        ordering = ['-created_at']

    def __str__(self):
        periodo = f" {self.mes}/{self.ano}" if self.ano and self.mes else ""
        return f"{self.tipo}{periodo} - {self.nome_arquivo}"


class AnaliseIA(models.Model):
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('CONCLUIDA', 'Concluída'),
        ('ERRO', 'Erro'),
    ]
    documento_contabilidade = models.ForeignKey(
        DocumentoUpload, on_delete=models.CASCADE, related_name='analises_contab',
        null=True, blank=True
    )
    documento_agt = models.ForeignKey(
        DocumentoUpload, on_delete=models.CASCADE, related_name='analises_agt',
        null=True, blank=True
    )
    resultado = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analises_ia'
        ordering = ['-created_at']

    def __str__(self):
        return f"Análise {self.id} - {self.status}"


class Motor(models.Model):
    """Catálogo estático dos 15 motores de auditoria (seed — Fase 3)."""

    IMPLEMENTACAO_CHOICES = [
        ('PENDENTE', 'Por implementar'),
        ('PARCIAL', 'Implementação parcial'),
        ('ACTIVO', 'Activo'),
    ]

    codigo = models.CharField(max_length=4, unique=True)  # 'M1' .. 'M15'
    nome = models.CharField(max_length=120)
    descricao = models.TextField(blank=True, default='')
    ordem = models.PositiveSmallIntegerField(default=0)
    # Lista de regimes de IVA onde o motor aplica; vazia = aplica a todos.
    regimes_aplicaveis = models.JSONField(default=list, blank=True)
    implementacao = models.CharField(
        max_length=20, choices=IMPLEMENTACAO_CHOICES, default='PENDENTE'
    )
    ativo = models.BooleanField(default=True)

    class Meta:
        db_table = 'auditoria_motor'
        ordering = ['ordem', 'codigo']

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class DocumentoRequerido(models.Model):
    """Matriz §7: que tipos de documento cada motor precisa num período."""

    motor = models.ForeignKey(
        Motor, on_delete=models.CASCADE, related_name='documentos_requeridos'
    )
    tipo_documento = models.CharField(
        max_length=20, choices=DocumentoUpload.TIPO_CHOICES
    )
    obrigatorio = models.BooleanField(default=True)

    class Meta:
        db_table = 'auditoria_documento_requerido'
        unique_together = ('motor', 'tipo_documento')
        ordering = ['motor__ordem', 'id']

    def __str__(self):
        return f"{self.motor.codigo}: {self.tipo_documento}"


class PerfilFiscal(models.Model):
    """Motores aplicáveis a uma empresa (Fase 3, §4).

    Sem perfil ou com lista vazia => default: todos os motores activos
    aplicáveis ao regime da empresa.
    """

    empresa = models.OneToOneField(
        Empresa, on_delete=models.CASCADE, related_name='perfil_fiscal'
    )
    motores_aplicaveis = models.ManyToManyField(
        Motor, blank=True, related_name='perfis_fiscais'
    )
    observacoes = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'auditoria_perfil_fiscal'

    def __str__(self):
        return f"Perfil fiscal - {self.empresa.nome}"


class BaseLegal(models.Model):
    """Referência legal de uma regra (§31). Nunca inventada: toda a entrada
    nasce com validado_juridicamente=False até validação oficial."""

    legislacao = models.CharField(max_length=200)
    artigo = models.CharField(max_length=200)
    texto = models.TextField(blank=True, default='')
    fonte_oficial = models.URLField(blank=True, default='')
    vigencia_inicio = models.DateField(
        null=True, blank=True,
        help_text='Vazio = sem limite definido (pendente de validação jurídica).'
    )
    vigencia_fim = models.DateField(null=True, blank=True)
    validado_juridicamente = models.BooleanField(default=False)
    validado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='base_legal_validada',
    )
    validado_em = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'regra_base_legal'
        ordering = ['legislacao', 'artigo']

    def __str__(self):
        return f"{self.legislacao} — {self.artigo}"


class Regra(models.Model):
    """Regra do Rule Engine (§30). Nasce POR_VALIDAR (decisão 2 do utilizador):
    só regras VALIDADAS geram ocorrências oficiais."""

    SEVERIDADE_CHOICES = [
        ('INFORMATIVO', 'Informativo'),
        ('BAIXO', 'Baixo'),
        ('MEDIO', 'Médio'),
        ('ALTO', 'Alto'),
    ]
    ESTADO_VALIDACAO_CHOICES = [
        ('POR_VALIDAR', 'Por validar'),
        ('VALIDADA', 'Validada'),
        ('REJEITADA', 'Rejeitada'),
    ]

    codigo = models.CharField(max_length=20, unique=True)
    motor = models.ForeignKey(
        Motor, on_delete=models.PROTECT, related_name='regras'
    )
    imposto = models.CharField(max_length=30)
    nome = models.CharField(max_length=200)
    descricao = models.TextField(blank=True, default='')
    condicao = models.TextField(
        help_text='Expressão booleana com variáveis whitelisted do contexto.'
    )
    formula = models.TextField(
        blank=True, default='',
        help_text='Expressão que calcula o valor envolvido; vazio = 0.'
    )
    severidade = models.CharField(
        max_length=15, choices=SEVERIDADE_CHOICES, default='MEDIO'
    )
    recomendacao = models.TextField(blank=True, default='')
    base_legal = models.ForeignKey(
        BaseLegal, on_delete=models.PROTECT, related_name='regras'
    )
    versao = models.PositiveIntegerField(default=1)
    activa = models.BooleanField(default=True)
    estado_validacao = models.CharField(
        max_length=15, choices=ESTADO_VALIDACAO_CHOICES, default='POR_VALIDAR'
    )
    validado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='regras_validadas',
    )
    validado_em = models.DateTimeField(null=True, blank=True)
    validacao_nota = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'regra_regra'
        ordering = ['codigo']

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class Ocorrencia(models.Model):
    """Alerta gerado pelo Rule Engine com evidência encadeada obrigatória (§27)."""

    SEVERIDADE_CHOICES = Regra.SEVERIDADE_CHOICES
    ESTADO_CHOICES = [
        ('ABERTA', 'Aberta'),
        ('REVISADA', 'Revisada'),
        ('IGNORADA', 'Ignorada'),
        ('RESOLVIDA', 'Resolvida'),
    ]
    EVIDENCIA_OBRIGATORIA = (
        'fontes', 'valores', 'calculo', 'diferenca', 'referencia_legal'
    )

    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name='ocorrencias'
    )
    ano = models.IntegerField()
    mes = models.IntegerField()
    regra = models.ForeignKey(
        Regra, on_delete=models.PROTECT, related_name='ocorrencias'
    )
    severidade = models.CharField(max_length=15, choices=SEVERIDADE_CHOICES)
    valor_envolvido = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )
    evidencia = models.JSONField()
    recomendacao = models.TextField(blank=True, default='')
    versao_regra = models.PositiveIntegerField(default=1)
    estado = models.CharField(
        max_length=15, choices=ESTADO_CHOICES, default='ABERTA'
    )
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ocorrencias_revisadas',
    )
    revisado_em = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'regra_ocorrencia'
        ordering = ['-created_at']
        unique_together = ('empresa', 'ano', 'mes', 'regra')

    def clean(self):
        if self.valor_envolvido is not None:
            try:
                val = Decimal(str(self.valor_envolvido)).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                max_val = Decimal('9999999999999999.99')
                min_val = Decimal('-9999999999999999.99')
                if val > max_val:
                    val = max_val
                elif val < min_val:
                    val = min_val
                self.valor_envolvido = val
            except Exception:
                self.valor_envolvido = Decimal('0.00')

        if not isinstance(self.evidencia, dict):
            raise ValidationError({'evidencia': 'Evidência deve ser um objecto.'})
        faltantes = [
            chave for chave in self.EVIDENCIA_OBRIGATORIA
            if chave not in self.evidencia
        ]
        if faltantes:
            raise ValidationError(
                {'evidencia': f'Evidência incompleta; falta: {", ".join(faltantes)}'}
            )

    def save(self, *args, **kwargs):
        if self.valor_envolvido is not None:
            try:
                val = Decimal(str(self.valor_envolvido)).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                max_val = Decimal('9999999999999999.99')
                min_val = Decimal('-9999999999999999.99')
                if val > max_val:
                    val = max_val
                elif val < min_val:
                    val = min_val
                self.valor_envolvido = val
            except Exception:
                self.valor_envolvido = Decimal('0.00')
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.regra.codigo} {self.mes}/{self.ano} - {self.empresa.nome}"
