import tempfile
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User, Group
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .management.commands.criar_grupos import GRUPOS
from .models import (
    AnaliseIA, DeclaracaoAGT, DocumentoUpload, Empresa, EmpresaUtilizador,
    Ocorrencia,
)

MEDIA_TESTE = tempfile.mkdtemp(prefix='test-media-')


def empresa_valida(**kwargs):
    dados = {
        'nome': 'Empresa Teste Lda',
        'nif': '5000000001',
        'regime_iva': 'Geral',
    }
    dados.update(kwargs)
    return Empresa(**dados)


class EmpresaModelTests(TestCase):

    def test_criar_empresa_valida(self):
        emp = empresa_valida()
        emp.full_clean()
        emp.save()
        self.assertEqual(Empresa.objects.count(), 1)
        self.assertEqual(emp.estado, 'ATIVA')

    def test_nif_duplicado(self):
        empresa_valida().save()
        duplicada = empresa_valida(nome='Outra Empresa')
        with self.assertRaises(ValidationError) as ctx:
            duplicada.full_clean()
        self.assertIn(
            'Já existe uma empresa registada com este NIF.',
            str(ctx.exception),
        )

    def test_campos_obrigatorios_ausentes(self):
        emp = Empresa(nome='', nif='', regime_iva='')
        with self.assertRaises(ValidationError) as ctx:
            emp.full_clean()
        erros = ctx.exception.error_dict
        self.assertIn('nome', erros)
        self.assertIn('nif', erros)
        self.assertIn('regime_iva', erros)

    def test_email_invalido(self):
        emp = empresa_valida(email='nao-e-email')
        with self.assertRaises(ValidationError) as ctx:
            emp.full_clean()
        self.assertIn('email', ctx.exception.error_dict)

    def test_datas_inicio_anterior_a_constituicao(self):
        from datetime import date
        emp = empresa_valida(
            data_constituicao=date(2020, 5, 1),
            data_inicio_atividade=date(2020, 4, 1),
        )
        with self.assertRaises(ValidationError) as ctx:
            emp.full_clean()
        self.assertIn('data_inicio_atividade', ctx.exception.error_dict)

    def test_datas_validas(self):
        from datetime import date
        emp = empresa_valida(
            data_constituicao=date(2020, 4, 1),
            data_inicio_atividade=date(2020, 5, 1),
        )
        emp.full_clean()
        emp.save()
        self.assertEqual(emp.data_inicio_atividade, date(2020, 5, 1))

    def test_atualizacao_empresa(self):
        emp = empresa_valida()
        emp.save()
        emp.nome = 'Empresa Renomeada'
        emp.estado = 'SUSPENSA'
        emp.full_clean()
        emp.save()
        emp.refresh_from_db()
        self.assertEqual(emp.nome, 'Empresa Renomeada')
        self.assertEqual(emp.estado, 'SUSPENSA')

    def test_estado_invalido(self):
        emp = empresa_valida(estado='QUALQUER')
        with self.assertRaises(ValidationError) as ctx:
            emp.full_clean()
        self.assertIn('estado', ctx.exception.error_dict)

    def test_estado_inativa_apos_migracao(self):
        emp = empresa_valida()
        emp.save()
        emp.estado = 'INATIVA'
        emp.full_clean()
        emp.save()
        emp.refresh_from_db()
        self.assertEqual(emp.estado, 'INATIVA')


class GruposTests(TestCase):

    def test_grupos_criados(self):
        from django.core.management import call_command
        call_command('criar_grupos')
        self.assertEqual(Group.objects.count(), len(GRUPOS))
        for nome in GRUPOS:
            self.assertTrue(Group.objects.filter(name=nome).exists(), nome)

    def test_consulta_somente_leitura(self):
        from django.core.management import call_command
        call_command('criar_grupos')
        user = User.objects.create_user('consulta1', password='x')
        user.groups.add(Group.objects.get(name='Consulta'))
        self.assertTrue(user.has_perm('reconciliacao.view_empresa'))
        self.assertFalse(user.has_perm('reconciliacao.add_empresa'))
        self.assertFalse(user.has_perm('reconciliacao.change_empresa'))
        self.assertFalse(user.has_perm('reconciliacao.delete_empresa'))

    def test_contabilista_gerir_contabilidade(self):
        from django.core.management import call_command
        call_command('criar_grupos')
        user = User.objects.create_user('contab1', password='x')
        user.groups.add(Group.objects.get(name='Contabilista'))
        self.assertTrue(user.has_perm('reconciliacao.view_contabilidade'))
        self.assertTrue(user.has_perm('reconciliacao.add_contabilidade'))
        self.assertFalse(user.has_perm('reconciliacao.add_empresa'))


class EmpresaAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()

        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        self.joao = User.objects.create_user('joao', password='pw')

        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_anonimo_recebe_401(self):
        resp = self.client.get('/api/empresas/')
        self.assertEqual(resp.status_code, 401)

    def test_login_devolve_token(self):
        User.objects.create_user('loginuser', password='secret123')
        resp = self.client.post(
            '/api/auth/login/',
            {'username': 'loginuser', 'password': 'secret123'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        self.assertIn('token', resp.data['user'])
        self.assertEqual(Token.objects.get(user__username='loginuser').key,
                         resp.data['user']['token'])

    def test_login_credenciais_invalidas(self):
        resp = self.client.post(
            '/api/auth/login/',
            {'username': 'ninguem', 'password': 'errado'},
            format='json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_lista_somente_empresas_autorizadas(self):
        self.autenticar(self.carlos)
        resp = self.client.get('/api/empresas/')
        self.assertEqual(resp.status_code, 200)
        nifs = [e['nif'] for e in resp.data['results']] if isinstance(resp.data, dict) \
            else [e['nif'] for e in resp.data]
        self.assertEqual(nifs, ['5000000010'])

    def test_superuser_ve_todas(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/empresas/')
        self.assertEqual(resp.status_code, 200)
        nifs = [e['nif'] for e in resp.data['results']] if isinstance(resp.data, dict) \
            else [e['nif'] for e in resp.data]
        self.assertEqual(sorted(nifs), ['5000000010', '5000000020'])

    def test_detalhe_sem_acesso_devolve_404(self):
        self.autenticar(self.carlos)
        resp = self.client.get(f'/api/empresas/{self.emp_b.pk}/')
        self.assertEqual(resp.status_code, 404)

    def test_detalhe_com_acesso_devolve_200(self):
        self.autenticar(self.carlos)
        resp = self.client.get(f'/api/empresas/{self.emp_a.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['nif'], '5000000010')

    def test_utilizador_sem_acesso_nao_ve_nada(self):
        self.autenticar(self.joao)
        resp = self.client.get('/api/empresas/')
        self.assertEqual(resp.status_code, 200)
        dados = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(dados), 0)

    def test_acesso_inativo_nao_conta(self):
        EmpresaUtilizador.objects.filter(
            utilizador=self.carlos, empresa=self.emp_a
        ).update(ativo=False)
        self.autenticar(self.carlos)
        resp = self.client.get('/api/empresas/')
        dados = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(dados), 0)

    def test_administrador_pode_cadastrar_e_editar_empresa(self):
        # Administrador pode criar
        self.autenticar(self.superuser)
        resp = self.client.post('/api/empresas/', {
            'nome': 'Nova Empresa SA', 'nif': '5000000099', 'regime_iva': 'GERAL',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        emp_id = resp.data['id']

        # Administrador pode criar mesmo com strings de data vazias ("")
        resp_vazio = self.client.post('/api/empresas/', {
            'nome': 'Empresa Datas Vazias',
            'nif': '5000000098',
            'regime_iva': 'GERAL',
            'data_constituicao': '',
            'data_inicio_atividade': '',
            'periodo_inicial_analise': '',
            'volume_negocios_anual': '',
        }, format='json')
        self.assertEqual(resp_vazio.status_code, 201)
        self.assertIsNone(resp_vazio.data['data_constituicao'])
        self.assertIsNone(resp_vazio.data['data_inicio_atividade'])

        # Administrador pode editar
        resp = self.client.put(f'/api/empresas/{emp_id}/', {
            'nome': 'Empresa SA Alterada', 'nif': '5000000099', 'regime_iva': 'GERAL',
        }, format='json')
        self.assertEqual(resp.status_code, 200)

        # Utilizador sem perfil de admin é bloqueado (403)
        self.autenticar(self.carlos)
        resp = self.client.post('/api/empresas/', {
            'nome': 'Empresa Invadida', 'nif': '5000000088', 'regime_iva': 'GERAL',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_filtro_por_estado(self):
        self.emp_b.estado = 'SUSPENSA'
        self.emp_b.save()
        self.autenticar(self.superuser)
        resp = self.client.get('/api/empresas/', {'estado': 'SUSPENSA'})
        dados = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(dados), 1)
        self.assertEqual(dados[0]['nif'], '5000000020')


PDF_FALSO = b'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'


def documento_upload(empresa, tipo='BALANCETE', **kwargs):
    texto_padrao = (
        'Balancete Geral de Verificação\nConta Descrição Mov. Débito Mov. Crédito Saldo Débito Saldo Crédito\n31 Clientes 1000,00 1000,00 0,00 0,00\n34 Estado 140,00 140,00 0,00 0,00'
        if tipo == 'BALANCETE' else
        'Comprovativo de Entrega de Declaração Modelo 7 de IVA\nRegime Geral Repartição Fiscal Catete\nApuramento do Imposto Quadro 09 Base Tributável 1000,00 Imposto a favor do Estado 140,00'
        if tipo == 'MODELO7' else
        'texto de teste'
    )
    dados = {
        'empresa': empresa,
        'ano': 2026,
        'mes': 7,
        'tipo': tipo,
        'estado': 'VALIDADO',
        'nome_arquivo': 'balancete_teste.pdf' if tipo == 'BALANCETE' else 'modelo7_teste.pdf' if tipo == 'MODELO7' else 'teste.pdf',
        'texto_extraido': texto_padrao,
    }
    dados.update(kwargs)
    doc = DocumentoUpload(**dados)
    doc.arquivo.save('teste.pdf', content=ContentFile(PDF_FALSO), save=False)
    doc.save()
    return doc


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class DocumentoUploadAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()

        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def upload(self, **extras):
        dados = {
            'arquivo': SimpleUploadedFile('balancete.pdf', PDF_FALSO),
            'tipo': 'BALANCETE',
            'empresa_id': self.emp_a.pk,
            'ano': 2026,
            'mes': 7,
        }
        for chave, valor in extras.items():
            if valor is None:
                dados.pop(chave, None)
            else:
                dados[chave] = valor
        return self.client.post('/api/documentos/upload/', dados, format='multipart')

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete Julho 2026')
    def test_upload_sem_empresa_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(empresa_id=None)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('empresa_id', str(resp.data))

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_sem_periodo_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(ano=None, mes=None)
        self.assertEqual(resp.status_code, 400)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_periodo_invalido_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(ano=1800, mes=13)
        self.assertEqual(resp.status_code, 400)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_tipo_desconhecido_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(tipo='QUALQUER')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('tipo', str(resp.data))

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_sem_permissao_devolve_403(self, _mock):
        self.autenticar(self.carlos)
        resp = self.upload()
        self.assertEqual(resp.status_code, 403)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_empresa_inacessivel_devolve_404(self, _mock):
        from django.contrib.auth.models import Permission
        perm = Permission.objects.get(codename='add_documentoupload')
        self.carlos.user_permissions.add(perm)
        self.autenticar(self.carlos)
        resp = self.upload(empresa_id=self.emp_b.pk)
        self.assertEqual(resp.status_code, 404)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete Julho')
    def test_upload_valido_cria_documento_validado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(nome='balancete-jul.pdf')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        doc = DocumentoUpload.objects.get(pk=resp.data['documento']['id'])
        self.assertEqual(doc.estado, 'VALIDADO')
        self.assertEqual(doc.empresa, self.emp_a)
        self.assertEqual(doc.ano, 2026)
        self.assertEqual(doc.mes, 7)
        self.assertEqual(doc.tipo, 'BALANCETE')

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='   ')
    def test_upload_sem_texto_fica_ilegivel(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload()
        self.assertEqual(resp.status_code, 200)
        doc = DocumentoUpload.objects.get(pk=resp.data['documento']['id'])
        self.assertEqual(doc.estado, 'ILEGIVEL')

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf',
           return_value='Erro ao extrair texto: ficheiro corrompido')
    def test_upload_erro_extraccao_fica_erro(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload()
        self.assertEqual(resp.status_code, 200)
        doc = DocumentoUpload.objects.get(pk=resp.data['documento']['id'])
        self.assertEqual(doc.estado, 'ERRO')

    def test_upload_ficheiro_alheio_como_balancete_rejeitado_400(self):
        self.autenticar(self.superuser)
        csv_bilheteira = b'Evento | Organizador | Data | Bilhetes | Receita bruta | Comissao\nShow | Org | 2026-09-01 | 10 | 5000 | 500'
        f = SimpleUploadedFile('acertos-eventos.csv', csv_bilheteira, content_type='text/csv')
        resp = self.client.post('/api/documentos/upload/', {
            'arquivo': f,
            'empresa_id': self.emp_a.pk,
            'ano': 2026,
            'mes': 7,
            'tipo': 'BALANCETE',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('não é um Balancete', resp.data['error'])
        self.assertFalse(DocumentoUpload.objects.filter(nome_arquivo='acertos-eventos.csv').exists())

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf',
           return_value='Edukangola | Encontre a formação certa bilhete 1 entrada valida 12 de dezembro')
    def test_upload_ficheiro_alheio_como_modelo7_rejeitado_400(self, _mock):
        self.autenticar(self.superuser)
        f = SimpleUploadedFile('edukangola.pdf', PDF_FALSO, content_type='application/pdf')
        resp = self.client.post('/api/documentos/upload/', {
            'arquivo': f,
            'empresa_id': self.emp_a.pk,
            'ano': 2026,
            'mes': 7,
            'tipo': 'MODELO7',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('não é uma Declaração Modelo 7', resp.data['error'])
        self.assertFalse(DocumentoUpload.objects.filter(nome_arquivo='edukangola.pdf').exists())


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class DocumentoListagemTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()
        self.doc_a = documento_upload(self.emp_a, ano=2026, mes=7)
        self.doc_b = documento_upload(self.emp_b, tipo='MODELO7', ano=2026, mes=6)

        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_listar_mostra_somente_empresas_acessiveis(self):
        self.autenticar(self.carlos)
        resp = self.client.get('/api/documentos/listar/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([d['id'] for d in resp.data], [self.doc_a.id])

    def test_listar_superuser_ve_todos(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/documentos/listar/')
        self.assertEqual(len(resp.data), 2)

    def test_listar_inclui_estado_e_periodo(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/documentos/listar/')
        doc = next(d for d in resp.data if d['id'] == self.doc_a.id)
        self.assertEqual(doc['estado'], 'VALIDADO')
        self.assertEqual(doc['ano'], 2026)
        self.assertEqual(doc['mes'], 7)
        self.assertEqual(doc['empresa_nome'], 'Empresa A')

    def test_listar_filtro_por_periodo(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/documentos/listar/', {'ano': 2026, 'mes': 6})
        self.assertEqual([d['id'] for d in resp.data], [self.doc_b.id])

    def test_listar_filtro_por_tipo(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/documentos/listar/', {'tipo': 'MODELO7'})
        self.assertEqual([d['id'] for d in resp.data], [self.doc_b.id])

    def test_listar_anonimo_401(self):
        resp = self.client.get('/api/documentos/listar/')
        self.assertEqual(resp.status_code, 401)

    def test_deletar_documento_acessivel(self):
        from django.contrib.auth.models import Permission
        self.carlos.user_permissions.add(
            Permission.objects.get(codename='delete_documentoupload')
        )
        self.autenticar(self.carlos)
        resp = self.client.delete(f'/api/documentos/{self.doc_a.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(DocumentoUpload.objects.filter(pk=self.doc_a.id).exists())

    def test_deletar_documento_inacessivel_404(self):
        from django.contrib.auth.models import Permission
        self.carlos.user_permissions.add(
            Permission.objects.get(codename='delete_documentoupload')
        )
        self.autenticar(self.carlos)
        resp = self.client.delete(f'/api/documentos/{self.doc_b.id}/')
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(DocumentoUpload.objects.filter(pk=self.doc_b.id).exists())

    def test_deletar_sem_permissao_403(self):
        self.autenticar(self.carlos)
        resp = self.client.delete(f'/api/documentos/{self.doc_a.id}/')
        self.assertEqual(resp.status_code, 403)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class AnaliseDocumentosEscopoTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    @patch('reconciliacao.views.pdf_service.analisar_documentos',
           return_value={'success': True, 'analise': 'relatorio ok', 'model': 'test'})
    def test_analise_marca_documentos_como_utilizados(self, _mock):
        doc_contab = documento_upload(self.emp_a, tipo='BALANCETE')
        doc_agt = documento_upload(self.emp_a, tipo='MODELO7')
        self.autenticar(self.superuser)
        resp = self.client.post('/api/analises/analise-documentos/', {
            'documento_contabilidade_id': doc_contab.id,
            'documento_agt_id': doc_agt.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        doc_contab.refresh_from_db()
        doc_agt.refresh_from_db()
        self.assertEqual(doc_contab.estado, 'UTILIZADO')
        self.assertEqual(doc_agt.estado, 'UTILIZADO')

    @patch('reconciliacao.views.pdf_service.analisar_documentos',
           return_value={'success': True, 'analise': 'x', 'model': 'test'})
    def test_analise_nao_acessa_documentos_de_outra_empresa(self, _mock):
        from django.contrib.auth.models import Permission
        self.carlos.user_permissions.add(
            Permission.objects.get(codename='add_analiseia')
        )
        doc_contab = documento_upload(self.emp_b, tipo='BALANCETE')
        doc_agt = documento_upload(self.emp_b, tipo='MODELO7')
        self.autenticar(self.carlos)
        resp = self.client.post('/api/analises/analise-documentos/', {
            'documento_contabilidade_id': doc_contab.id,
            'documento_agt_id': doc_agt.id,
        }, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_historico_filtra_por_empresa_do_utilizador(self):
        doc_a = documento_upload(self.emp_a, tipo='BALANCETE')
        doc_b = documento_upload(self.emp_b, tipo='BALANCETE')
        AnaliseIA.objects.create(documento_contabilidade=doc_a, status='CONCLUIDA', resultado='a')
        AnaliseIA.objects.create(documento_contabilidade=doc_b, status='CONCLUIDA', resultado='b')

        self.autenticar(self.carlos)
        resp = self.client.get('/api/analises/historico/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

        self.autenticar(self.superuser)
        resp = self.client.get('/api/analises/historico/')
        self.assertEqual(len(resp.data), 2)


def _xlsx_bytes(linhas, folha='Folha1'):
    import io
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = folha
    for linha in linhas:
        ws.append(linha)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class ClassificadorTests(TestCase):

    def test_balancete_por_conteudo_e_nome(self):
        from .classificador_service import classificar
        res = classificar(
            'balancete-julho.xlsx',
            'Conta | Descricao | Devedor | Crededor\n1.1 | Caixa | 500 | 0',
        )
        self.assertEqual(res['tipo'], 'BALANCETE')
        self.assertGreater(res['score'], 0)

    def test_modelo7_por_conteudo(self):
        from .classificador_service import classificar
        res = classificar(
            'relatorio.pdf',
            'Modelo 7 - Liquidacao do IVA\nIVA a entregar: 150000',
        )
        self.assertEqual(res['tipo'], 'MODELO7')

    def test_csv_facturas_venda(self):
        from .classificador_service import classificar
        res = classificar(
            'facturas.csv',
            'Factura | Cliente | Total\nF-001 | Cliente X | 1000',
        )
        self.assertEqual(res['tipo'], 'FACTURA_VENDA')

    def test_nada_corresponde_devolve_outro(self):
        from .classificador_service import classificar
        res = classificar('relatorio.pdf', 'texto sem qualquer indicio fiscal')
        self.assertEqual(res['tipo'], 'OUTRO')
        self.assertEqual(res['score'], 0)

    def test_irt_nao_casa_em_palavras_comuns(self):
        from .classificador_service import classificar
        res = classificar('nota.pdf', 'direito adquirido e exercicio')
        self.assertEqual(res['tipo'], 'OUTRO')


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class ExtracaoUploadTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        token, _ = Token.objects.get_or_create(user=self.superuser)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def upload(self, arquivo, **extras):
        dados = {
            'arquivo': arquivo,
            'empresa_id': self.emp_a.pk,
            'ano': 2026,
            'mes': 7,
        }
        for chave, valor in extras.items():
            if valor is None:
                dados.pop(chave, None)
            else:
                dados[chave] = valor
        return self.client.post('/api/documentos/upload/', dados, format='multipart')

    def test_xlsx_balancete_auto_classificado(self):
        conteudo = _xlsx_bytes([
            ['Conta', 'Descricao', 'Devedor', 'Crededor'],
            ['1.1', 'Caixa', '50000', '0'],
        ])
        arquivo = SimpleUploadedFile('balancete-julho.xlsx', conteudo)
        resp = self.upload(arquivo)
        self.assertEqual(resp.status_code, 200)
        doc = resp.data['documento']
        self.assertTrue(doc['classificado_automaticamente'])
        self.assertEqual(doc['tipo'], 'BALANCETE')
        self.assertEqual(doc['tipo_sugerido'], 'BALANCETE')
        self.assertEqual(doc['formato'], 'xlsx')
        registo = DocumentoUpload.objects.get(pk=doc['id'])
        self.assertEqual(registo.estado, 'VALIDADO')
        self.assertIn('Caixa', registo.texto_extraido)

    def test_csv_facturas_auto_classificado(self):
        conteudo = b'Factura;Cliente;Total\nF-001;Cliente X;1000\nF-002;Cliente Y;2500'
        arquivo = SimpleUploadedFile('facturas-venda.csv', conteudo)
        resp = self.upload(arquivo)
        self.assertEqual(resp.status_code, 200)
        doc = resp.data['documento']
        self.assertEqual(doc['tipo'], 'FACTURA_VENDA')
        self.assertEqual(doc['tipo_sugerido'], 'FACTURA_VENDA')

    def test_xml_modelo7_auto_classificado(self):
        conteudo = (
            b'<Declaracao><Modelo7Periodo>2026-07</Modelo7Periodo>'
            b'<IVAentregar>150000</IVAentregar></Declaracao>'
        )
        arquivo = SimpleUploadedFile('modelo7.xml', conteudo)
        resp = self.upload(arquivo)
        self.assertEqual(resp.status_code, 200)
        doc = resp.data['documento']
        self.assertEqual(doc['tipo'], 'MODELO7')
        self.assertEqual(doc['formato'], 'xml')

    def test_tipo_explicito_mantido_e_sugestao_registada(self):
        conteudo = _xlsx_bytes([['Conta', 'Devedor', 'Crededor'], ['1.1', '500', '0']])
        arquivo = SimpleUploadedFile('balancete.xlsx', conteudo)
        resp = self.upload(arquivo, tipo='MODELO7')
        self.assertEqual(resp.status_code, 200)
        doc = resp.data['documento']
        self.assertEqual(doc['tipo'], 'MODELO7')
        self.assertEqual(doc['tipo_sugerido'], 'BALANCETE')
        self.assertFalse(doc['classificado_automaticamente'])

    def test_extensao_nao_suportada_rejeitada(self):
        arquivo = SimpleUploadedFile('notas.txt', b'alguma coisa')
        resp = self.upload(arquivo, tipo='OUTRO')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Formato', str(resp.data))

    def test_pdf_invalido_continua_a_ficar_erro(self):
        arquivo = SimpleUploadedFile('quebrado.pdf', b'nao e um pdf')
        resp = self.upload(arquivo)
        self.assertEqual(resp.status_code, 200)
        doc = resp.data['documento']
        self.assertEqual(doc['estado'], 'ERRO')

    def test_listagem_inclui_tipo_sugerido(self):
        conteudo = _xlsx_bytes([['Conta', 'Devedor', 'Crededor'], ['1.1', '500', '0']])
        arquivo = SimpleUploadedFile('balancete.xlsx', conteudo)
        resp = self.upload(arquivo)
        self.assertEqual(resp.status_code, 200)
        listar = self.client.get('/api/documentos/listar/')
        self.assertEqual(listar.status_code, 200)
        doc = next(d for d in listar.data if d['id'] == resp.data['documento']['id'])
        self.assertEqual(doc['tipo_sugerido'], 'BALANCETE')


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class CoberturaSeedTests(TestCase):

    def test_seed_idempotente(self):
        from .motores_seed import semear_motores
        from .models import DocumentoRequerido, Motor
        primeira = semear_motores()
        segunda = semear_motores()
        self.assertEqual(primeira, segunda)
        self.assertEqual(Motor.objects.count(), 15)
        self.assertEqual(DocumentoRequerido.objects.count(), 17)
        codigos = list(Motor.objects.values_list('codigo', flat=True))
        self.assertEqual(codigos, [f'M{i}' for i in range(1, 16)])

    def test_m10_e_m12_sem_matriz(self):
        from .motores_seed import semear_motores
        from .models import Motor
        semear_motores()
        self.assertFalse(
            Motor.objects.get(codigo='M10').documentos_requeridos.exists()
        )
        self.assertFalse(
            Motor.objects.get(codigo='M12').documentos_requeridos.exists()
        )


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class CoberturaServiceTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        semear_motores()

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Cobertura', nif='5000000030')
        self.emp.save()

    def cobrir(self, tipos, estado='VALIDADO'):
        for tipo in tipos:
            documento_upload(self.emp, tipo=tipo, estado=estado)

    def test_apenas_balancete_da_cobertura_parcial(self):
        from .cobertura_service import calcular
        self.cobrir(['BALANCETE'])
        res = calcular(self.emp, 2026, 7)
        self.assertNotEqual(res['nivel'], 'COMPLETA')
        falta = [f['tipo'] for f in res['documentos_em_falta']]
        self.assertEqual(falta, ['MODELO7'])
        entrada = res['documentos_em_falta'][0]
        self.assertIn('desbloqueia', entrada['desbloqueia'])
        self.assertIn('07/2026', entrada['desbloqueia'])
        self.assertEqual(entrada['periodo'], '07/2026')

    def test_nunca_completa_com_lacunas(self):
        from .cobertura_service import calcular
        self.cobrir(['BALANCETE'])
        res = calcular(self.emp, 2026, 7)
        self.assertNotEqual(res['nivel'], 'COMPLETA')
        self.assertTrue(res['documentos_em_falta'])

    def test_todos_os_documentos_dao_completa(self):
        from .cobertura_service import calcular
        self.cobrir(['BALANCETE', 'MODELO7'])
        res = calcular(self.emp, 2026, 7)
        self.assertEqual(res['cobertura_geral'], 100.0)
        self.assertEqual(res['nivel'], 'COMPLETA')
        self.assertEqual(res['documentos_em_falta'], [])

    def test_documento_com_erro_nao_conta(self):
        from .cobertura_service import calcular
        self.cobrir(['BALANCETE', 'MODELO7'], estado='ERRO')
        res = calcular(self.emp, 2026, 7)
        self.assertEqual(res['documentos_disponiveis'], [])
        self.assertEqual(res['cobertura_geral'], 0.0)
        self.assertEqual(res['nivel'], 'LIMITADA')

    def test_documentos_de_outro_periodo_nao_contam(self):
        from .cobertura_service import calcular
        documento_upload(self.emp, tipo='BALANCETE', mes=6)
        documento_upload(self.emp, tipo='MODELO7', mes=6)
        res = calcular(self.emp, 2026, 7)
        self.assertEqual(res['cobertura_geral'], 0.0)

    def test_perfil_fiscal_restringe_motores(self):
        from .cobertura_service import calcular
        from .models import Motor, PerfilFiscal
        perfil = PerfilFiscal.objects.create(empresa=self.emp)
        perfil.motores_aplicaveis.set(
            Motor.objects.filter(codigo__in=['M1', 'M14'])
        )
        self.cobrir(['BALANCETE', 'MODELO7'])
        res = calcular(self.emp, 2026, 7)
        self.assertEqual(len(res['motores']), 2)
        # M1: 2/2 = 100%; M14: 1/1 = 100% → 100%
        self.assertEqual(res['cobertura_geral'], 100.0)
        self.assertEqual(res['nivel'], 'COMPLETA')

    def test_regime_do_motor_filtra_por_empresa(self):
        from .cobertura_service import motores_aplicaveis
        from .models import Motor
        Motor.objects.filter(codigo='M3').update(regimes_aplicaveis=['SPECIAL'])
        codigos = [m.codigo for m in motores_aplicaveis(self.emp)]
        self.assertNotIn('M3', codigos)
        self.assertEqual(len(codigos), 14)

    def test_nivel_por_percentagem(self):
        from .cobertura_service import nivel_para_percentagem
        self.assertEqual(nivel_para_percentagem(0), 'LIMITADA')
        self.assertEqual(nivel_para_percentagem(39.9), 'LIMITADA')
        self.assertEqual(nivel_para_percentagem(40), 'PARCIAL')
        self.assertEqual(nivel_para_percentagem(74.9), 'PARCIAL')
        self.assertEqual(nivel_para_percentagem(75), 'AMPLA')
        self.assertEqual(nivel_para_percentagem(99.9), 'AMPLA')
        self.assertEqual(nivel_para_percentagem(100), 'COMPLETA')
        self.assertEqual(nivel_para_percentagem(None), 'NAO_CALCULAVEL')


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class CoberturaAPITests(TestCase):

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        semear_motores()

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_superuser_ve_cobertura_completa(self):
        documento_upload(self.emp_a, tipo='BALANCETE')
        documento_upload(self.emp_a, tipo='MODELO7')
        self.autenticar(self.superuser)
        resp = self.client.get(
            f'/api/auditoria/{self.emp_a.pk}/2026/7/cobertura/'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['nivel'], 'COMPLETA')
        self.assertEqual(resp.data['cobertura_geral'], 100.0)
        self.assertEqual(len(resp.data['motores']), 15)
        self.assertEqual(resp.data['motores_sem_matriz'], [
            {'codigo': 'M10', 'nome': 'Análise de Risco (agregador)'},
            {'codigo': 'M12', 'nome': 'Exposição Potencial'},
        ])
        self.assertIn('disclaimer', resp.data)
        self.assertEqual(resp.data['empresa_nome'], 'Empresa A')
        self.assertEqual(resp.data['documentos_em_falta'], [])

    def test_empresa_inacessivel_devolve_404(self):
        self.autenticar(self.carlos)
        resp = self.client.get(
            f'/api/auditoria/{self.emp_b.pk}/2026/7/cobertura/'
        )
        self.assertEqual(resp.status_code, 404)

    def test_periodo_invalido_devolve_400(self):
        self.autenticar(self.superuser)
        resp = self.client.get(
            f'/api/auditoria/{self.emp_a.pk}/1999/7/cobertura/'
        )
        self.assertEqual(resp.status_code, 400)
        resp = self.client.get(
            f'/api/auditoria/{self.emp_a.pk}/2026/13/cobertura/'
        )
        self.assertEqual(resp.status_code, 400)

    def test_sem_token_devolve_401(self):
        resp = self.client.get(
            f'/api/auditoria/{self.emp_a.pk}/2026/7/cobertura/'
        )
        self.assertEqual(resp.status_code, 401)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class AvaliadorExpressoesTests(TestCase):

    def ctx(self):
        return {'x': 5, 'soma': 100, 'nome': 'abc'}

    def test_expressoes_basicas(self):
        from .regra_engine import avaliar
        ctx = self.ctx()
        self.assertTrue(avaliar('x > 3', ctx))
        self.assertFalse(avaliar('x < 3', ctx))
        self.assertEqual(avaliar('soma * 2', ctx), 200)
        self.assertTrue(avaliar('x > 3 and soma >= 100', ctx))
        self.assertEqual(avaliar('abs(3 - 10)', ctx), 7)
        self.assertEqual(avaliar('', ctx), 0)

    def test_bloqueia_atributos_e_dunder(self):
        from .regra_engine import avaliar, ExpressaoInvalida
        ctx = self.ctx()
        for expr in [
            "x.__class__",
            "().__class__.__bases__",
            "__import__('os')",
            "open('/etc/passwd')",
            "nome.upper()",
            "lambda: 1",
        ]:
            with self.assertRaises(ExpressaoInvalida, msg=expr):
                avaliar(expr, ctx)

    def test_bloqueia_variavel_fora_do_whitelist(self):
        from .regra_engine import avaliar, ExpressaoInvalida
        with self.assertRaises(ExpressaoInvalida):
            avaliar('variavel_secreta == 1', self.ctx())

    def test_bloqueia_sintaxe_invalida(self):
        from .regra_engine import avaliar, ExpressaoInvalida
        with self.assertRaises(ExpressaoInvalida):
            avaliar('x >>>', self.ctx())


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class RegraEngineTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Engine', nif='5000000040')
        self.emp.save()

    def test_regra_por_validar_nao_gera_ocorrencia(self):
        from .regra_engine import executar
        documento_upload(self.emp, tipo='BALANCETE')
        resumo = executar(self.emp, 2026, 7)
        self.assertEqual(resumo['ocorrencias_criadas'], 0)
        self.assertEqual(resumo['regras_avaliadas'], 0)
        self.assertEqual(Ocorrencia.objects.count(), 0)

    def test_regra_validada_gera_ocorrencia_com_evidencia_completa(self):
        from .regra_engine import executar
        from .models import Regra
        documento_upload(self.emp, tipo='BALANCETE')
        Regra.objects.filter(codigo='IVA-001').update(estado_validacao='VALIDADA')
        resumo = executar(self.emp, 2026, 7)
        self.assertEqual(resumo['ocorrencias_criadas'], 1)
        occ = Ocorrencia.objects.get()
        self.assertEqual(occ.regra.codigo, 'IVA-001')
        self.assertEqual(occ.severidade, 'ALTO')
        for chave in Ocorrencia.EVIDENCIA_OBRIGATORIA:
            self.assertIn(chave, occ.evidencia, chave)
        self.assertTrue(occ.evidencia['requer_validacao_juridica'])
        self.assertIn('requer validação jurídica',
                      occ.evidencia['referencia_legal'])
        self.assertTrue(occ.evidencia['fontes'])

    def test_executar_e_idempotente(self):
        from .regra_engine import executar
        from .models import Regra
        documento_upload(self.emp, tipo='BALANCETE')
        Regra.objects.filter(codigo='IVA-001').update(estado_validacao='VALIDADA')
        executar(self.emp, 2026, 7)
        resumo = executar(self.emp, 2026, 7)
        self.assertEqual(resumo['ocorrencias_criadas'], 0)
        self.assertEqual(resumo['ocorrencias_actualizadas'], 1)
        self.assertEqual(Ocorrencia.objects.count(), 1)

    def test_sem_balancete_nao_dispara_iva001(self):
        from .regra_engine import executar
        from .models import Regra
        Regra.objects.filter(codigo='IVA-001').update(estado_validacao='VALIDADA')
        executar(self.emp, 2026, 7)
        self.assertEqual(Ocorrencia.objects.count(), 0)

    def test_com_balancete_e_modelo7_nao_dispara_iva001(self):
        from .regra_engine import executar
        from .models import Regra
        documento_upload(self.emp, tipo='BALANCETE')
        DeclaracaoAGT.objects.create(
            empresa=self.emp, ano=2026, mes=7, nif='5000000040',
            regime_iva='Geral', iva_liquidado=100, iva_dedutivel=40,
            iva_apurado=60, iva_pagar=60,
        )
        Regra.objects.filter(codigo='IVA-001').update(estado_validacao='VALIDADA')
        executar(self.emp, 2026, 7)
        self.assertEqual(Ocorrencia.objects.count(), 0)

    def test_base_legal_fora_de_vigencia_nao_executa(self):
        from .regra_engine import executar
        from .models import Regra
        from datetime import date
        documento_upload(self.emp, tipo='BALANCETE')
        regra = Regra.objects.get(codigo='IVA-001')
        regra.estado_validacao = 'VALIDADA'
        regra.base_legal.vigencia_inicio = date(2030, 1, 1)
        regra.base_legal.save()
        regra.save()
        resumo = executar(self.emp, 2026, 7)
        self.assertEqual(resumo['ocorrencias_criadas'], 0)
        self.assertEqual(resumo['regras_avaliadas'], 0)

    def test_iva003_incoerencia_detectada(self):
        from .regra_engine import executar
        from .models import Regra
        DeclaracaoAGT.objects.create(
            empresa=self.emp, ano=2026, mes=7, nif='5000000040',
            regime_iva='Geral', iva_liquidado=100, iva_dedutivel=40,
            iva_apurado=999, iva_pagar=999,
        )
        Regra.objects.filter(codigo='IVA-003').update(estado_validacao='VALIDADA')
        resumo = executar(self.emp, 2026, 7)
        self.assertEqual(resumo['ocorrencias_criadas'], 1)
        occ = Ocorrencia.objects.get(regra__codigo='IVA-003')
        self.assertEqual(occ.valor_envolvido.quantize(Decimal('0.01')),
                         Decimal('939.00'))


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class OcorrenciaModelTests(TestCase):

    def test_evidencia_incompleta_rejeitada(self):
        from .models import BaseLegal, Empresa as Emp, Motor, Ocorrencia, Regra
        from django.core.exceptions import ValidationError as VE
        from .motores_seed import semear_motores
        semear_motores()
        emp = empresa_valida(nif='5000000050')
        emp.save()
        base = BaseLegal.objects.create(legislacao='L', artigo='A')
        regra = Regra.objects.create(
            codigo='X-001', motor=Motor.objects.get(codigo='M1'),
            imposto='IVA', nome='n', condicao='1 == 1', base_legal=base,
        )
        occ = Ocorrencia(
            empresa=emp, ano=2026, mes=7, regra=regra, severidade='BAIXO',
            evidencia={'fontes': []},
        )
        with self.assertRaises(VE) as ctx:
            occ.save()
        self.assertIn('evidencia', ctx.exception.error_dict)

    def test_evidencia_completa_grava(self):
        from .models import BaseLegal, Motor, Ocorrencia, Regra
        from .motores_seed import semear_motores
        semear_motores()
        emp = empresa_valida(nif='5000000051')
        emp.save()
        base = BaseLegal.objects.create(legislacao='L', artigo='A')
        regra = Regra.objects.create(
            codigo='X-002', motor=Motor.objects.get(codigo='M1'),
            imposto='IVA', nome='n', condicao='1 == 1', base_legal=base,
        )
        Ocorrencia.objects.create(
            empresa=emp, ano=2026, mes=7, regra=regra, severidade='BAIXO',
            evidencia={
                'fontes': [], 'valores': {}, 'calculo': 'x',
                'diferenca': '0.00', 'referencia_legal': 'L A',
            },
        )
        self.assertEqual(Ocorrencia.objects.count(), 1)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class SeedRegrasTests(TestCase):

    def test_seed_idempotente_e_conservador(self):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras, REGRAS, _BASES
        from .models import BaseLegal, Regra
        semear_motores()
        semear_regras()
        semear_regras()
        self.assertEqual(Regra.objects.count(), len(REGRAS))
        self.assertEqual(BaseLegal.objects.count(), len(_BASES))
        for regra in Regra.objects.all():
            self.assertEqual(regra.estado_validacao, 'POR_VALIDAR')
            self.assertFalse(regra.base_legal.validado_juridicamente)

    def test_sem_vocabulario_proibido(self):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        from .models import BaseLegal, Regra
        semear_motores()
        semear_regras()
        proibidos = ['fraude', 'multa definitiva', 'multa de']
        textos = []
        for regra in Regra.objects.all():
            textos += [regra.nome, regra.descricao, regra.recomendacao]
        for base in BaseLegal.objects.all():
            textos += [base.legislacao, base.artigo, base.texto]
        for texto in textos:
            for proibido in proibidos:
                self.assertNotIn(
                    proibido, texto.lower(),
                    f'Vocabulário proibido "{proibido}" em: {texto}',
                )


def _evidencia_completa():
    return {
        'fontes': [{'tipo': 'DOCUMENTO', 'id': 1, 'nome': 'x.pdf'}],
        'valores': {'tem_balancete': '1'},
        'calculo': 'Sem fórmula (valor envolvido: 0.00)',
        'diferenca': '0.00',
        'referencia_legal': 'L — A (requer validação jurídica)',
    }


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class OcorrenciaAPITests(TestCase):

    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()
        call_command('criar_grupos')

    def setUp(self):
        from .models import Regra
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.emp_b = empresa_valida(nome='Empresa B', nif='5000000020')
        self.emp_b.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.carlos = User.objects.create_user('carlos', password='pw')
        from django.contrib.auth.models import Group
        self.carlos.groups.add(Group.objects.get(name='Auditor'))
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.carlos, perfil_acesso='AUDITOR'
        )
        self.consulta = User.objects.create_user('consulta', password='pw')
        self.consulta.groups.add(Group.objects.get(name='Consulta'))
        EmpresaUtilizador.objects.create(
            empresa=self.emp_a, utilizador=self.consulta, perfil_acesso='AUDITOR'
        )
        self.regra = Regra.objects.get(codigo='IVA-001')

    def criar_ocorrencia(self, emp, **kwargs):
        dados = {
            'empresa': emp, 'ano': 2026, 'mes': 7, 'regra': self.regra,
            'severidade': 'ALTO', 'evidencia': _evidencia_completa(),
        }
        dados.update(kwargs)
        return Ocorrencia.objects.create(**dados)

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_sem_token_devolve_401(self):
        resp = self.client.get('/api/ocorrencias/')
        self.assertEqual(resp.status_code, 401)

    def test_listar_mostra_somente_empresas_acessiveis(self):
        self.criar_ocorrencia(self.emp_a)
        occ_b = self.criar_ocorrencia(self.emp_b)
        self.autenticar(self.carlos)
        resp = self.client.get('/api/ocorrencias/')
        self.assertEqual(resp.status_code, 200)
        ids = [o['id'] for o in resp.data]
        self.assertNotIn(occ_b.id, ids)
        self.assertEqual(len(ids), 1)

    def test_listar_filtros(self):
        self.criar_ocorrencia(self.emp_a, severidade='ALTO')
        self.criar_ocorrencia(
            self.emp_a, mes=6, severidade='BAIXO', estado='REVISADA'
        )
        self.autenticar(self.superuser)
        resp = self.client.get('/api/ocorrencias/', {'severidade': 'BAIXO'})
        self.assertEqual(len(resp.data), 1)
        resp = self.client.get('/api/ocorrencias/', {'mes': 7})
        self.assertEqual(len(resp.data), 1)
        resp = self.client.get('/api/ocorrencias/', {'estado': 'REVISADA'})
        self.assertEqual(len(resp.data), 1)

    def test_detalhe_inclui_evidencia_e_regra(self):
        occ = self.criar_ocorrencia(self.emp_a)
        self.autenticar(self.superuser)
        resp = self.client.get(f'/api/ocorrencias/{occ.id}/')
        self.assertEqual(resp.status_code, 200)
        for chave in Ocorrencia.EVIDENCIA_OBRIGATORIA:
            self.assertIn(chave, resp.data['evidencia'])
        self.assertEqual(resp.data['regra']['codigo'], 'IVA-001')
        self.assertEqual(resp.data['regra']['estado_validacao'], 'POR_VALIDAR')
        self.assertIn('legislacao', resp.data['regra']['base_legal'])
        self.assertIn('condicao', resp.data['regra'])

    def test_detalhe_deoutra_empresa_devolve_404(self):
        occ = self.criar_ocorrencia(self.emp_b)
        self.autenticar(self.carlos)
        resp = self.client.get(f'/api/ocorrencias/{occ.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_pacth_estado_revisada(self):
        from django.contrib.auth.models import Permission
        occ = self.criar_ocorrencia(self.emp_a)
        self.carlos.user_permissions.add(
            Permission.objects.get(codename='change_ocorrencia')
        )
        self.autenticar(self.carlos)
        resp = self.client.patch(
            f'/api/ocorrencias/{occ.id}/', {'estado': 'REVISADA'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['estado'], 'REVISADA')
        self.assertEqual(resp.data['revisado_por'], 'carlos')
        occ.refresh_from_db()
        self.assertEqual(occ.estado, 'REVISADA')

    def test_pacth_estado_sem_permissao_devolve_403(self):
        occ = self.criar_ocorrencia(self.emp_a)
        self.autenticar(self.consulta)
        resp = self.client.patch(
            f'/api/ocorrencias/{occ.id}/', {'estado': 'IGNORADA'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_pacth_estado_invalido_devolve_400(self):
        occ = self.criar_ocorrencia(self.emp_a)
        self.autenticar(self.superuser)
        resp = self.client.patch(
            f'/api/ocorrencias/{occ.id}/', {'estado': 'QUALQUER'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_executar_com_sucesso(self):
        documento_upload(self.emp_a, tipo='BALANCETE')
        self.autenticar(self.superuser)
        resp = self.client.post(
            '/api/ocorrencias/executar/',
            {'empresa': self.emp_a.pk, 'ano': 2026, 'mes': 7},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        # regras todas POR_VALIDAR → nada executado, mas fluxo válido
        self.assertEqual(resp.data['ocorrencias_criadas'], 0)
        self.assertEqual(resp.data['regras_avaliadas'], 0)

    def test_executar_valida_gera_ocorrencia(self):
        from .models import Regra
        documento_upload(self.emp_a, tipo='BALANCETE')
        Regra.objects.filter(codigo='IVA-001').update(
            estado_validacao='VALIDADA'
        )
        self.autenticar(self.carlos)  # Auditor tem add_ocorrencia
        resp = self.client.post(
            '/api/ocorrencias/executar/',
            {'empresa': self.emp_a.pk, 'ano': 2026, 'mes': 7},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['ocorrencias_criadas'], 1)

    def test_executar_sem_permissao_devolve_403(self):
        self.autenticar(self.consulta)
        resp = self.client.post(
            '/api/ocorrencias/executar/',
            {'empresa': self.emp_a.pk, 'ano': 2026, 'mes': 7},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_executar_params_invalidos(self):
        self.autenticar(self.superuser)
        resp = self.client.post(
            '/api/ocorrencias/executar/', {'empresa': self.emp_a.pk},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post(
            '/api/ocorrencias/executar/',
            {'empresa': 999, 'ano': 2026, 'mes': 7}, format='json',
        )
        self.assertEqual(resp.status_code, 404)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class RegraAPITests(TestCase):

    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()
        call_command('criar_grupos')

    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.consulta = User.objects.create_user('consulta', password='pw')
        from django.contrib.auth.models import Group
        self.consulta.groups.add(Group.objects.get(name='Consulta'))

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_listar_regras(self):
        from .regras_seed import REGRAS
        self.autenticar(self.superuser)
        resp = self.client.get('/api/regras/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), len(REGRAS))
        codigos = [r['codigo'] for r in resp.data]
        self.assertIn('IVA-001', codigos)
        for regra in resp.data:
            self.assertEqual(regra['estado_validacao'], 'POR_VALIDAR')
            self.assertIn('condicao', regra)
            self.assertIn('base_legal', regra)

    def test_filtro_estado(self):
        self.autenticar(self.superuser)
        resp = self.client.get('/api/regras/', {'estado': 'VALIDADA'})
        self.assertEqual(resp.data, [])

    def test_validar_regra(self):
        from .models import Regra
        regra = Regra.objects.get(codigo='IVA-002')
        self.autenticar(self.superuser)
        resp = self.client.patch(
            f'/api/regras/{regra.pk}/',
            {'estado_validacao': 'VALIDADA', 'nota': 'Conferido'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['estado_validacao'], 'VALIDADA')
        self.assertEqual(resp.data['validado_por'], 'root')
        regra.refresh_from_db()
        self.assertEqual(regra.estado_validacao, 'VALIDADA')
        self.assertEqual(regra.validacao_nota, 'Conferido')

    def test_validar_sem_permissao_devolve_403(self):
        from .models import Regra
        regra = Regra.objects.get(codigo='IVA-002')
        self.autenticar(self.consulta)
        resp = self.client.patch(
            f'/api/regras/{regra.pk}/', {'estado_validacao': 'VALIDADA'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_estado_invalido_devolve_400(self):
        from .models import Regra
        regra = Regra.objects.get(codigo='IVA-002')
        self.autenticar(self.superuser)
        resp = self.client.patch(
            f'/api/regras/{regra.pk}/', {'estado_validacao': 'QUALQUER'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class UploadDuplicadoTests(TestCase):
    """Nenhum documento do mesmo tipo pode ser subido 2x no mesmo ano/mês."""

    def setUp(self):
        self.client = APIClient()
        self.emp_a = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp_a.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def upload(self, **extras):
        dados = {
            'arquivo': SimpleUploadedFile('balancete.pdf', PDF_FALSO),
            'tipo': 'BALANCETE',
            'empresa_id': self.emp_a.pk,
            'ano': 2026,
            'mes': 7,
        }
        for chave, valor in extras.items():
            if valor is None:
                dados.pop(chave, None)
            else:
                dados[chave] = valor
        return self.client.post('/api/documentos/upload/', dados, format='multipart')

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete Julho')
    def test_tipo_repetido_no_mesmo_periodo_devolve_409(self, _mock):
        self.autenticar(self.superuser)
        self.assertEqual(self.upload().status_code, 200)
        resp = self.upload()
        self.assertEqual(resp.status_code, 409)
        self.assertIn('Já existe', str(resp.data))
        self.assertEqual(
            DocumentoUpload.objects.filter(
                empresa=self.emp_a, ano=2026, mes=7, tipo='BALANCETE'
            ).count(),
            1,
        )

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete Agosto')
    def test_outro_mes_do_mesmo_ano_e_permitido(self, _mock):
        self.autenticar(self.superuser)
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(self.upload(mes=8).status_code, 200)
        self.assertEqual(DocumentoUpload.objects.filter(empresa=self.emp_a).count(), 2)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete Modelo 7')
    def test_outro_tipo_no_mesmo_periodo_e_permitido(self, _mock):
        self.autenticar(self.superuser)
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(self.upload(tipo='MODELO7').status_code, 200)
        self.assertEqual(DocumentoUpload.objects.filter(empresa=self.emp_a).count(), 2)

    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='   ')
    def test_documento_ilegivel_nao_bloqueia_nova_tentativa(self, _mock):
        self.autenticar(self.superuser)
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(
            DocumentoUpload.objects.get(empresa=self.emp_a).estado, 'ILEGIVEL'
        )
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(DocumentoUpload.objects.filter(empresa=self.emp_a).count(), 2)

    @patch('reconciliacao.views.classificador_service.classificar',
           return_value={'tipo': 'BALANCETE', 'confianca': 1.0})
    @patch('reconciliacao.extracao_service.pdf_service.extrair_texto_pdf', return_value='Balancete')
    def test_tipo_classificado_automaticamente_tambem_bloqueia(self, _mock_txt, _mock_cls):
        self.autenticar(self.superuser)
        primeiro = self.upload(tipo=None)
        self.assertEqual(primeiro.status_code, 200)
        self.assertEqual(primeiro.data['documento']['tipo'], 'BALANCETE')

        segundo = self.upload(tipo=None)
        self.assertEqual(segundo.status_code, 409)
        self.assertIn('Já existe', str(segundo.data))
        self.assertEqual(DocumentoUpload.objects.filter(empresa=self.emp_a).count(), 1)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class DeletarDocumentoLimpaResultadosTests(TestCase):
    """Sem documentos no período não podem sobrar ocorrências/reconciliações."""

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()

    def setUp(self):
        from .models import Contabilidade, Reconciliacao, Regra
        self.client = APIClient()
        self.emp = empresa_valida(nome='Empresa A', nif='5000000010')
        self.emp.save()
        self.superuser = User.objects.create_superuser('root', 'root@x.com', 'pw')
        self.regra = Regra.objects.get(codigo='IVA-001')

        self.doc_julho = documento_upload(self.emp, ano=2026, mes=7)
        self.doc_junho = documento_upload(self.emp, ano=2026, mes=6)

        self.ocorrencia_julho = Ocorrencia.objects.create(
            empresa=self.emp, ano=2026, mes=7, regra=self.regra,
            severidade='ALTO', evidencia=_evidencia_completa(),
        )
        self.ocorrencia_junho = Ocorrencia.objects.create(
            empresa=self.emp, ano=2026, mes=6, regra=self.regra,
            severidade='ALTO', evidencia=_evidencia_completa(),
        )
        self.reconciliacao_julho = Reconciliacao.objects.create(
            empresa=self.emp, ano=2026, mes=7,
            total_campos_ok=1, total_campos_divergencia=1,
        )
        Contabilidade.objects.create(
            empresa=self.emp, ano=2026, mes=7, conta_codigo='4511',
            conta_descricao='Caixa', valor_debito=100, valor_credito=0,
        )
        DeclaracaoAGT.objects.create(
            empresa=self.emp, ano=2026, mes=7, nif='5000000010',
            regime_iva='Geral', iva_liquidado=100,
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def apagar(self, doc):
        return self.client.delete(f'/api/documentos/{doc.pk}/')

    def test_ultimo_documento_apaga_resultados_do_periodo(self):
        from .models import Contabilidade, Reconciliacao
        self.autenticar(self.superuser)
        self.assertEqual(self.apagar(self.doc_julho).status_code, 200)

        self.assertFalse(Ocorrencia.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())
        self.assertFalse(Reconciliacao.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())
        # dados de base (contabilidade/AGT) e outro período ficam intactos
        self.assertTrue(Contabilidade.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())
        self.assertTrue(DeclaracaoAGT.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())
        self.assertTrue(Ocorrencia.objects.filter(
            empresa=self.emp, ano=2026, mes=6).exists())

    def test_apagar_um_de_varios_documentos_mantem_resultados(self):
        from .models import Reconciliacao
        documento_upload(self.emp, tipo='MODELO7', ano=2026, mes=7)
        self.autenticar(self.superuser)
        self.assertEqual(self.apagar(self.doc_julho).status_code, 200)

        self.assertTrue(Ocorrencia.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())
        self.assertTrue(Reconciliacao.objects.filter(
            empresa=self.emp, ano=2026, mes=7).exists())

    def test_resposta_indica_resultados_limpos(self):
        self.autenticar(self.superuser)
        resp = self.apagar(self.doc_julho)
        self.assertTrue(resp.data['success'])
        self.assertEqual(resp.data['resultados_limpos']['ocorrencias'], 1)
        self.assertEqual(resp.data['resultados_limpos']['reconciliacoes'], 1)


class DossieServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()

    def setUp(self):
        self.emp = empresa_valida(nome='Cheng Yung Tung Lda', nif='5001136917')
        self.emp.save()

    def test_normalizar_contabilidade(self):
        from . import dossie_service
        from .models import Contabilidade
        c1 = Contabilidade(empresa=self.emp, ano=2026, mes=7, conta_codigo='3453', conta_descricao='IVA Liquidado', valor_credito=14000)
        c2 = Contabilidade(empresa=self.emp, ano=2026, mes=7, conta_codigo='3451', conta_descricao='IVA Suportado', valor_debito=4000)
        norm = dossie_service.normalizar_contabilidade([c1, c2])
        self.assertEqual(norm['iva_liquidado'], 14000.0)
        self.assertEqual(norm['iva_dedutivel'], 4000.0)
        self.assertEqual(norm['iva_apuramento'], 10000.0)
        self.assertEqual(norm['iva_pagar'], 10000.0)

    def test_executar_reconciliacao_automatica(self):
        from . import dossie_service
        from .models import Contabilidade, DeclaracaoAGT, Reconciliacao
        Contabilidade.objects.create(
            empresa=self.emp, ano=2026, mes=7, conta_codigo='3453', conta_descricao='IVA Liquidado', valor_credito=14000
        )
        Contabilidade.objects.create(
            empresa=self.emp, ano=2026, mes=7, conta_codigo='3451', conta_descricao='IVA Suportado', valor_debito=4000
        )
        DeclaracaoAGT.objects.create(
            empresa=self.emp, ano=2026, mes=7, nif='5001136917', razao_social='Cheng Yung Tung Lda',
            regime_iva='Regime Geral', iva_liquidado=14000, iva_dedutivel=4000, iva_apurado=10000, iva_pagar=10000
        )

        res = dossie_service.executar_reconciliacao_automatica(self.emp, 2026, 7)
        self.assertIsNotNone(res)
        self.assertEqual(res['status'], 'CONCILIADO')
        self.assertEqual(res['total_divergencia'], 0)
        self.assertTrue(Reconciliacao.objects.filter(empresa=self.emp, ano=2026, mes=7).exists())



# Excerto fiel do Comprovativo de Entrega da Declaração Modelo 7 de IVA tal
# como o pdfplumber o devolve: checkboxes com o `X` antes da etiqueta, NIF em
# caixas separadas e valores colados ao número do campo.
MODELO7_REAL = '''Comprovativo de Entrega de Declaração
Modelo 7 de IVA
Via Internet
Nº DECLARAÇÃO 260106946795452 DATA RECEPÇÃO 03-09-2026
01 - REGIME DO IVA 02 - DECLARAÇÃO 03 - MAPAS ANEXO 04 - NÚMERO DE IDENTIFICAÇÃO FISCAL
1 X REGIMEGERAL 1 X NOPRAZO 1 X ANEXODEFORNECEDORES
2 REGIMEDECAIXA 2 FORADOPRAZO 2 ANEXODEFORNECEDORES-SECTORPETROLÍFERO
3 X SUBSTITUIÇÃO 3 ANEXODEREGULARIZAÇÃODECLIENTES 5 0 0 2 8 3 0 2 8 0
05 - PERÍODO DA DECLARAÇÃO 06 - REPARTIÇÃO FISCAL DE DOMICILIO
2 0 2 6 0 7 Julho 2 0 . 0 1 REPARTIÇAO FISCAL DE CATETE
07 - IDENTIFICAÇÃO DO CONTRIBUINTE
1 - NOME/DESIGNAÇÃO: SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA
09 - APURAMENTO DO IMPOSTO REFERENTE AO PERÍODO A QUE RESPEITA A DECLARAÇÃO
1 Transmissão de bens e prestação de serviços em que liquidou imposto 1 9.970.794,43 2 1.395.911,22
3 Operações em que o IVA foi cativo pelo declarante (art. 21.º do CIVA) 5 0,00 6 0,00 7 0,00
7 Serviços 22 0,00 23 0,00
SOMAS 31 9.970.794,43 32 0,00 33 1.395.911,22
Se o valor inscrito no campo 33 for superiorao do campo 32, Campo 35=33-32 35 1.395.911,22
IVA : 37 1.395.911,22
Se esta declaração for apresentada fora do prazo legal, por razões imputavies ao contribuinte
'''


class AgtModelo7Tests(TestCase):
    """Leitura do Modelo 7 da AGT — os três defeitos confirmados no documento real."""

    @classmethod
    def setUpTestData(cls):
        from . import agt_modelo7
        cls.lido = agt_modelo7.parse(MODELO7_REAL)

    def test_nao_marca_fora_do_prazo_uma_declaracao_entregue_no_prazo(self):
        # "FORA DO PRAZO" é a etiqueta da checkbox: está sempre impressa.
        # Procurá-la no texto marcava TODAS as declarações como atrasadas.
        self.assertTrue(self.lido['no_prazo'])
        self.assertFalse(self.lido['fora_prazo'])

    def test_le_o_nif_impresso_em_caixas_separadas(self):
        self.assertEqual(self.lido['nif'], '5002830280')

    def test_deteta_declaracao_de_substituicao(self):
        self.assertTrue(self.lido['substituicao'])

    def test_le_numero_e_data_de_recepcao(self):
        from datetime import date
        self.assertEqual(self.lido['numero_declaracao'], '260106946795452')
        self.assertEqual(self.lido['data_recepcao'], date(2026, 9, 3))

    def test_periodo_nao_e_confundido_com_os_digitos_do_nif(self):
        self.assertEqual(self.lido['ano'], 2026)
        self.assertEqual(self.lido['mes'], 7)

    def test_reparticao_fiscal_e_a_real_nao_o_titulo_do_quadro(self):
        self.assertEqual(self.lido['reparticao_fiscal'], 'CATETE')

    def test_le_os_campos_numerados_do_quadro_9(self):
        self.assertEqual(self.lido['base_tributavel'], Decimal('9970794.43'))
        self.assertEqual(self.lido['iva_liquidado'], Decimal('1395911.22'))
        self.assertEqual(self.lido['iva_dedutivel'], Decimal('0.00'))
        self.assertEqual(self.lido['iva_pagar'], Decimal('1395911.22'))
        self.assertEqual(self.lido['campos']['23'], Decimal('0.00'))

    def test_somas_do_formulario_sao_coerentes(self):
        from . import agt_modelo7
        self.assertEqual(agt_modelo7.coerencia(self.lido), [])

    def test_deteta_soma_incoerente(self):
        from . import agt_modelo7
        texto = MODELO7_REAL.replace('IVA : 37 1.395.911,22', 'IVA : 37 999.999,99')
        problemas = agt_modelo7.coerencia(agt_modelo7.parse(texto))
        self.assertEqual([p['campo'] for p in problemas], ['37'])

    def test_checkbox_indecidivel_devolve_none_e_nao_falso(self):
        from . import agt_modelo7
        # Sem o quadro 02 no texto, o sistema não deve afirmar nada.
        self.assertIsNone(agt_modelo7.parse('texto sem quadros')['no_prazo'])

    def test_texto_vazio_nao_rebenta(self):
        from . import agt_modelo7
        lido = agt_modelo7.parse('')
        self.assertEqual(lido['base_tributavel'], Decimal('0.00'))
        self.assertIsNone(lido['nif'])


class CalendarioFiscalTests(TestCase):
    """Prazos declarativos e de pagamento — o que o sistema não sabia ver."""

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Prazos', nif='5000000090')
        self.emp.save()

    def test_prazo_do_iva_e_o_ultimo_dia_do_mes_seguinte(self):
        from datetime import date
        from . import calendario_service as cal
        self.assertEqual(cal.data_limite(2026, 7, 'ULTIMO_DIA'), date(2026, 8, 31))
        # Fevereiro e viragem de ano.
        self.assertEqual(cal.data_limite(2026, 1, 'ULTIMO_DIA'), date(2026, 2, 28))
        self.assertEqual(cal.data_limite(2026, 12, 'ULTIMO_DIA'), date(2027, 1, 31))

    def test_prazo_do_inss_e_o_dia_10(self):
        from datetime import date
        from . import calendario_service as cal
        self.assertEqual(cal.data_limite(2026, 7, 10), date(2026, 8, 10))

    def test_periodo_sem_documentos_fica_vencido_depois_do_prazo(self):
        from datetime import date
        from . import calendario_service as cal
        resumo = cal.resumo(self.emp, 2026, 7, hoje=date(2026, 10, 1))
        self.assertEqual(resumo['cumpridas'], 0)
        self.assertEqual(resumo['vencidas'], resumo['total'])

    def test_modelo7_entregue_fora_do_prazo_e_assinalado(self):
        from datetime import date
        from . import calendario_service as cal
        documento_upload(
            self.emp, tipo='MODELO7', estado='VALIDADO',
            texto_extraido=MODELO7_REAL,
        )
        resumo = cal.resumo(self.emp, 2026, 7, hoje=date(2026, 10, 1))
        declaracao = next(
            o for o in resumo['obrigacoes']
            if o['imposto'] == 'IVA' and o['tipo'] == 'DECLARACAO'
        )
        # Recebida a 03-09, limite a 31-08: três dias de atraso.
        self.assertEqual(declaracao['estado'], 'CUMPRIDA_FORA_PRAZO')
        self.assertEqual(declaracao['data_cumprimento'], '2026-09-03')
        self.assertEqual(declaracao['data_limite'], '2026-08-31')

    def test_gerar_duas_vezes_nao_duplica_obrigacoes(self):
        from . import calendario_service as cal
        from .models import ObrigacaoFiscal
        # Nem todas as obrigações do calendário existem em todos os meses: o
        # provisório do Imposto Industrial é semestral. O invariante é a
        # idempotência, não um número fixo.
        primeira = cal.gerar(self.emp, 2026, 7)
        segunda = cal.gerar(self.emp, 2026, 7)
        self.assertEqual(len(primeira), len(segunda))
        self.assertEqual(
            ObrigacaoFiscal.objects.filter(empresa=self.emp, ano=2026, mes=7).count(),
            len(primeira),
        )

    def test_prazos_nascem_por_validar_juridicamente(self):
        from . import calendario_service as cal
        resumo = cal.resumo(self.emp, 2026, 7)
        self.assertTrue(
            all(o['requer_validacao_juridica'] for o in resumo['obrigacoes'])
        )


class SegurancaSocialBaseTests(TestCase):
    """A taxa de 8% não incide sobre a conta 722 inteira (DP n.º 227/18)."""

    def setUp(self):
        from .models import Contabilidade
        self.emp = empresa_valida(nome='Empresa INSS', nif='5000000091')
        self.emp.save()
        # Caso real: subsídios isentos fazem a massa salarial bruta (4.179.721)
        # divergir da base de incidência (3.411.869).
        for codigo, descricao, debito, credito in [
            ('722', 'Remunerações', Decimal('4179721.00'), Decimal('0')),
            ('725', 'Encargos sobre remunerações', Decimal('272949.52'), Decimal('0')),
            ('3492', 'Segurança Social', Decimal('0'), Decimal('375305.59')),
        ]:
            Contabilidade.objects.create(
                empresa=self.emp, ano=2026, mes=7, conta_codigo=codigo,
                conta_descricao=descricao, valor_debito=debito,
                valor_credito=credito, saldo=credito - debito,
            )

    def contexto(self):
        from . import regra_engine
        contexto, _ = regra_engine.construir_contexto(self.emp, 2026, 7)
        return contexto

    def test_contabilidade_correcta_nao_gera_alerta(self):
        contexto = self.contexto()
        # 272.949,52 / 8% = 3.411.869,00; x 11% = 375.305,59 = conta 3492.
        self.assertEqual(contexto['base_inss_implicita'], Decimal('3411869.00'))
        self.assertEqual(contexto['inss_esperado_total'], Decimal('375305.59'))
        self.assertEqual(contexto['inss_coerente'], 1)
        self.assertEqual(contexto['inss_incoerente'], 0)

    def test_subsidios_excluidos_sao_informativos(self):
        self.assertEqual(
            self.contexto()['remuneracoes_excluidas_ss'], Decimal('767852.00')
        )

    def test_incoerencia_real_entre_8_e_3_por_cento_gera_alerta(self):
        from .models import Contabilidade
        Contabilidade.objects.filter(
            empresa=self.emp, conta_codigo='3492'
        ).update(valor_credito=Decimal('300000.00'))
        contexto = self.contexto()
        self.assertEqual(contexto['inss_incoerente'], 1)
        self.assertGreater(contexto['desvio_inss_total'], Decimal('1.00'))


class NumerosServiceTests(TestCase):
    """A auditoria dita em números: em risco, erros, OK, faltam."""

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Números', nif='5000000092')
        self.emp.save()

    def test_periodo_vazio_nao_tem_valor_em_risco(self):
        from . import numeros_service
        numeros = numeros_service.calcular(self.emp, 2026, 7)
        self.assertEqual(Decimal(numeros['em_risco']), Decimal('0.00'))
        self.assertEqual(numeros['contadores']['erros'], 0)
        self.assertGreater(numeros['contadores']['faltam'], 0)

    def test_resposta_traz_prazos_e_cobertura_juntos(self):
        from . import numeros_service
        numeros = numeros_service.calcular(self.emp, 2026, 7)
        # A página de Auditoria faz um pedido só: tudo tem de vir aqui.
        for chave in ('em_risco', 'contadores', 'linhas', 'prazos', 'cobertura'):
            self.assertIn(chave, numeros)
        self.assertIn('obrigacoes', numeros['prazos'])
        self.assertIn('disclaimer', numeros['cobertura'])

    def test_contador_ok_nunca_excede_as_verificacoes_que_correm(self):
        from . import numeros_service, regra_engine
        numeros = numeros_service.calcular(self.emp, 2026, 7)
        self.assertLessEqual(
            numeros['contadores']['ok'],
            regra_engine.contar_avaliaveis(self.emp, 2026, 7),
        )

    def test_regras_silenciadas_estao_documentadas(self):
        from . import regra_engine
        # Nenhuma regra deve ser silenciada sem motivo escrito.
        self.assertTrue(
            all(bool(motivo) for motivo in regra_engine.REGRAS_SILENCIADAS.values())
        )
        self.assertEqual(
            set(regra_engine.REGRAS_IGNORAR_FALTA_DOC),
            set(regra_engine.REGRAS_SILENCIADAS),
        )

    def test_agregadores_nao_contam_duas_vezes_no_valor_em_risco(self):
        """M10 e M12 resumem o que os outros motores já acharam.

        Sem esta separação, a mesma retenção em falta entrava no total uma
        vez como RET-001 e outra como EXP-001, e o número grande que a
        empresa lê no topo vinha inflacionado.
        """
        from decimal import Decimal as D
        from . import numeros_service, regra_engine
        from .models import Contabilidade, Regra

        Regra.objects.all().update(estado_validacao='VALIDADA')
        for codigo, descricao, debito, credito in [
            ('75234', 'Honorários', D('700000.00'), D('0')),
            ('3493', 'Retenção na fonte', D('0'), D('45000.00')),
        ]:
            Contabilidade.objects.create(
                empresa=self.emp, ano=2026, mes=7, conta_codigo=codigo,
                conta_descricao=descricao, valor_debito=debito,
                valor_credito=credito, saldo=credito - debito,
            )
        regra_engine.executar(self.emp, 2026, 7)
        numeros = numeros_service.calcular(self.emp, 2026, 7)

        codigos = {l['codigo'] for l in numeros['linhas']}
        self.assertIn('RET-001', codigos)
        self.assertIn('EXP-001', codigos)  # continua visível

        agregadores = [l for l in numeros['linhas'] if l['agregador']]
        self.assertTrue(agregadores, 'EXP-001 devia estar marcado como agregador')

        # O valor do topo soma só os motores de origem.
        esperado = sum(
            (D(l['valor']) for l in numeros['linhas']
             if not l['agregador'] and l['gravidade'] in numeros_service.SEVERIDADES_ERRO),
            D('0.00'),
        )
        self.assertEqual(D(numeros['em_risco']), esperado)
        self.assertNotIn(
            'EXP-001', {l['codigo'] for l in numeros['linhas'] if not l['agregador']}
        )

    def test_agregadores_aparecem_no_fim_da_lista(self):
        from decimal import Decimal as D
        from . import numeros_service, regra_engine
        from .models import Contabilidade, Regra

        Regra.objects.all().update(estado_validacao='VALIDADA')
        Contabilidade.objects.create(
            empresa=self.emp, ano=2026, mes=7, conta_codigo='75234',
            conta_descricao='Honorários', valor_debito=D('700000.00'),
            valor_credito=D('0'), saldo=D('700000.00'),
        )
        regra_engine.executar(self.emp, 2026, 7)
        linhas = numeros_service.calcular(self.emp, 2026, 7)['linhas']
        marcas = [l['agregador'] for l in linhas]
        # Uma vez que apareça um agregador, não pode voltar a haver origem.
        self.assertEqual(marcas, sorted(marcas))


class ValorDeclaradoTests(TestCase):
    """"Declarei, mas paguei?" — o valor devido vem da fonte oficial."""

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Pagar', nif='5000000093')
        self.emp.save()

    def test_iva_a_pagar_vem_do_campo_37_do_modelo7(self):
        from . import calendario_service as cal
        documento_upload(
            self.emp, tipo='MODELO7', estado='VALIDADO',
            texto_extraido=MODELO7_REAL,
        )
        resumo = cal.resumo(self.emp, 2026, 7)
        pagamento = next(
            o for o in resumo['obrigacoes']
            if o['imposto'] == 'IVA' and o['tipo'] == 'PAGAMENTO'
        )
        self.assertEqual(Decimal(pagamento['valor_declarado']), Decimal('1395911.22'))
        # Sem comprovativo de pagamento, está tudo por liquidar.
        self.assertEqual(Decimal(pagamento['em_falta']), Decimal('1395911.22'))

    def test_irt_e_inss_saem_dos_saldos_credores_da_contabilidade(self):
        from .models import Contabilidade
        from . import calendario_service as cal
        for codigo, credito in [('343', '240289.32'), ('3492', '375305.59')]:
            Contabilidade.objects.create(
                empresa=self.emp, ano=2026, mes=7, conta_codigo=codigo,
                conta_descricao=codigo, valor_debito=Decimal('0'),
                valor_credito=Decimal(credito), saldo=Decimal(credito),
            )
        resumo = cal.resumo(self.emp, 2026, 7)
        valores = {
            o['imposto']: o['valor_declarado'] for o in resumo['obrigacoes']
            if o['tipo'] == 'PAGAMENTO'
        }
        self.assertEqual(Decimal(valores['IRT']), Decimal('240289.32'))
        self.assertEqual(Decimal(valores['INSS']), Decimal('375305.59'))

    def test_sem_dados_o_valor_e_desconhecido_e_nao_zero(self):
        from . import calendario_service as cal
        resumo = cal.resumo(self.emp, 2026, 7)
        # Zero leria-se como "não há nada a pagar", que é uma afirmação
        # que o sistema não pode fazer sem documentos.
        self.assertTrue(
            all(
                o['valor_declarado'] is None for o in resumo['obrigacoes']
                if o['tipo'] == 'PAGAMENTO'
            )
        )

    def test_total_por_liquidar_soma_os_impostos_do_periodo(self):
        from . import calendario_service as cal
        documento_upload(
            self.emp, tipo='MODELO7', estado='VALIDADO',
            texto_extraido=MODELO7_REAL,
        )
        resumo = cal.resumo(self.emp, 2026, 7)
        self.assertEqual(
            Decimal(resumo['valor_por_liquidar']), Decimal('1395911.22')
        )


class TaxasTests(TestCase):
    """Tabela de taxas e regimes (§12) — a fonte única das percentagens."""

    def test_regime_sai_do_volume_de_negocios(self):
        from . import taxas
        self.assertEqual(taxas.regime_por_volume('24999999'), 'EXCLUSAO')
        self.assertEqual(taxas.regime_por_volume('25000000'), 'SIMPLIFICADO')
        self.assertEqual(taxas.regime_por_volume('349999999'), 'SIMPLIFICADO')
        self.assertEqual(taxas.regime_por_volume('350000000'), 'GERAL')
        self.assertIsNone(taxas.regime_por_volume(None))

    def test_normaliza_as_grafias_que_existiam_na_base(self):
        from . import taxas
        for grafia in ('Geral', 'Regime Geral', 'REGIME GERAL', 'normal'):
            self.assertEqual(taxas.normalizar_regime(grafia), 'GERAL')
        self.assertEqual(taxas.normalizar_regime('Isenção'), 'EXCLUSAO')
        self.assertIsNone(taxas.normalizar_regime(''))

    def test_taxa_geral_do_iva_e_14_por_cento(self):
        from . import taxas
        # 15% circula como se fosse a taxa em vigor; não é.
        self.assertEqual(taxas.CARACTERISTICAS_REGIME['GERAL']['taxa'], Decimal('0.14'))
        self.assertEqual(taxas.CARACTERISTICAS_REGIME['SIMPLIFICADO']['taxa'], Decimal('0.07'))
        self.assertIsNone(taxas.CARACTERISTICAS_REGIME['EXCLUSAO']['taxa'])

    def test_classifica_a_taxa_implicita_dos_valores_reais(self):
        from . import taxas
        # SCKJ, Julho/2026: 1.395.911,22 sobre 9.970.794,43.
        taxa = taxas.taxa_implicita('9970794.43', '1395911.22')
        self.assertEqual(taxas.classificar_taxa(taxa)['codigo'], 'NORMAL')

    def test_taxa_fora_da_tabela_nao_e_classificada(self):
        from . import taxas
        self.assertIsNone(taxas.classificar_taxa(Decimal('0.115')))

    def test_irt_segue_a_tabela_da_lei_14_25(self):
        from . import taxas
        self.assertEqual(taxas.irt_devido('150000'), Decimal('0.00'))
        self.assertEqual(taxas.irt_devido('100000'), Decimal('0.00'))
        # 2.º escalão: 12.500 + 16% sobre o que excede 150.000.
        self.assertEqual(taxas.irt_devido('180000'), Decimal('17300.00'))
        # Escalão de topo: 2.342.250 + 25% sobre o excesso de 10.000.000.
        self.assertEqual(taxas.irt_devido('12000000'), Decimal('2842250.00'))

    def test_isencao_subiu_para_150_mil(self):
        from . import taxas
        self.assertEqual(taxas.IRT_ISENCAO_MENSAL, Decimal('150000.00'))


class RegimeEmpresaTests(TestCase):
    """O regime deixou de ser texto livre."""

    def test_full_clean_aceita_as_grafias_antigas(self):
        """`full_clean()` valida os `choices` antes do `save()` normalizar.

        Sem canonizar em `clean_fields`, qualquer código que validasse uma
        empresa com a grafia antiga rebentava — incluindo o próprio sistema
        a reabrir registos gravados antes da migração.
        """
        empresa = empresa_valida(nome='Grafia Antiga', nif='5000000104',
                                 regime_iva='Geral')
        empresa.full_clean()
        self.assertEqual(empresa.regime_iva, 'GERAL')

    def test_guarda_sempre_o_codigo_canonico(self):
        empresa = empresa_valida(nome='Grafia Livre', nif='5000000100',
                                 regime_iva='Regime Geral')
        empresa.save()
        empresa.refresh_from_db()
        self.assertEqual(empresa.regime_iva, 'GERAL')

    def test_exclusao_nao_tem_obrigacoes_de_iva(self):
        empresa = empresa_valida(nome='Pequena', nif='5000000101',
                                 regime_iva='EXCLUSAO')
        empresa.save()
        self.assertFalse(empresa.tem_obrigacoes_iva)
        self.assertTrue(
            empresa_valida(nome='x', nif='y', regime_iva='GERAL').tem_obrigacoes_iva
        )

    def test_assinala_regime_que_nao_bate_com_o_volume(self):
        empresa = empresa_valida(nome='Divergente', nif='5000000102',
                                 regime_iva='GERAL')
        empresa.volume_negocios_anual = Decimal('30000000')  # devia ser simplificado
        empresa.save()
        self.assertEqual(empresa.regime_esperado, 'SIMPLIFICADO')
        self.assertTrue(empresa.regime_divergente)

    def test_sem_volume_declarado_nao_ha_divergencia(self):
        empresa = empresa_valida(nome='Sem Volume', nif='5000000103',
                                 regime_iva='GERAL')
        empresa.save()
        self.assertIsNone(empresa.regime_esperado)
        self.assertFalse(empresa.regime_divergente)


class MotoresPorRegimeTests(TestCase):
    """Motores de IVA não se aplicam a quem não tem IVA."""

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        semear_motores()

    def motores(self, regime, nif):
        from . import cobertura_service
        empresa = empresa_valida(nome=f'Empresa {regime}', nif=nif,
                                 regime_iva=regime)
        empresa.save()
        return {m.codigo for m in cobertura_service.motores_aplicaveis(empresa)}

    def test_exclusao_nao_recebe_os_motores_de_iva(self):
        codigos = self.motores('EXCLUSAO', '5000000110')
        self.assertNotIn('M1', codigos)
        self.assertNotIn('M9', codigos)
        # Os restantes continuam: IRT, INSS e caixa não dependem do IVA.
        self.assertIn('M2', codigos)
        self.assertIn('M8', codigos)

    def test_geral_e_simplificado_recebem_todos(self):
        self.assertIn('M1', self.motores('GERAL', '5000000111'))
        self.assertIn('M1', self.motores('SIMPLIFICADO', '5000000112'))

    def test_cobertura_de_quem_esta_excluido_nao_pede_modelo7(self):
        from . import cobertura_service
        empresa = empresa_valida(nome='Excluída', nif='5000000113',
                                 regime_iva='EXCLUSAO')
        empresa.save()
        cobertura = cobertura_service.calcular(empresa, 2026, 7)
        self.assertNotIn(
            'MODELO7', [d['tipo'] for d in cobertura['documentos_em_falta']]
        )


class ImpostoProvisorioTests(TestCase):
    """Liquidação provisória do Imposto Industrial: 2% em Agosto."""

    def setUp(self):
        self.emp = empresa_valida(nome='Empresa Provisório', nif='5000000120',
                                  regime_iva='GERAL')
        self.emp.save()

    def test_vence_no_ultimo_dia_util_de_agosto(self):
        from datetime import date
        from . import calendario_service as cal
        self.assertEqual(
            cal.data_limite(2026, 6, 'AGOSTO_ULTIMO_DIA_UTIL'), date(2026, 8, 31)
        )
        # 31/08/2030 cai a um sábado: recua para sexta.
        self.assertEqual(
            cal.data_limite(2030, 6, 'AGOSTO_ULTIMO_DIA_UTIL'), date(2030, 8, 30)
        )

    def test_so_nasce_no_fecho_do_primeiro_semestre(self):
        from . import calendario_service as cal
        junho = {o['imposto'] for o in cal.resumo(self.emp, 2026, 6)['obrigacoes']}
        julho = {o['imposto'] for o in cal.resumo(self.emp, 2026, 7)['obrigacoes']}
        self.assertIn('II_PROVISORIO', junho)
        self.assertNotIn('II_PROVISORIO', julho)

    def test_nao_se_aplica_fora_do_regime_geral(self):
        from . import calendario_service as cal
        pequena = empresa_valida(nome='Pequena', nif='5000000121',
                                 regime_iva='SIMPLIFICADO')
        pequena.save()
        impostos = {o['imposto'] for o in cal.resumo(pequena, 2026, 6)['obrigacoes']}
        self.assertNotIn('II_PROVISORIO', impostos)

    def test_valor_e_2_por_cento_das_vendas_do_semestre(self):
        from .models import Contabilidade
        from . import calendario_service as cal
        for mes in range(1, 7):
            Contabilidade.objects.create(
                empresa=self.emp, ano=2026, mes=mes, conta_codigo='62',
                conta_descricao='Prestações de serviço',
                valor_debito=Decimal('0'), valor_credito=Decimal('1000000.00'),
                saldo=Decimal('-1000000.00'),
            )
        obrigacao = next(
            o for o in cal.resumo(self.emp, 2026, 6)['obrigacoes']
            if o['imposto'] == 'II_PROVISORIO'
        )
        # 6 x 1.000.000 = 6.000.000; 2% = 120.000.
        self.assertEqual(Decimal(obrigacao['valor_declarado']), Decimal('120000.00'))

    def test_semestre_incompleto_nao_arrisca_um_valor(self):
        from .models import Contabilidade
        from . import calendario_service as cal
        for mes in (1, 2, 3):
            Contabilidade.objects.create(
                empresa=self.emp, ano=2026, mes=mes, conta_codigo='62',
                conta_descricao='Prestações de serviço',
                valor_debito=Decimal('0'), valor_credito=Decimal('1000000.00'),
                saldo=Decimal('-1000000.00'),
            )
        obrigacao = next(
            o for o in cal.resumo(self.emp, 2026, 6)['obrigacoes']
            if o['imposto'] == 'II_PROVISORIO'
        )
        self.assertIsNone(obrigacao['valor_declarado'])


class TaxaIvaRegrasTests(TestCase):
    """Regras novas sobre taxas e enquadramento."""

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        from .regras_seed import semear_regras
        semear_motores()
        semear_regras()

    def contexto(self, empresa):
        from . import regra_engine
        contexto, _ = regra_engine.construir_contexto(empresa, 2026, 7)
        return contexto

    def vendas(self, empresa, valor):
        """Volume de negócios no balancete — base observada para a taxa."""
        from .models import Contabilidade
        Contabilidade.objects.create(
            empresa=empresa, ano=2026, mes=7, conta_codigo='62',
            conta_descricao='Prestações de serviço',
            valor_debito=Decimal('0'), valor_credito=Decimal(valor),
            saldo=-Decimal(valor),
        )

    def declaracao(self, empresa, base, imposto):
        from .models import DeclaracaoAGT
        DeclaracaoAGT.objects.create(
            empresa=empresa, ano=2026, mes=7, nif=empresa.nif,
            regime_iva=empresa.regime_iva, iva_liquidado=Decimal(imposto),
            iva_dedutivel=Decimal('0'), iva_apurado=Decimal(imposto),
        )

    def test_taxa_de_14_por_cento_e_reconhecida(self):
        empresa = empresa_valida(nome='Normal', nif='5000000130', regime_iva='GERAL')
        empresa.save()
        self.vendas(empresa, '9970794.43')
        self.declaracao(empresa, '9970794.43', '1395911.22')
        contexto = self.contexto(empresa)
        self.assertEqual(contexto['taxa_iva_reconhecida'], 1)
        self.assertEqual(contexto['taxa_iva_desconhecida'], 0)
        self.assertEqual(contexto['taxa_diverge_do_regime'], 0)

    def test_taxa_fora_da_tabela_e_assinalada(self):
        empresa = empresa_valida(nome='Taxa Estranha', nif='5000000131',
                                 regime_iva='GERAL')
        empresa.save()
        # 11,5% não existe no Código do IVA. A base tem de vir de uma fonte
        # observada — aqui, o volume de negócios do balancete.
        self.vendas(empresa, '1000000.00')
        self.declaracao(empresa, '1000000.00', '115000.00')
        self.assertEqual(self.contexto(empresa)['taxa_iva_desconhecida'], 1)

    def test_simplificado_a_liquidar_14_por_cento_diverge_do_regime(self):
        empresa = empresa_valida(nome='Simplificado', nif='5000000132',
                                 regime_iva='SIMPLIFICADO')
        empresa.save()
        self.vendas(empresa, '1000000.00')
        self.declaracao(empresa, '1000000.00', '140000.00')
        contexto = self.contexto(empresa)
        self.assertEqual(contexto['taxa_diverge_do_regime'], 1)
        # 14% em vez de 7% sobre 1.000.000 = 70.000 de diferença.
        self.assertEqual(contexto['diferenca_taxa_regime'], Decimal('70000.00'))

    def test_excluido_que_liquida_iva_e_alertado(self):
        empresa = empresa_valida(nome='Excluída', nif='5000000133',
                                 regime_iva='EXCLUSAO')
        empresa.save()
        self.declaracao(empresa, '1000000.00', '140000.00')
        contexto = self.contexto(empresa)
        self.assertEqual(contexto['sem_obrigacoes_iva'], 1)
        self.assertEqual(contexto['liquidou_iva_sem_obrigacao'], 1)

    def test_regime_divergente_do_volume_entra_no_contexto(self):
        empresa = empresa_valida(nome='Divergente', nif='5000000134',
                                 regime_iva='GERAL')
        empresa.volume_negocios_anual = Decimal('30000000')
        empresa.save()
        self.assertEqual(self.contexto(empresa)['regime_divergente'], 1)

    def test_todas_as_regras_activas_tem_linguagem_simples(self):
        from . import numeros_service, regra_engine
        from .models import Regra
        activas = Regra.objects.exclude(
            codigo__in=regra_engine.REGRAS_SILENCIADAS
        ).values_list('codigo', flat=True)
        sem_apresentacao = [
            c for c in activas if c not in numeros_service.APRESENTACAO
        ]
        self.assertEqual(sem_apresentacao, [])

    def test_sem_declaracao_nao_se_avalia_a_taxa(self):
        """Período sem Modelo 7 não gera alerta de "taxa errada".

        Sem declaração o imposto liquidado é zero, o que daria taxa de 0% e
        um alerta de taxa divergente por cima de um período cujo verdadeiro
        problema — não haver declaração — já é dito pela IVA-001.
        """
        empresa = empresa_valida(nome='Sem Modelo 7', nif='5000000135',
                                 regime_iva='GERAL')
        empresa.save()
        self.vendas(empresa, '9970794.42')  # há facturação no balancete
        contexto = self.contexto(empresa)
        self.assertEqual(contexto['taxa_iva_desconhecida'], 0)
        self.assertEqual(contexto['taxa_diverge_do_regime'], 0)

    def test_desenquadramento_nao_conta_como_dinheiro_em_risco(self):
        """O volume de negócios é contexto, não exposição.

        Somá-lo ao valor do topo punha 120 milhões "em risco" por causa de
        um enquadramento a confirmar.
        """
        from decimal import Decimal as D
        from . import numeros_service, regra_engine
        from .models import Regra

        Regra.objects.all().update(estado_validacao='VALIDADA')
        empresa = empresa_valida(nome='Desenquadrada', nif='5000000136',
                                 regime_iva='GERAL')
        empresa.volume_negocios_anual = D('120000000')
        empresa.save()
        regra_engine.executar(empresa, 2026, 7)
        numeros = numeros_service.calcular(empresa, 2026, 7)

        linha = next(
            (l for l in numeros['linhas'] if l['codigo'] == 'IVA-011'), None
        )
        self.assertIsNotNone(linha, 'IVA-011 devia ter disparado')
        self.assertEqual(D(linha['valor']), D('0.00'))
        self.assertEqual(linha['tem'], '120000000.00')  # contexto, não risco
        self.assertLess(D(numeros['em_risco']), D('1000000'))




class BaseLegalIRTTests(TestCase):
    """A citação legal do IRT acompanha a Lei n.º 14/25."""

    @classmethod
    def setUpTestData(cls):
        from .motores_seed import semear_motores
        semear_motores()

    def test_seed_cita_a_lei_em_vigor(self):
        from .regras_seed import semear_regras
        from .models import BaseLegal
        semear_regras()
        irt = BaseLegal.objects.filter(legislacao__icontains='IRT')
        self.assertTrue(irt.exists())
        for base in irt:
            self.assertIn('14/25', base.legislacao)

    def test_nenhuma_base_nasce_validada(self):
        from .regras_seed import semear_regras
        from .models import BaseLegal
        semear_regras()
        self.assertFalse(
            BaseLegal.objects.filter(validado_juridicamente=True).exists()
        )


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class AuditoriaTraceEParecerAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.empresa = Empresa.objects.create(
            nome='Empresa Teste Auditoria',
            nif='5000000001',
            regime_iva='GERAL',
        )
        self.user = User.objects.create_superuser(
            username='auditor_chefe',
            email='auditor@empresa.ao',
            password='password123',
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_rasto_retorna_200_com_fases_e_passos(self):
        resp = self.client.get(
            f'/api/auditoria/{self.empresa.pk}/2026/7/rasto/'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('fases', resp.data)
        self.assertIn('passos', resp.data)
        self.assertEqual(len(resp.data['fases']), 6)
        codigos_fases = [f['codigo'] for f in resp.data['fases']]
        self.assertIn('LEITURA', codigos_fases)
        self.assertIn('ESCRITURACAO', codigos_fases)
        self.assertIn('DECLARACAO', codigos_fases)
        self.assertIn('REGRAS', codigos_fases)
        self.assertIn('PRAZOS', codigos_fases)
        self.assertIn('RISCO', codigos_fases)

    def test_parecer_retorna_200_com_parecer_e_riscos(self):
        resp = self.client.get(
            f'/api/auditoria/{self.empresa.pk}/2026/7/parecer/'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('parecer', resp.data)
        self.assertIn('riscos', resp.data)
        self.assertIn('texto', resp.data['parecer'])
        self.assertIn('texto', resp.data['riscos'])
        self.assertIn(resp.data['parecer']['origem'], ('IA', 'DETERMINISTICO'))
        self.assertIn(resp.data['riscos']['origem'], ('IA', 'DETERMINISTICO'))

    def test_rasto_periodo_invalido_retorna_400(self):
        resp = self.client.get(
            f'/api/auditoria/{self.empresa.pk}/2026/15/rasto/'
        )
        self.assertEqual(resp.status_code, 400)


@override_settings(MEDIA_ROOT=MEDIA_TESTE)
class AdminAreaAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser('admin_global', 'admin@sckj.ao', 'pw123')
        self.comum = User.objects.create_user('utilizador_empresa', password='pw')
        self.empresa = Empresa.objects.create(
            nome='Empresa do Admin',
            nif='5000000088',
            regime_iva='GERAL',
        )

    def autenticar(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_estatisticas_admin_permitidas_apenas_a_administrador(self):
        # Utilizador comum recebe 403
        self.autenticar(self.comum)
        resp = self.client.get('/api/admin/estatisticas/')
        self.assertEqual(resp.status_code, 403)

        # Admin recebe 200 com resumo e lista de empresas
        self.autenticar(self.admin)
        resp = self.client.get('/api/admin/estatisticas/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('total_empresas', resp.data)
        self.assertIn('empresas', resp.data)
        self.assertGreaterEqual(resp.data['total_empresas'], 1)

    def test_admin_pode_gerir_utilizadores(self):
        self.autenticar(self.admin)
        resp = self.client.get('/api/admin/utilizadores/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)

        # Criação de novo utilizador pelo admin
        resp = self.client.post('/api/admin/utilizadores/', {
            'username': 'novo_contabilista',
            'password': 'password12345',
            'email': 'contab@sckj.ao',
            'papel': 'Contabilista',
            'empresas_ids': [self.empresa.id],
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(username='novo_contabilista').exists())
        self.assertTrue(
            EmpresaUtilizador.objects.filter(
                empresa=self.empresa, utilizador__username='novo_contabilista'
            ).exists()
        )


class TestConsolidacaoAnual(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            nome='SCKJ LDA',
            nif='5002830280',
            regime_iva='Geral',
        )
        # Cria balancete de fecho (dezembro)
        texto_balancete = """
        61 VENDAS 0,00 50000000,00 0,00 50000000,00
        62 PRESTACOES DE SERVICOS 0,00 10000000,00 0,00 10000000,00
        75 FORNECIMENTOS E SERVICOS EXTERNOS 20000000,00 0,00 20000000,00 0,00
        34.5.3 IVA LIQUIDADO 0,00 8400000,00 0,00 8400000,00
        34.5.2 IVA DEDUTIVEL 2800000,00 0,00 2800000,00 0,00
        """
        self.doc_bal = DocumentoUpload.objects.create(
            empresa=self.empresa,
            ano=2024,
            mes=12,
            tipo='BALANCETE',
            nome_arquivo='balancete_fecho_2024.pdf',
            texto_extraido=texto_balancete,
            estado='VALIDADO',
        )

        # Cria declaração Modelo 7 para mês 1
        texto_m7 = """
        DECLARAÇÃO 2024010001
        NOME/DESIGNAÇÃO: SCKJ LDA
        5 0 0 2 8 3 0 2 8 0
        1 50000000,00
        31 50000000,00
        33 7000000,00
        32 2000000,00
        37 5000000,00
        """
        self.doc_m7 = DocumentoUpload.objects.create(
            empresa=self.empresa,
            ano=2024,
            mes=1,
            tipo='MODELO7',
            nome_arquivo='modelo7_01_2024.pdf',
            texto_extraido=texto_m7,
            estado='VALIDADO',
        )

    def test_consolidacao_anual_endpoint(self):
        resp = self.client.get(f'/api/consolidacao-anual/{self.empresa.id}/2024/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('totais_iva', resp.data)
        self.assertIn('balancete_fecho', resp.data)
        self.assertIn('confronto_anual', resp.data)
        self.assertIn('mapa_mensal', resp.data)
        self.assertEqual(len(resp.data['mapa_mensal']), 12)
        self.assertEqual(resp.data['meses_declarados_count'], 1)

    def test_consolidacao_anual_exportar_excel(self):
        resp = self.client.get(f'/api/consolidacao-anual/{self.empresa.id}/2024/exportar-excel/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertGreater(len(resp.content), 1000)

    def test_confronto_exportar_excel(self):
        analise = AnaliseIA.objects.create(
            documento_contabilidade=self.doc_bal,
            documento_agt=self.doc_m7,
            resultado="## 1. TABELA DE CONFRONTO\n| Ponto de Confronto | Balancete | AGT | Status | Diferença |\n| Volume Negócios | 50.000.000,00 Kz | 50.000.000,00 Kz | IGUAIS | 0,00 Kz |",
            status='CONCLUIDA'
        )
        resp = self.client.get(f'/api/analises/{analise.id}/exportar-excel/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertGreater(len(resp.content), 1000)

    def test_balancete_leitura_formato_excel_pipe(self):
        from . import balancete
        texto_excel = """
        [Folha: Balancete Geral]
        61 | Vendas de Mercadorias | 0.00 | 15000000.00 | 0.00 | 15000000.00
        62 | Prestacoes de Servicos | 0.00 | 5000000.00 | 0.00 | 5000000.00
        75 | Fornecimentos e Servicos | 8000000.00 | 0.00 | 8000000.00 | 0.00
        """
        linhas = balancete.extrair_linhas(texto_excel)
        self.assertEqual(len(linhas), 3)
        self.assertEqual(linhas[0]['codigo'], '61')
        self.assertEqual(linhas[0]['saldo_credito'], Decimal('15000000.00'))


class AutoCadastroEmpresaTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_contab', password='123')
        self.client.force_login(self.user)

    def test_extrair_dados_empresa_de_modelo7(self):
        from . import auto_cadastro_service
        texto_m7 = """
        Comprovativo de Entrega de Declaração Modelo 7 de IVA
        Nº DECLARAÇÃO 260106946795452 DATA RECEPÇÃO 03-09-2026
        01 - REGIME DO IVA: 1 X REGIME GERAL
        04 - NÚMERO DE IDENTIFICAÇÃO FISCAL: 5 0 0 9 8 7 6 5 4 3
        NOME/DESIGNAÇÃO: NOVA EMPRESA ANGOLA COMERCIAL, (SU), LDA
        REPARTIÇÃO FISCAL DE CATETE
        """
        dados = auto_cadastro_service.extrair_dados_empresa_do_texto(texto_m7, 'modelo7.pdf')
        self.assertEqual(dados['nif'], '5009876543')
        self.assertEqual(dados['nome'], 'NOVA EMPRESA ANGOLA COMERCIAL, (SU), LDA')
        self.assertEqual(dados['regime_iva'], 'GERAL')
        self.assertEqual(dados['provincia'], 'Ícolo e Bengo')
        self.assertEqual(dados['municipio'], 'Catete (Ícolo e Bengo)')

    def test_auto_cadastro_ao_detetar_documento_novo(self):
        from . import auto_cadastro_service
        texto_doc = """
        SCKJ TECNOLOGIA E SERVICOS, LDA
        NIF: 5005554443
        Balancete Geral (Julho) - 2026
        Valores em AKZ
        """
        dados = auto_cadastro_service.extrair_dados_empresa_do_texto(texto_doc, 'balancete.pdf')
        empresa, criada, msg = auto_cadastro_service.obter_ou_cadastrar_empresa_automatica(
            dados, user=self.user, auto_criar=True
        )
        self.assertTrue(criada)
        self.assertIsNotNone(empresa)
        self.assertEqual(empresa.nif, '5005554443')
        self.assertEqual(empresa.nome, 'SCKJ TECNOLOGIA E SERVICOS, LDA')
        self.assertEqual(empresa.estado, 'ATIVA')

        # Se chamar de novo para a mesma empresa, não cria duplicado
        empresa2, criada2, _ = auto_cadastro_service.obter_ou_cadastrar_empresa_automatica(
            dados, user=self.user, auto_criar=True
        )
        self.assertFalse(criada2)
        self.assertEqual(empresa2.id, empresa.id)




