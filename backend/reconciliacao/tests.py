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

    def test_escrita_removida_da_api(self):
        self.autenticar(self.superuser)
        resp = self.client.post('/api/empresas/', {
            'nome': 'Nova', 'nif': '5000000099', 'regime_iva': 'Geral',
        }, format='json')
        self.assertEqual(resp.status_code, 405)

        resp = self.client.put(f'/api/empresas/{self.emp_a.pk}/', {
            'nome': 'Alterada', 'nif': '5000000010', 'regime_iva': 'Geral',
        }, format='json')
        self.assertEqual(resp.status_code, 405)

        resp = self.client.delete(f'/api/empresas/{self.emp_a.pk}/')
        self.assertEqual(resp.status_code, 405)

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
    dados = {
        'empresa': empresa,
        'ano': 2026,
        'mes': 7,
        'tipo': tipo,
        'estado': 'VALIDADO',
        'nome_arquivo': 'teste.pdf',
        'texto_extraido': 'texto de teste',
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
            'arquivo': SimpleUploadedFile('teste.pdf', PDF_FALSO),
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

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='Balancete Julho 2026')
    def test_upload_sem_empresa_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(empresa_id=None)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('empresa_id', str(resp.data))

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_sem_periodo_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(ano=None, mes=None)
        self.assertEqual(resp.status_code, 400)

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_periodo_invalido_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(ano=1800, mes=13)
        self.assertEqual(resp.status_code, 400)

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_tipo_desconhecido_rejeitado(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload(tipo='QUALQUER')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('tipo', str(resp.data))

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_sem_permissao_devolve_403(self, _mock):
        self.autenticar(self.carlos)
        resp = self.upload()
        self.assertEqual(resp.status_code, 403)

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='texto')
    def test_upload_empresa_inacessivel_devolve_404(self, _mock):
        from django.contrib.auth.models import Permission
        perm = Permission.objects.get(codename='add_documentoupload')
        self.carlos.user_permissions.add(perm)
        self.autenticar(self.carlos)
        resp = self.upload(empresa_id=self.emp_b.pk)
        self.assertEqual(resp.status_code, 404)

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='Balancete Julho')
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

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf', return_value='   ')
    def test_upload_sem_texto_fica_ilegivel(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload()
        self.assertEqual(resp.status_code, 200)
        doc = DocumentoUpload.objects.get(pk=resp.data['documento']['id'])
        self.assertEqual(doc.estado, 'ILEGIVEL')

    @patch('reconciliacao.views.pdf_service.extrair_texto_pdf',
           return_value='Erro ao extrair texto: ficheiro corrompido')
    def test_upload_erro_extraccao_fica_erro(self, _mock):
        self.autenticar(self.superuser)
        resp = self.upload()
        self.assertEqual(resp.status_code, 200)
        doc = DocumentoUpload.objects.get(pk=resp.data['documento']['id'])
        self.assertEqual(doc.estado, 'ERRO')


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
