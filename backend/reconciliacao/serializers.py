from rest_framework import serializers
from .models import (
    Empresa, Contabilidade, DeclaracaoAGT,
    Reconciliacao, ReconciliacaoDetalhe, MapeamentoConta,
    DocumentoUpload, AnaliseIA
)


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
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
