# Sistema de Reconciliação Contabilística e Fiscal

## Deploy no Vercel (Frontend) e Render (Backend)

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Conta no [Render](https://render.com)
- Chave de API Groq

### 1. Configurar o Backend no Render

1. Faça push do código para o GitHub
2. No Render, crie um novo **Web Service**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name**: `sistema-reconciliacao-backend`
   - **Runtime**: Python 3
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && gunicorn projeto.wsgi:application`

5. Adicione as seguintes variáveis de ambiente:
   - `DEBUG`: `False`
   - `SECRET_KEY`: (gere uma chave segura)
   - `ALLOWED_HOSTS`: `.onrender.com`
   - `CORS_ALLOWED_ORIGINS`: `https://*.vercel.app,http://localhost:3000`
   - `GROQ_API_KEY`: (sua chave de API)
   - `GROQ_MODEL`: `llama-3.1-8b-instant`

6. Clique em **Create Web Service**

### 2. Configurar o Frontend no Vercel

1. No Vercel, importe o repositório GitHub
2. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

3. Adicione a variável de ambiente:
   - `REACT_APP_API_URL`: `https://sua-api.onrender.com/api`

4. Clique em **Deploy**

### 3. Criar Usuário Admin

Após o deploy do backend, acesse o terminal do Render e execute:
```bash
python manage.py createsuperuser
```

### Estrutura do Projeto
```
/
├── backend/
│   ├── projeto/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── reconciliacao/
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── render.yaml
├── vercel.json
└── Procfile
```

### Variáveis de Ambiente

#### Backend (Render)
| Variável | Descrição | Valor Padrão |
|----------|-----------|--------------|
| DEBUG | Modo de depuração | False |
| SECRET_KEY | Chave secreta do Django | (gere uma chave) |
| ALLOWED_HOSTS | Hosts permitidos | .onrender.com |
| CORS_ALLOWED_ORIGINS | Origens permitidas CORS | https://*.vercel.app |
| GROQ_API_KEY | Chave da API Groq | (sua chave) |
| GROQ_MODEL | Modelo Groq | llama-3.1-8b-instant |

#### Frontend (Vercel)
| Variável | Descrição | Valor Padrão |
|----------|-----------|--------------|
| REACT_APP_API_URL | URL da API backend | https://sua-api.onrender.com/api |

### Comandos Úteis

#### Desenvolvimento Local
```bash
# Backend
cd backend
python manage.py runserver

# Frontend
cd frontend
npm start
```

#### Produção
```bash
# Build do frontend
cd frontend
npm run build

# Coletar arquivos estáticos
cd backend
python manage.py collectstatic --noinput
```
