from decimal import Decimal
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    Empresa, EmpresaUtilizador, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, AnaliseIA, LancamentoContabilistico, LinhaLancamento,
    Factura
)

NIF_DUPLICADO_MSG = 'Já existe uma empresa registada com este NIF.'


class EmpresaSerializer(serializers.ModelSerializer):
    nif = serializers.CharField(
        max_length=14,
        validators=[
            UniqueValidator(queryset=Empresa.objects.all(), message=NIF_DUPLICADO_MSG),
        ],
        error_messages={'unique': NIF_DUPLICADO_MSG},
    )
    # O regime é guardado em código ('GERAL'); a interface mostra o nome.
    regime_nome = serializers.SerializerMethodField()
    regime_resumo = serializers.SerializerMethodField()
    regime_esperado = serializers.ReadOnlyField()
    regime_divergente = serializers.ReadOnlyField()
    tem_obrigacoes_iva = serializers.ReadOnlyField()

    class Meta:
        model = Empresa
        fields = '__all__'

    def get_regime_nome(self, obj):
        return obj.caracteristicas_regime.get('nome', obj.regime_iva)

    def get_regime_resumo(self, obj):
        return obj.caracteristicas_regime.get('resumo', '')

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for campo_data in ('data_constituicao', 'data_inicio_atividade', 'periodo_inicial_analise'):
            if campo_data in data and (data[campo_data] == '' or data[campo_data] is None):
                data[campo_data] = None
        if 'volume_negocios_anual' in data and (data['volume_negocios_anual'] == '' or data['volume_negocios_anual'] is None):
            data['volume_negocios_anual'] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        data_constituicao = attrs.get(
            'data_constituicao', getattr(self.instance, 'data_constituicao', None)
        )
        data_inicio = attrs.get(
            'data_inicio_atividade', getattr(self.instance, 'data_inicio_atividade', None)
        )
        if data_constituicao and data_inicio and data_inicio < data_constituicao:
            raise serializers.ValidationError({
                'data_inicio_atividade':
                    'A data de início de atividade não pode ser anterior à data de constituição.'
            })
        return attrs


class EmpresaUtilizadorSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    utilizador_username = serializers.CharField(
        source='utilizador.username', read_only=True
    )

    class Meta:
        model = EmpresaUtilizador
        fields = '__all__'


class ContabilidadeSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)

    class Meta:
        model = Contabilidade
        fields = '__all__'


class DeclaracaoAGTSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)

    class Meta:
        model = DeclaracaoAGT
        fields = '__all__'


class ReconciliacaoDetalheSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliacaoDetalhe
        fields = '__all__'


class ReconciliacaoSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    empresa_nif = serializers.CharField(source='empresa.nif', read_only=True)
    detalhes = ReconciliacaoDetalheSerializer(many=True, read_only=True)

    class Meta:
        model = Reconciliacao
        fields = '__all__'


class MapeamentoContaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MapeamentoConta
        fields = '__all__'


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class ReconciliacaoExecutarSerializer(serializers.Serializer):
    empresa_id = serializers.IntegerField()
    ano = serializers.IntegerField()
    mes = serializers.IntegerField(min_value=1, max_value=12)


class DocumentoUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoUpload
        fields = '__all__'


class AnaliseIASerializer(serializers.ModelSerializer):
    documento_contabilidade_nome = serializers.CharField(
        source='documento_contabilidade.nome_arquivo', read_only=True
    )
    documento_agt_nome = serializers.CharField(
        source='documento_agt.nome_arquivo', read_only=True
    )

    class Meta:
        model = AnaliseIA
        fields = '__all__'


class LinhaLancamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LinhaLancamento
        fields = '__all__'
        read_only_fields = ('lancamento',)


class LancamentoContabilisticoSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    empresa_nif = serializers.CharField(source='empresa.nif', read_only=True)
    linhas = LinhaLancamentoSerializer(many=True, required=False)
    criado_por_nome = serializers.CharField(source='criado_por.username', read_only=True)

    class Meta:
        model = LancamentoContabilistico
        fields = '__all__'

    def validate(self, attrs):
        linhas_data = self.initial_data.get('linhas', [])
        if not self.instance and not linhas_data:
            raise serializers.ValidationError({"linhas": "O lançamento deve conter pelo menos duas linhas (partidas dobradas)."})

        if linhas_data:
            total_d = sum(float(l.get('debito', 0) or 0) for l in linhas_data)
            total_c = sum(float(l.get('credito', 0) or 0) for l in linhas_data)
            if round(total_d, 2) != round(total_c, 2):
                raise serializers.ValidationError({
                    "non_field_errors": f"Lançamento desbalanceado: Total Débito ({total_d:.2f} Kz) é diferente do Total Crédito ({total_c:.2f} Kz)."
                })
        return attrs

    def create(self, validated_data):
        linhas_data = self.initial_data.get('linhas', [])
        validated_data.pop('linhas', None)
        total_d = sum(Decimal(str(l.get('debito', 0) or 0)) for l in linhas_data)
        total_c = sum(Decimal(str(l.get('credito', 0) or 0)) for l in linhas_data)
        validated_data['total_debito'] = total_d
        validated_data['total_credito'] = total_c
        lancamento = LancamentoContabilistico.objects.create(**validated_data)
        for idx, linha in enumerate(linhas_data, start=1):
            LinhaLancamento.objects.create(
                lancamento=lancamento,
                ordem=linha.get('ordem', idx),
                conta_codigo=linha.get('conta_codigo', '').strip(),
                conta_nome=linha.get('conta_nome', '').strip(),
                debito=Decimal(str(linha.get('debito', 0) or 0)),
                credito=Decimal(str(linha.get('credito', 0) or 0)),
                descricao_linha=linha.get('descricao_linha', '').strip(),
                terceiro_nif=linha.get('terceiro_nif', '').strip(),
                terceiro_nome=linha.get('terceiro_nome', '').strip(),
            )
        return lancamento

    def update(self, instance, validated_data):
        linhas_data = self.initial_data.get('linhas', None)
        validated_data.pop('linhas', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if linhas_data is not None:
            instance.linhas.all().delete()
            total_d = sum(Decimal(str(l.get('debito', 0) or 0)) for l in linhas_data)
            total_c = sum(Decimal(str(l.get('credito', 0) or 0)) for l in linhas_data)
            instance.total_debito = total_d
            instance.total_credito = total_c
            for idx, linha in enumerate(linhas_data, start=1):
                LinhaLancamento.objects.create(
                    lancamento=instance,
                    ordem=linha.get('ordem', idx),
                    conta_codigo=linha.get('conta_codigo', '').strip(),
                    conta_nome=linha.get('conta_nome', '').strip(),
                    debito=Decimal(str(linha.get('debito', 0) or 0)),
                    credito=Decimal(str(linha.get('credito', 0) or 0)),
                    descricao_linha=linha.get('descricao_linha', '').strip(),
                    terceiro_nif=linha.get('terceiro_nif', '').strip(),
                    terceiro_nome=linha.get('terceiro_nome', '').strip(),
                )
        instance.save()
        return instance


class FacturaSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.ReadOnlyField(source='empresa.nome')
    empresa_nif = serializers.ReadOnlyField(source='empresa.nif')
    documento_nome = serializers.ReadOnlyField(source='documento.nome_arquivo')
    lancamento_numero = serializers.ReadOnlyField(source='lancamento.numero_diario')

    class Meta:
        model = Factura
        fields = '__all__'


