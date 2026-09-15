#!/bin/bash
# ============================================
# SCRIPT DE MONITORAMENTO DE ERROS
# Sistema de Reconciliação IVA
# ============================================

BACKEND_DIR="/home/sckj-muquissi/Documentos/DADOS CONTABLIDADE/sistema-reconciliacao-iva/backend"
LOG_FILE="$BACKEND_DIR/logs/django.log"
ERROR_REPORT="$BACKEND_DIR/logs/erros_report_$(date +%Y%m%d_%H%M%S).txt"

# Cores para terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   MONITOR DE ERROS - SISTEMA IVA          ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# 1. Verificar se os servidores estão rodando
echo -e "${YELLOW}[1] Verificando servidores...${NC}"

BACKEND_PID=$(pgrep -f "runserver 0.0.0.0:8000" 2>/dev/null)
FRONTEND_PID=$(pgrep -f "react-scripts start" 2>/dev/null)

if [ -n "$BACKEND_PID" ]; then
    echo -e "    ${GREEN}✓ Backend rodando (PID: $BACKEND_PID)${NC}"
else
    echo -e "    ${RED}✗ Backend NÃO está rodando${NC}"
fi

if [ -n "$FRONTEND_PID" ]; then
    echo -e "    ${GREEN}✓ Frontend rodando (PID: $FRONTEND_PID)${NC}"
else
    echo -e "    ${RED}✗ Frontend NÃO está rodando${NC}"
fi

# 2. Verificar portas
echo ""
echo -e "${YELLOW}[2] Verificando portas...${NC}"

if ss -tlnp 2>/dev/null | grep -q ":8000"; then
    echo -e "    ${GREEN}✓ Porta 8000 (Backend) ativa${NC}"
else
    echo -e "    ${RED}✗ Porta 8000 (Backend) inativa${NC}"
fi

if ss -tlnp 2>/dev/null | grep -q ":3000"; then
    echo -e "    ${GREEN}✓ Porta 3000 (Frontend) ativa${NC}"
else
    echo -e "    ${RED}✗ Porta 3000 (Frontend) inativa${NC}"
fi

# 3. Testar API
echo ""
echo -e "${YELLOW}[3] Testando API...${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/ 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "    ${GREEN}✓ API respondendo (HTTP $HTTP_CODE)${NC}"
else
    echo -e "    ${RED}✗ API com erro (HTTP $HTTP_CODE)${NC}"
fi

# 4. Verificar últimos erros no log
echo ""
echo -e "${YELLOW}[4] Últimos erros no log:${NC}"

if [ -f "$LOG_FILE" ]; then
    ERROS=$(grep -i "error\|exception\|erro" "$LOG_FILE" 2>/dev/null | tail -10)
    if [ -n "$ERROS" ]; then
        echo -e "${RED}$ERROS${NC}"
    else
        echo -e "    ${GREEN}✓ Nenhum erro recente encontrado${NC}"
    fi
else
    echo -e "    ${YELLOW}⚠ Arquivo de log não encontrado${NC}"
fi

# 5. Verificar.erros específicos do Groq
echo ""
echo -e "${YELLOW}[5] Erros da API Groq:${NC}"

if [ -f "$LOG_FILE" ]; then
    GROQ_ERRORS=$(grep -i "groq\|groq_api\|model_not_found\|invalid_request" "$LOG_FILE" 2>/dev/null | tail -5)
    if [ -n "$GROQ_ERRORS" ]; then
        echo -e "${RED}$GROQ_ERRORS${NC}"
    else
        echo -e "    ${GREEN}✓ Nenhum erro Groq encontrado${NC}"
    fi
fi

# 6. Verificar espaço em disco
echo ""
echo -e "${YELLOW}[6] Espaço em disco:${NC}"
df -h / | tail -1 | awk '{print "    Uso: "$5" ("$3" de "$2")"}'

# 7. Verificar banco de dados
echo ""
echo -e "${YELLOW}[7] Status do banco de dados:${NC}"
if [ -f "$BACKEND_DIR/db.sqlite3" ]; then
    DB_SIZE=$(du -h "$BACKEND_DIR/db.sqlite3" | cut -f1)
    echo -e "    ${GREEN}✓ SQLite encontrado ($DB_SIZE)${NC}"
else
    echo -e "    ${RED}✗ Banco de dados não encontrado${NC}"
fi

# 8. Verificar chave API
echo ""
echo -e "${YELLOW}[8] Configuração Groq:${NC}"
if [ -f "$BACKEND_DIR/.env" ]; then
    API_KEY=$(grep "GROQ_API_KEY" "$BACKEND_DIR/.env" | cut -d'=' -f2)
    MODEL=$(grep "GROQ_MODEL" "$BACKEND_DIR/.env" | cut -d'=' -f2)
    if [ -n "$API_KEY" ]; then
        echo -e "    ${GREEN}✓ API Key configurada: ${API_KEY:0:10}...${NC}"
    else
        echo -e "    ${RED}✗ API Key não configurada${NC}"
    fi
    if [ -n "$MODEL" ]; then
        echo -e "    ${GREEN}✓ Modelo: $MODEL${NC}"
    else
        echo -e "    ${YELLOW}⚠ Modelo não configurado (usando padrão)${NC}"
    fi
else
    echo -e "    ${RED}✗ Arquivo .env não encontrado${NC}"
fi

# 9. Gerar relatório
echo ""
echo -e "${YELLOW}[9] Gerando relatório...${NC}"

{
    echo "=========================================="
    echo "RELATÓRIO DE ERROS - $(date)"
    echo "=========================================="
    echo ""
    echo "STATUS DOS SERVIDORES:"
    echo "  Backend: $([ -n "$BACKEND_PID" ] && echo "ATIVO" || echo "INATIVO")"
    echo "  Frontend: $([ -n "$FRONTEND_PID" ] && echo "ATIVO" || echo "INATIVO")"
    echo ""
    echo "PORTAS:"
    echo "  8000: $(ss -tlnp 2>/dev/null | grep -q ':8000' && echo "ATIVA" || echo "INATIVA")"
    echo "  3000: $(ss -tlnp 2>/dev/null | grep -q ':3000' && echo "ATIVA" || echo "INATIVA")"
    echo ""
    echo "API:"
    echo "  HTTP Status: $HTTP_CODE"
    echo ""
    echo "ÚLTIMOS ERROS:"
    if [ -f "$LOG_FILE" ]; then
        grep -i "error\|exception\|erro" "$LOG_FILE" 2>/dev/null | tail -20
    else
        echo "  Log não encontrado"
    fi
    echo ""
    echo "ERROS GROQ:"
    if [ -f "$LOG_FILE" ]; then
        grep -i "groq\|model_not_found" "$LOG_FILE" 2>/dev/null | tail -10
    fi
} > "$ERROR_REPORT" 2>&1

echo -e "    ${GREEN}✓ Relatório salvo em: $ERROR_REPORT${NC}"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   FIM DO MONITORAMENTO                    ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "Para monitorar em tempo real, execute:"
echo -e "  ${GREEN}tail -f $LOG_FILE${NC}"
echo ""
echo -e "Para ver erros apenas:"
echo -e "  ${GREEN}grep -i error $LOG_FILE${NC}"
