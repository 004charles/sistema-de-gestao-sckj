#!/usr/bin/env python3
"""
Script de teste para verificar a conexão com a API Groq
Execute: python3 testar_groq.py
"""

import sys
import os

# Adicionar o diretório do backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sistema-reconciliacao-iva', 'backend'))

from decouple import config
from groq import Groq

def testar_conexao():
    print("=" * 50)
    print("   TESTE DE CONEXÃO COM API GROQ")
    print("=" * 50)
    print()
    
    # 1. Verificar API Key
    api_key = config('GROQ_API_KEY', default='')
    if not api_key:
        print("❌ GROQ_API_KEY não configurada no arquivo .env")
        return False
    
    print(f"✓ API Key encontrada: {api_key[:10]}...")
    print()
    
    # 2. Criar cliente
    try:
        client = Groq(api_key=api_key)
        print("✓ Cliente Groq criado com sucesso")
    except Exception as e:
        print(f"❌ Erro ao criar cliente: {e}")
        return False
    
    # 3. Listar modelos disponíveis
    print()
    print("Models disponíveis na sua conta:")
    print("-" * 50)
    
    try:
        models = client.models.list()
        for model in models.data:
            print(f"  • {model.id}")
    except Exception as e:
        print(f"❌ Erro ao listar modelos: {e}")
        print("  Possíveis causas:")
        print("  - Chave de API inválida ou expirada")
        print("  - Problemas de conexão com a internet")
        return False
    
    print()
    print("-" * 50)
    
    # 4. Testar modelo específico
    model_to_test = config('GROQ_MODEL', default='llama-3.3-70b-versatile')
    print(f"Testando modelo: {model_to_test}")
    
    try:
        response = client.chat.completions.create(
            model=model_to_test,
            messages=[
                {"role": "user", "content": "Responda apenas 'OK' para testar a conexão."}
            ],
            max_tokens=10,
        )
        
        resposta = response.choices[0].message.content
        print(f"✓ Modelo respondeu: {resposta}")
        print()
        print("=" * 50)
        print("   TESTE CONCLUÍDO COM SUCESSO!")
        print("=" * 50)
        return True
        
    except Exception as e:
        print(f"❌ Erro ao chamar modelo {model_to_test}: {e}")
        print()
        print("Possíveis soluções:")
        print("1. Verifique se o modelo está correto no .env")
        print("2. Verifique se sua chave tem acesso ao modelo")
        print("3. Teste com outro modelo:")
        
        # Tentar modelos alternativos
        modelos_teste = ['llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192']
        for modelo in modelos_teste:
            try:
                print(f"   Testando {modelo}...", end=" ")
                response = client.chat.completions.create(
                    model=modelo,
                    messages=[{"role": "user", "content": "OK"}],
                    max_tokens=5,
                )
                print(f"✓ FUNCIONA! Use este modelo no .env")
            except:
                print(f"✗ Não disponível")
        
        return False

if __name__ == "__main__":
    # Mudar para o diretório do backend
    os.chdir(os.path.join(os.path.dirname(__file__), 'sistema-reconciliacao-iva', 'backend'))
    testar_conexao()
