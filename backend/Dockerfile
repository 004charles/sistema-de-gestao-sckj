# Dockerfile para o Backend Django (Reconciliação Fiscal Angolana)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Dependências do sistema (build-essential, libpq-dev para Postgres, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalação dos pacotes Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Cópia do código-fonte do backend
COPY . /app/

# Diretório para ficheiros estáticos e media
RUN mkdir -p /app/staticfiles /app/media

# Porta exposta
EXPOSE 8000

# Script de entrada para migrações e inicialização do Gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn projeto.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]
