import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CompareArrows as CompareIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  TableChart as TableIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

const AnaliseDocumentos = () => {
  const { t } = useTranslation();
  const [docContabilidade, setDocContabilidade] = useState(null);
  const [docAGT, setDocAGT] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [analise, setAnalise] = useState('');
  const [camposAnalisados, setCamposAnalisados] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [erro, setErro] = useState('');

  const handleUpload = async (file, tipo) => {
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo', tipo);

    setUploadProgress((prev) => ({ ...prev, [tipo]: 0 }));
    setErro('');

    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_BASE}/documentos/upload/`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`${tipo === 'CONTABILIDADE' ? t('analysis.accountingData') : t('analysis.agtData')} ${t('common.success')}!`);
        if (tipo === 'CONTABILIDADE') {
          setDocContabilidade(data.documento);
        } else {
          setDocAGT(data.documento);
        }
      } else {
        setErro(data.error || t('common.error'));
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      setErro(t('login.errorServer'));
      toast.error(t('login.errorServer'));
    } finally {
      setUploadProgress((prev) => ({ ...prev, [tipo]: null }));
    }
  };

  const extrairCamposAnalise = (textoAnalise) => {
    const campos = [];
    const linhas = textoAnalise.split('\n');
    let campoAtual = null;

    for (const linha of linhas) {
      const linhaTrim = linha.trim();

      if (linhaTrim.match(/^\[.*\]$/) || linhaTrim.match(/^【.*】$/)) {
        if (campoAtual) {
          campos.push(campoAtual);
        }
        campoAtual = {
          nome: linhaTrim.replace(/[[\]【】]/g, ''),
          valores: [],
          status: 'pending',
        };
      } else if (campoAtual && linhaTrim.includes(':')) {
        const parts = linhaTrim.split(':');
        const chave = parts[0].trim();
        const valor = parts.slice(1).join(':').trim();
        campoAtual.valores.push({ chave, valor });
        if (valor.toLowerCase().includes('conforme') || valor.includes('✅')) {
          campoAtual.status = 'ok';
        } else if (valor.toLowerCase().includes('divergência') || valor.includes('⚠️')) {
          campoAtual.status = 'divergencia';
        }
      } else if (campoAtual && linhaTrim.includes('Contabilidade:')) {
        campoAtual.valores.push({ chave: 'Contabilidade', valor: linhaTrim.replace('Contabilidade:', '').trim() });
      } else if (campoAtual && linhaTrim.includes('AGT:')) {
        campoAtual.valores.push({ chave: 'AGT', valor: linhaTrim.replace('AGT:', '').trim() });
      } else if (campoAtual && linhaTrim.includes('Status:')) {
        const statusVal = linhaTrim.replace('Status:', '').trim();
        campoAtual.valores.push({ chave: 'Status', valor: statusVal });
        if (statusVal.includes('Conforme') || statusVal.includes('✅')) {
          campoAtual.status = 'ok';
        } else if (statusVal.includes('Divergência') || statusVal.includes('⚠️')) {
          campoAtual.status = 'divergencia';
        }
      } else if (campoAtual && linhaTrim.includes('Diferença:')) {
        campoAtual.valores.push({ chave: 'Diferença', valor: linhaTrim.replace('Diferença:', '').trim() });
      }
    }

    if (campoAtual) {
      campos.push(campoAtual);
    }

    return campos;
  };

  const handleAnalisar = async () => {
    if (!docContabilidade || !docAGT) {
      toast.warning('Carregue ambos os documentos antes de analisar');
      return;
    }

    setCarregando(true);
    setAnalise('');
    setCamposAnalisados([]);
    setErro('');

    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_BASE}/analises/analise-documentos/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_contabilidade_id: docContabilidade.id,
          documento_agt_id: docAGT.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAnalise(data.resultado);
        const campos = extrairCamposAnalise(data.resultado);
        setCamposAnalisados(campos);
        toast.success('Análise concluída!');
      } else {
        setErro(data.error || t('common.error'));
        toast.error(data.error || t('common.error'));
      }
    } catch (error) {
      setErro(t('login.errorServer'));
      toast.error(t('login.errorServer'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: '24px', mb: 1 }}>
          {t('analysis.title')}
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
          {t('analysis.subtitle')}
        </Typography>
      </Box>

      {erro && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          onClose={() => setErro('')}
          sx={{ mb: 3, borderRadius: '10px' }}
        >
          {erro}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  backgroundColor: '#F0F7FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontSize: '16px' }}>📊</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '15px' }}>
                  {t('analysis.accountingData')}
                </Typography>
                <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>
                  {t('analysis.accountingDataDesc')}
                </Typography>
              </Box>
            </Box>

            {uploadProgress['CONTABILIDADE'] !== undefined && uploadProgress['CONTABILIDADE'] !== null && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress['CONTABILIDADE']}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#003D99',
                    },
                  }}
                />
                <Typography sx={{ color: '#64748B', fontSize: '12px', mt: 1, textAlign: 'center' }}>
                  {t('analysis.loading')}
                </Typography>
              </Box>
            )}

            {docContabilidade ? (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #BBF7D0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} />
                  <Typography sx={{ color: '#16A34A', fontWeight: 500, fontSize: '13px' }}>
                    {docContabilidade.nome_arquivo}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
                disabled={uploadProgress['CONTABILIDADE'] !== null && uploadProgress['CONTABILIDADE'] !== undefined}
                sx={{
                  py: 2.5,
                  borderColor: '#E2E8F0',
                  color: '#64748B',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#003D99', color: '#003D99' },
                }}
              >
                {t('analysis.selectPdf')}
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={(e) => handleUpload(e.target.files[0], 'CONTABILIDADE')}
                />
              </Button>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 3,
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  backgroundColor: '#F0F7FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontSize: '16px' }}>🏛️</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '15px' }}>
                  {t('analysis.agtData')}
                </Typography>
                <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>
                  {t('analysis.agtDataDesc')}
                </Typography>
              </Box>
            </Box>

            {uploadProgress['AGT'] !== undefined && uploadProgress['AGT'] !== null && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress['AGT']}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#E2E8F0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#003D99',
                    },
                  }}
                />
                <Typography sx={{ color: '#64748B', fontSize: '12px', mt: 1, textAlign: 'center' }}>
                  {t('analysis.loading')}
                </Typography>
              </Box>
            )}

            {docAGT ? (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #BBF7D0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} />
                  <Typography sx={{ color: '#16A34A', fontWeight: 500, fontSize: '13px' }}>
                    {docAGT.nome_arquivo}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
                disabled={uploadProgress['AGT'] !== null && uploadProgress['AGT'] !== undefined}
                sx={{
                  py: 2.5,
                  borderColor: '#E2E8F0',
                  color: '#64748B',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#003D99', color: '#003D99' },
                }}
              >
                {t('analysis.selectPdf')}
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={(e) => handleUpload(e.target.files[0], 'AGT')}
                />
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={carregando ? <CircularProgress size={20} color="inherit" /> : <CompareIcon />}
          onClick={handleAnalisar}
          disabled={carregando || !docContabilidade || !docAGT}
          sx={{
            px: 5,
            py: 1.5,
            textTransform: 'none',
            fontSize: '15px',
            '&.Mui-disabled': { backgroundColor: '#E2E8F0', color: '#94A3B8' },
          }}
        >
          {carregando ? t('analysis.analyzing') : t('analysis.analyzeDocuments')}
        </Button>
      </Box>

      {carregando && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <CircularProgress size={60} sx={{ color: '#003D99', mb: 3 }} />
          <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '18px', mb: 1 }}>
            {t('analysis.analysisInProgress')}
          </Typography>
          <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
            {t('analysis.aiComparing')}
          </Typography>
        </Box>
      )}

      {analise && (
        <Box
          sx={{
            p: 4,
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '18px', mb: 3 }}>
            {t('analysis.analysisResult')}
          </Typography>

          {camposAnalisados.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TableIcon sx={{ color: '#003D99' }} />
                <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: '16px' }}>
                  {t('analysis.fieldsAnalyzed')}
                </Typography>
                <Chip
                  label={camposAnalisados.length}
                  size="small"
                  sx={{ backgroundColor: '#F0F7FF', color: '#003D99', fontWeight: 600 }}
                />
              </Box>

              <Grid container spacing={2}>
                {camposAnalisados.map((campo, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: campo.status === 'ok' ? '#BBF7D0' : campo.status === 'divergencia' ? '#FDE68A' : '#E2E8F0',
                        backgroundColor: campo.status === 'ok' ? '#F0FDF4' : campo.status === 'divergencia' ? '#FFFBEB' : '#FFFFFF',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>
                          {campo.nome}
                        </Typography>
                        {campo.status === 'ok' && <CheckIcon sx={{ color: '#16A34A', fontSize: 18 }} />}
                        {campo.status === 'divergencia' && <ErrorIcon sx={{ color: '#F59E0B', fontSize: 18 }} />}
                      </Box>
                      {campo.valores.map((v, vi) => (
                        <Box key={vi} sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography sx={{ color: '#64748B', fontSize: '12px' }}>{v.chave}:</Typography>
                          <Typography sx={{ color: '#334155', fontSize: '12px', fontWeight: 500 }}>{v.valor}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Box sx={{ borderTop: '1px solid #E2E8F0', pt: 3 }}>
            <Typography sx={{ color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>
              {analise}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AnaliseDocumentos;
