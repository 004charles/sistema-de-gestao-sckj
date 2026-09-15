import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import {
  Psychology as AIIcon,
} from '@mui/icons-material';

const Home = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#0052A5', fontWeight: 700, letterSpacing: '-0.5px' }}>
            {t('navigation.home')}
          </Typography>
          <Typography variant="body1" sx={{ color: '#6C757D', marginTop: 0.5 }}>
            {t('dashboard.overviewDescription')}
          </Typography>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          borderRadius: '16px',
          border: '1px solid #E9ECEF',
          backgroundColor: '#FFFFFF',
          p: 4,
          textAlign: 'center',
        }}
      >
        <AIIcon sx={{ fontSize: 60, color: '#0052A5', mb: 2 }} />
        <Typography variant="h5" sx={{ color: '#1A1A1A', fontWeight: 600, mb: 1 }}>
          Sistema de Reconciliação IVA
        </Typography>
        <Typography variant="body1" sx={{ color: '#6C757D', mb: 3 }}>
          Carregue os documentos PDF da contabilidade e da AGT para análise automática
        </Typography>
        <Typography variant="body2" sx={{ color: '#6C757D' }}>
          Acesse <strong>Análise Documentos</strong> no menu lateral para começar
        </Typography>
      </Paper>
    </Box>
  );
};

export default Home;
