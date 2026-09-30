from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    Empresa, EmpresaUtilizador, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, AnaliseIA
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

    class Meta:
        model = Empresa
        fields = '__all__'

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
