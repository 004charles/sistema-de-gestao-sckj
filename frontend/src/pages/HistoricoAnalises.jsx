import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

const HistoricoAnalises = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalise, setSelectedAnalise] = useState(null);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
        const response = await fetch(`${API_BASE}/analises/historico/`);
        const data = await response.json();
        setAnalises(data);
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorico();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja apagar esta análise?')) return;
    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_BASE}/analises/historico/${id}/`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setAnalises((prev) => prev.filter((a) => a.id !== id));
        toast.success('Análise apagada com sucesso!');
      } else {
        toast.error('Erro ao apagar análise');
      }
    } catch (error) {
      toast.error('Erro ao conectar com o servidor');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONCLUIDA':
        return { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
      case 'PENDENTE':
        return { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' };
      case 'ERRO':
        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
      default:
        return { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
    }
  };

  const hasDivergences = (resultado) => {
    if (!resultado) return false;
    return resultado.toLowerCase().includes('divergência') || resultado.toLowerCase().includes('⚠️');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: '#003D99' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/dashboard')} sx={{ color: '#64748B' }}>
          <BackIcon />
        </IconButton>
        <Box>
          <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: '24px', mb: 0.5 }}>
            {t('dashboard.fullReport')}
          </Typography>
          <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
            Histórico completo de todas as análises realizadas
          </Typography>
        </Box>
      </Box>

      {analises.length === 0 ? (
        <Box sx={{ p: 6, textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <AssessmentIcon sx={{ fontSize: 60, color: '#CBD5E1', mb: 2 }} />
          <Typography sx={{ color: '#64748B', fontSize: '16px', mb: 1 }}>
            {t('dashboard.noData')}
          </Typography>
          <Typography sx={{ color: '#94A3B8', fontSize: '14px' }}>
            {t('dashboard.noDataDescription')}
          </Typography>
        </Box>
      ) : (
        <Box>
          {analises.map((analise) => {
            const statusStyle = getStatusColor(analise.status);
            const divergences = hasDivergences(analise.resultado);

            return (
              <Box
                key={analise.id}
                sx={{
                  p: 3,
                  mb: 2,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: '#003D99', boxShadow: '0 2px 8px rgba(0,61,153,0.08)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '10px', backgroundColor: '#F0F7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AssessmentIcon sx={{ fontSize: 22, color: '#003D99' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '14px' }}>
                        Análise #{analise.id}
                      </Typography>
                      <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>
                        {new Date(analise.created_at).toLocaleString('pt-BR')}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={analise.status}
                      size="small"
                      sx={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                        fontWeight: 500,
                        fontSize: '11px',
                      }}
                    />
                    {divergences && (
                      <Chip
                        icon={<ErrorIcon sx={{ fontSize: 14 }} />}
                        label="Divergência"
                        size="small"
                        sx={{
                          backgroundColor: '#FFFBEB',
                          color: '#92400E',
                          border: '1px solid #FDE68A',
                          fontWeight: 500,
                          fontSize: '11px',
                          '& .MuiChip-icon': { color: '#F59E0B' },
                        }}
                      />
                    )}
                    {!divergences && analise.status === 'CONCLUIDA' && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 14 }} />}
                        label="Conforme"
                        size="small"
                        sx={{
                          backgroundColor: '#ECFDF5',
                          color: '#065F46',
                          border: '1px solid #A7F3D0',
                          fontWeight: 500,
                          fontSize: '11px',
                          '& .MuiChip-icon': { color: '#10B981' },
                        }}
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  {analise.documento_contabilidade?.nome_arquivo && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>Contabilidade:</Typography>
                      <Typography sx={{ color: '#334155', fontSize: '12px', fontWeight: 500 }}>
                        {analise.documento_contabilidade.nome_arquivo}
                      </Typography>
                    </Box>
                  )}
                  {analise.documento_agt?.nome_arquivo && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>AGT:</Typography>
                      <Typography sx={{ color: '#334155', fontSize: '12px', fontWeight: 500 }}>
                        {analise.documento_agt.nome_arquivo}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Tooltip title={t('common.view')}>
                    <IconButton
                      onClick={() => setSelectedAnalise(selectedAnalise === analise.id ? null : analise.id)}
                      sx={{ color: '#003D99', p: 0.5 }}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.delete')}>
                    <IconButton
                      onClick={() => handleDelete(analise.id)}
                      sx={{ color: '#DC2626', p: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {selectedAnalise === analise.id && analise.resultado && (
                  <Box sx={{ mt: 2, p: 3, backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <Typography sx={{ color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '13px' }}>
                      {analise.resultado}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default HistoricoAnalises;
