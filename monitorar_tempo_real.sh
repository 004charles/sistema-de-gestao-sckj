#!/bin/bash
# ============================================
# MONITOR EM TEMPO REAL
# ============================================

LOG_FILE="/home/sckj-muquissi/Documentos/DADOS CONTABLIDADE/sistema-reconciliacao-iva/backend/logs/django.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Monitorando erros em tempo real...${NC}"
echo -e "${YELLOW}Pressione Ctrl+C para parar${NC}"
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}Arquivo de log não encontrado: $LOG_FILE${NC}"
    echo "Iniciando monitoramento apenas de erros do Django..."
    tail -f /tmp/backend.log 2>/dev/null | grep --color=auto -i "error\|exception\|500\|traceback"
else
    tail -f "$LOG_FILE" 2>/dev/null | while read line; do
        if echo "$line" | grep -qi "error\|exception\|erro\|500\|traceback"; then
            echo -e "${RED}$line${NC}"
        elif echo "$line" | grep -qi "warning\|warn"; then
            echo -e "${YELLOW}$line${NC}"
        else
            echo -e "${GREEN}$line${NC}"
        fi
    done
fi
