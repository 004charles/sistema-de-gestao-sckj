import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projeto.settings')
django.setup()

from django.contrib.auth.models import User



def seed():
    print("Criando dados iniciais...")

    # Criar usuário admin
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@email.com', 'admin123')
        print("Usuário admin criado")
    else:
        print("Usuário admin já existe")

    print("Dados iniciais criados com sucesso!")


if __name__ == '__main__':
    seed()
