from django.db import models


class Empresa(models.Model):
    nome = models.CharField(max_length=200)
    nif = models.CharField(max_length=14, unique=True)
    regime_iva = models.CharField(max_length=50)
    endereco = models.TextField(blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'empresas'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} - NIF: {self.nif}"


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
        ('CONTABILIDADE', 'Dados Contabilidade'),
        ('AGT', 'Portal AGT'),
    ]
    arquivo = models.FileField(upload_to='documentos/%Y/%m/')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    nome_arquivo = models.CharField(max_length=255)
    texto_extraido = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'documentos_upload'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.tipo} - {self.nome_arquivo}"


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
