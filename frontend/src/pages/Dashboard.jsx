import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
        const response = await fetch(`${API_BASE}/analises/historico/`);
        const data = await response.json();

        const totalAnalises = data.length;
        const semDivergencias = data.filter(
          (a) => a.status === 'CONCLUIDA' && (!a.resultado || !a.resultado.toLowerCase().includes('divergência'))
        ).length;
        const comDivergencias = totalAnalises - semDivergencias;

        setStats([
          {
            icon: <AssessmentIcon sx={{ fontSize: 28, color: '#003D99' }} />,
            value: String(totalAnalises),
            label: t('dashboard.analysesPerformed'),
            color: '#F0F7FF',
          },
          {
            icon: <CheckCircleIcon sx={{ fontSize: 28, color: '#10B981' }} />,
            value: String(semDivergencias),
            label: t('dashboard.withoutDivergences'),
            color: '#ECFDF5',
          },
          {
            icon: <WarningIcon sx={{ fontSize: 28, color: '#F59E0B' }} />,
            value: String(comDivergencias),
            label: t('dashboard.withDivergences'),
            color: '#FFFBEB',
          },
        ]);

        setRecentAnalyses(
          data.slice(0, 5).map((a) => ({
            id: a.id,
            name: a.documento_contabilidade?.nome_arquivo || 'N/A',
            date: new Date(a.created_at).toLocaleDateString(),
            divergences: a.resultado && a.resultado.toLowerCase().includes('divergência') ? 1 : 0,
          }))
        );
      } catch (error) {
        setStats([
          {
            icon: <AssessmentIcon sx={{ fontSize: 28, color: '#003D99' }} />,
            value: '0',
            label: t('dashboard.analysesPerformed'),
            color: '#F0F7FF',
          },
          {
            icon: <CheckCircleIcon sx={{ fontSize: 28, color: '#10B981' }} />,
            value: '0',
            label: t('dashboard.withoutDivergences'),
            color: '#ECFDF5',
          },
          {
            icon: <WarningIcon sx={{ fontSize: 28, color: '#F59E0B' }} />,
            value: '0',
            label: t('dashboard.withDivergences'),
            color: '#FFFBEB',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: '#003D99' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: '28px', mb: 1 }}>
          {t('dashboard.welcomeBack')}
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: '16px' }}>
          {t('dashboard.welcomeDescription')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        {stats.map((stat, i) => (
          <Box
            key={i}
            sx={{
              flex: '1 1 200px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              p: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #E2E8F0',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '12px',
                backgroundColor: stat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </Box>
            <Box>
              <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: '28px' }}>
                {stat.value}
              </Typography>
              <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
                {stat.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', mb: 4 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 2 }}>
          <HistoryIcon sx={{ color: '#003D99' }} />
          <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '16px' }}>
            {t('dashboard.recentAnalyses')}
          </Typography>
        </Box>
        {recentAnalyses.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
              {t('dashboard.noData')}
            </Typography>
            <Typography sx={{ color: '#94A3B8', fontSize: '13px', mt: 1 }}>
              {t('dashboard.noDataDescription')}
            </Typography>
          </Box>
        ) : (
          recentAnalyses.map((analysis, i) => (
            <Box
              key={analysis.id}
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: i < recentAnalyses.length - 1 ? '1px solid #F1F5F9' : 'none',
                '&:hover': { backgroundColor: '#F8FAFC' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '8px', backgroundColor: '#F0F7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AssessmentIcon sx={{ fontSize: 20, color: '#003D99' }} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#0F172A', fontWeight: 500, fontSize: '14px' }}>{analysis.name}</Typography>
                  <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>{analysis.date}</Typography>
                </Box>
              </Box>
              {analysis.divergences > 0 ? (
                <Box sx={{ px: 2, py: 0.5, borderRadius: '20px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <Typography sx={{ color: '#92400E', fontSize: '12px', fontWeight: 500 }}>{analysis.divergences} {t('dashboard.divergencesPlural')}</Typography>
                </Box>
              ) : (
                <Box sx={{ px: 2, py: 0.5, borderRadius: '20px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                  <Typography sx={{ color: '#065F46', fontSize: '12px', fontWeight: 500 }}>{t('dashboard.noDivergences')}</Typography>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box
          onClick={() => navigate('/analise')}
          sx={{
            flex: '1 1 300px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            p: 4,
            border: '1px solid #E2E8F0',
            cursor: 'pointer',
            '&:hover': { borderColor: '#003D99', boxShadow: '0 4px 12px rgba(0,61,153,0.1)' },
          }}
        >
          <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '16px', mb: 1 }}>{t('dashboard.newAnalysis')}</Typography>
          <Typography sx={{ color: '#64748B', fontSize: '14px' }}>{t('dashboard.newAnalysisDesc')}</Typography>
        </Box>
        <Box
          onClick={() => navigate('/historico')}
          sx={{
            flex: '1 1 300px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            p: 4,
            border: '1px solid #E2E8F0',
            cursor: 'pointer',
            '&:hover': { borderColor: '#003D99', boxShadow: '0 4px 12px rgba(0,61,153,0.1)' },
          }}
        >
          <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '16px', mb: 1 }}>{t('dashboard.fullReport')}</Typography>
          <Typography sx={{ color: '#64748B', fontSize: '14px' }}>{t('dashboard.fullReportDesc')}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
