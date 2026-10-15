from decimal import Decimal, ROUND_HALF_UP
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .taxas import (
    CARACTERISTICAS_REGIME, REGIMES_IVA as REGIMES_IVA_CHOICES,
    REGIME_GERAL, normalizar_regime, regime_por_volume,
)


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

    regime_iva = models.CharField(
        max_length=50, choices=REGIMES_IVA_CHOICES, default=REGIME_GERAL,
        help_text='Determinado pelo volume de negócios do ano anterior.',
    )
    volume_negocios_anual = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
        help_text='Volume de negócios do ano anterior, que fixa o regime de IVA.',
    )
    ano_volume_negocios = models.IntegerField(
        null=True, blank=True,
        help_text='Exercício a que respeita o volume de negócios declarado.',
    )

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

    def _canonizar_regime(self):
        """Aceita qualquer grafia conhecida e guarda o código canónico.

        A base tinha "Geral", "Regime Geral" e "Simplificado" a conviver, o
        que impedia filtrar motores por regime. A normalização tem de correr
        em `clean_fields`, antes da validação das opções: `full_clean()`
        valida os `choices` primeiro, e rejeitaria "Geral" antes de o `save()`
        ter oportunidade de o converter.
        """
        canonico = normalizar_regime(self.regime_iva)
        if canonico:
            self.regime_iva = canonico

    def clean_fields(self, exclude=None):
        self._canonizar_regime()
        return super().clean_fields(exclude=exclude)

    def save(self, *args, **kwargs):
        self._canonizar_regime()
        return super().save(*args, **kwargs)

    @property
    def caracteristicas_regime(self):
        """O que a lei impõe a este regime: taxa, dedução, obrigações."""
        return CARACTERISTICAS_REGIME.get(self.regime_iva, {})

    @property
    def tem_obrigacoes_iva(self):
        """O regime de exclusão não liquida nem deduz IVA."""
        return self.caracteristicas_regime.get('tem_obrigacoes_iva', True)

    @property
    def regime_esperado(self):
        """Regime que o volume de negócios declarado impõe, se conhecido."""
        return regime_por_volume(self.volume_negocios_anual)

    @property
    def regime_divergente(self):
        """True quando o regime registado não corresponde ao volume de negócios.

        Não é, por si só, um erro: pode haver opção legítima por um regime
        mais exigente. É por isso um alerta de confirmação, não de infracção.
        """
        esperado = self.regime_esperado
        return bool(esperado and esperado != self.regime_iva)

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


class ObrigacaoFiscal(models.Model):
    """Obrigação declarativa ou de pagamento de um período (§22).

    É o que permite ao sistema olhar para a frente: até agora só sabia
    comentar documentos já carregados. Cada obrigação nasce do calendário
    fiscal (`calendario_service`) com a sua data-limite e base legal, e
    fecha quando há prova documental do cumprimento.

    `valor_declarado` vs `valor_pago` responde à pergunta mais cara da
    fiscalidade angolana: declarei, mas cheguei a pagar?
    """

    TIPO_CHOICES = [
        ('DECLARACAO', 'Entrega de declaração'),
        ('PAGAMENTO', 'Pagamento de imposto'),
    ]
    ESTADO_CHOICES = [
        ('PENDENTE', 'Por cumprir, dentro do prazo'),
        ('A_VENCER', 'Por cumprir, prazo a terminar'),
        ('VENCIDA', 'Prazo ultrapassado'),
        ('CUMPRIDA', 'Cumprida no prazo'),
        ('CUMPRIDA_FORA_PRAZO', 'Cumprida fora do prazo'),
    ]

    empresa = models.ForeignKey(
        Empresa, on_delete=models.CASCADE, related_name='obrigacoes'
    )
    imposto = models.CharField(max_length=30)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    ano = models.IntegerField()
    mes = models.IntegerField()

    data_limite = models.DateField()
    data_cumprimento = models.DateField(null=True, blank=True)
    estado = models.CharField(
        max_length=25, choices=ESTADO_CHOICES, default='PENDENTE'
    )

    valor_declarado = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    valor_pago = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )

    documento = models.ForeignKey(
        DocumentoUpload, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='obrigacoes_cumpridas',
        help_text='Prova documental do cumprimento.',
    )
    base_legal = models.ForeignKey(
        BaseLegal, on_delete=models.PROTECT, related_name='obrigacoes'
    )
    observacoes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fiscal_obrigacao'
        ordering = ['data_limite', 'imposto']
        unique_together = ('empresa', 'imposto', 'tipo', 'ano', 'mes')

    def __str__(self):
        return f"{self.imposto} {self.tipo} {self.mes:02d}/{self.ano} - {self.estado}"

    @property
    def dias_para_limite(self):
        """Dias até à data-limite. Negativo = prazo ultrapassado."""
        from datetime import date
        return (self.data_limite - date.today()).days

    @property
    def em_falta(self):
        """Montante declarado por liquidar."""
        if self.valor_declarado is None:
            return Decimal('0.00')
        return max(self.valor_declarado - (self.valor_pago or Decimal('0')), Decimal('0.00'))


class RegistroAcessoAdmin(models.Model):
    """Registo de auditoria de segurança de tentativas de acesso ao Portal Administrativo."""
    RESULTADO_CHOICES = [
        ('PERMITIDO', 'Permitido (Administrador)'),
        ('NEGADO', 'Bloqueado / Não Autorizado'),
    ]

    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tentativas_acesso_admin'
    )
    username = models.CharField(max_length=150, default='', blank=True)
    empresa_nome = models.CharField(max_length=255, blank=True, default='')
    ip_origem = models.CharField(max_length=45, blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    rota_tentada = models.CharField(max_length=255, default='/admin-gestao')
    motivo = models.CharField(max_length=255, default='Acesso reservado ao Administrador do Sistema.')
    resultado = models.CharField(max_length=20, choices=RESULTADO_CHOICES, default='NEGADO')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'seguranca_registro_acesso_admin'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.resultado}] {self.username} -> {self.rota_tentada} em {self.created_at}"


class LancamentoContabilistico(models.Model):
    """
    Registo oficial no Livro Diário de Lançamentos Contabilísticos (Partidas Dobradas).
    Cada lançamento obedece rigorosamente às contas do PGC (Decreto n.º 82/01)
    e à equação fundamental da contabilidade: Total Débito == Total Crédito.
    """
    TIPO_DIARIO_CHOICES = [
        ('GERAL', 'Diário Geral'),
        ('COMPRAS', 'Diário de Compras e Fornecedores'),
        ('VENDAS', 'Diário de Vendas e Clientes'),
        ('BANCOS', 'Diário de Movimentos Bancários'),
        ('CAIXA', 'Diário de Caixa'),
        ('OPERACOES_DIVERSAS', 'Operações Diversas'),
        ('DIVERSOS', 'Operações Diversas'),
        ('APURAMENTO_IVA', 'Apuramento e Liquidação de IVA'),
        ('FECHO_EXERCICIO', 'Fecho do Exercício e Apuramento de Resultados'),
    ]

    ESTADO_CHOICES = [
        ('CONFIRMADO', 'Confirmado / Escriturado'),
        ('RASCUNHO', 'Rascunho / Provisório'),
        ('ANULADO', 'Anulado / Estornado'),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='lancamentos',
        help_text='Empresa titular da escrituração contabilística.'
    )
    numero_diario = models.CharField(
        max_length=50,
        help_text='Número sequencial do lançamento (ex: DIA-2026-0001).'
    )
    data_lancamento = models.DateField(
        help_text='Data do facto patrimonial / operação contabilística.'
    )
    tipo_diario = models.CharField(
        max_length=30,
        choices=TIPO_DIARIO_CHOICES,
        default='GERAL'
    )
    descricao = models.CharField(
        max_length=255,
        help_text='Histórico ou descritivo da operação contabilística.'
    )
    documento_referencia = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='N.º da Fatura, Recibo, Guia de Entrega ou Documento de Suporte.'
    )
    documento_anexo = models.ForeignKey(
        DocumentoUpload,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='lancamentos_suporte',
        help_text='Comprovativo digital arquivado no repositório.'
    )
    ano = models.IntegerField()
    mes = models.IntegerField()
    total_debito = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_credito = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00')
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='CONFIRMADO'
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='lancamentos_criados'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contabilidade_lancamento'
        ordering = ['-data_lancamento', '-id']
        unique_together = ('empresa', 'numero_diario', 'ano')

    def __str__(self):
        return f"[{self.numero_diario}] {self.data_lancamento.strftime('%d/%m/%Y')} - {self.descricao} ({self.total_debito} Kz)"

    def clean(self):
        super().clean()
        if self.total_debito != self.total_credito:
            raise ValidationError(
                f"Lançamento desbalanceado: Total Débito ({self.total_debito}) difere do Total Crédito ({self.total_credito})."
            )


class LinhaLancamento(models.Model):
    """
    Linha individual de débito ou crédito associada a um Lançamento Contabilístico.
    Mapeada a uma conta do PGC de Angola (Decreto n.º 82/01).
    """
    lancamento = models.ForeignKey(
        LancamentoContabilistico,
        on_delete=models.CASCADE,
        related_name='linhas'
    )
    ordem = models.IntegerField(default=1)
    conta_codigo = models.CharField(
        max_length=30,
        help_text='Código da conta do PGC (ex: 31.1.1, 34.5.2, 43.1.2).'
    )
    conta_nome = models.CharField(
        max_length=200,
        help_text='Designação oficial da conta no PGC.'
    )
    debito = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00')
    )
    credito = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00')
    )
    descricao_linha = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Descritivo específico para a linha, se diferente do cabeçalho.'
    )
    terceiro_nif = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text='NIF do cliente, fornecedor ou entidade terceira.'
    )
    terceiro_nome = models.CharField(
        max_length=150,
        blank=True,
        default='',
        help_text='Nome do cliente, fornecedor ou terceiro.'
    )

    class Meta:
        db_table = 'contabilidade_linha_lancamento'
        ordering = ['lancamento', 'ordem', 'id']

    def __str__(self):
        natureza = f"D: {self.debito}" if self.debito > 0 else f"C: {self.credito}"
        return f"{self.conta_codigo} - {self.conta_nome} | {natureza}"


class Factura(models.Model):
    """
    Registo estruturado de Facturas de Fornecedor ou Cliente processadas pelo Scanner com IA.
    Em conformidade com as regras fiscais de Angola (AGT, CIVA, PGC).
    """
    TIPO_DOC_CHOICES = [
        ('FT', 'Factura'),
        ('FR', 'Factura-Recibo'),
        ('FS', 'Factura Simplificada'),
        ('NC', 'Nota de Crédito'),
        ('ND', 'Nota de Débito'),
    ]

    TIPO_OPERACAO_CHOICES = [
        ('COMPRA', 'Compra / Fornecedor'),
        ('VENDA', 'Venda / Cliente'),
    ]

    CONFORMIDADE_CHOICES = [
        ('CONFORME', 'Conforme AGT'),
        ('AVISO', 'Aviso / Verificação'),
        ('IRREGULAR', 'Irregular perante AGT'),
    ]

    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='facturas',
        help_text='Empresa titular da fatura (adquirente ou emitente).'
    )
    documento = models.ForeignKey(
        DocumentoUpload,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='facturas_extraidas',
        help_text='Ficheiro digital ou PDF original associado.'
    )
    tipo_documento = models.CharField(
        max_length=10,
        choices=TIPO_DOC_CHOICES,
        default='FT',
        help_text='Tipo de documento fiscal (FT, FR, FS, NC, ND).'
    )
    tipo_operacao = models.CharField(
        max_length=10,
        choices=TIPO_OPERACAO_CHOICES,
        default='COMPRA',
        help_text='Indica se é fatura de fornecedor (compra) ou venda.'
    )
    numero_factura = models.CharField(
        max_length=80,
        help_text='Número oficial da fatura (ex: FT 2026/00142 ou FT FA/001).'
    )
    data_emissao = models.DateField(
        null=True,
        blank=True,
        help_text='Data de emissão constante da fatura.'
    )
    data_vencimento = models.DateField(
        null=True,
        blank=True,
        help_text='Data de vencimento do pagamento.'
    )
    ano = models.IntegerField(null=True, blank=True)
    mes = models.IntegerField(null=True, blank=True)

    # Dados do Terceiro / Fornecedor
    fornecedor_nome = models.CharField(max_length=200, blank=True, default='')
    fornecedor_nif = models.CharField(max_length=30, blank=True, default='')
    fornecedor_endereco = models.CharField(max_length=255, blank=True, default='')

    # Dados do Adquirente / Cliente
    cliente_nome = models.CharField(max_length=200, blank=True, default='')
    cliente_nif = models.CharField(max_length=30, blank=True, default='')

    # Valores Financeiros e Fiscais (Kz)
    base_incidencia = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Valor base sujeito a incidência de IVA.'
    )
    taxa_iva = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('14.00'),
        help_text='Taxa de IVA aplicada (14%, 5%, 0% - isento).'
    )
    valor_iva = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Montante total do IVA liquidado/suportado.'
    )
    motivo_isencao_iva = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Código de isenção AGT se taxa 0% (ex: M02 - Artigo 12.º do CIVA).'
    )
    retencao_iva = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Retenção na fonte de IVA (7% - Dec. Presidencial 180/19).'
    )
    retencao_ii = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Retenção na fonte de Imposto Industrial (6.5%).'
    )
    valor_total = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Valor total bruto da fatura (Base + IVA).'
    )
    valor_liquido = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        help_text='Valor líquido a pagar pelo adquirente (Total - Retenções).'
    )

    # Auditoria e Conformidade AGT
    software_certificacao = models.CharField(
        max_length=150, blank=True, default='',
        help_text='Menção legal de software certificado pela AGT (ex: Processado por programa certificado nº X/AGT).'
    )
    hash_agt = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Hash de 4 caracteres da assinatura digital fiscal.'
    )
    iva_dedutivel = models.BooleanField(
        default=True,
        help_text='Indica se o IVA é legalmente dedutível perante o CIVA (arts. 19º e 20º).'
    )
    motivo_nao_dedutivel = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Fundamentação legal em caso de exclusão do direito à dedução.'
    )
    conformidade_agt = models.CharField(
        max_length=20,
        choices=CONFORMIDADE_CHOICES,
        default='CONFORME',
        help_text='Estado de conformidade fiscal e requisitos legais da AGT.'
    )
    alertas_auditoria = models.JSONField(
        default=list,
        blank=True,
        help_text='Lista de alertas detetados pela IA e validações fiscais.'
    )

    # Classificação Contabilística Sugerida (PGC Angola)
    conta_custo_sugerida = models.CharField(
        max_length=40, blank=True, default='62.2',
        help_text='Código da conta de custo/gastos ou compras no PGC.'
    )
    conta_custo_nome = models.CharField(
        max_length=150, blank=True, default='Fornecimentos e Serviços de Terceiros'
    )
    conta_terceiro_sugerida = models.CharField(
        max_length=40, blank=True, default='32.1.1',
        help_text='Conta de Terceiros / Fornecedores no PGC.'
    )
    conta_terceiro_nome = models.CharField(
        max_length=150, blank=True, default='Fornecedores Nacionais - Correntes'
    )
    conta_iva_sugerida = models.CharField(
        max_length=40, blank=True, default='34.5.2',
        help_text='Conta de IVA Suportado Operações Gerais no PGC.'
    )
    conta_iva_nome = models.CharField(
        max_length=150, blank=True, default='IVA Suportado - Operações Gerais'
    )

    # Integração com Escrituração / Lançamento
    lancado_na_contabilidade = models.BooleanField(
        default=False,
        help_text='Indica se já foi gerado lançamento contabilístico no diário.'
    )
    lancamento = models.ForeignKey(
        LancamentoContabilistico,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='facturas_origem',
        help_text='Lançamento no Livro Diário gerado a partir desta fatura.'
    )

    itens_detalhe = models.JSONField(
        default=list,
        blank=True,
        help_text='Linhas de produtos e serviços extraídas da fatura.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contabilidade_factura'
        ordering = ['-data_emissao', '-created_at']

    def __str__(self):
        fornecedor = self.fornecedor_nome or self.fornecedor_nif or 'Fornecedor Desconhecido'
        return f"{self.tipo_documento} {self.numero_factura} - {fornecedor} ({self.valor_total} Kz)"


