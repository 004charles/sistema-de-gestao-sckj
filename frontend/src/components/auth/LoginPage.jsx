import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Alert,
  Checkbox,
  FormControlLabel,
  useMediaQuery,
  useTheme,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { authService } from '../../services/api';
import { toast } from 'react-toastify';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.login(formData.username, formData.password);
      if (response.data.success) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        if (rememberMe) localStorage.setItem('rememberedUser', formData.username);
        toast.success(t('login.success'));
        onLogin();
        navigate('/home');
      }
    } catch (err) {
      setError(err.response?.status === 401 ? t('login.errorInvalidCredentials') : t('login.errorServer'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', backgroundColor: '#FFFFFF' }}>
      {/* Left Panel */}
      {!isMobile && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 10 }}>
              <img src="/agt_logo.png" alt="AGT" style={{ height: '40px' }} />
            </Box>

            <Box sx={{ maxWidth: 440 }}>
              <Typography
                sx={{
                  color: '#0F172A',
                  fontWeight: 800,
                  fontSize: '42px',
                  lineHeight: 1.1,
                  mb: 3,
                  letterSpacing: '-1px',
                }}
              >
                Reconciliação
                <br />
                Fiscal{' '}
                <Box component="span" sx={{ color: '#003D99' }}>
                  Inteligente
                </Box>
              </Typography>

              <Typography sx={{ color: '#64748B', fontSize: '16px', lineHeight: 1.7, mb: 5 }}>
                {t('login.systemDescription')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { icon: '📊', text: t('login.features.autoReconciliation') },
                  { icon: '🔍', text: t('login.features.divergenceIdentification') },
                  { icon: '📈', text: t('login.features.detailedReports') },
                  { icon: '🔒', text: t('login.features.secureData') },
                ].map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        backgroundColor: '#F0F7FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography sx={{ color: '#334155', fontSize: '14px', fontWeight: 500 }}>
                      {f.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Typography sx={{ color: '#94A3B8', fontSize: '12px' }}>
            © 2024 AGT - Todos os direitos reservados
          </Typography>
        </Box>
      )}

      {/* Right Panel */}
      <Box
        sx={{
          flex: isMobile ? 1 : '0 0 520px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { xs: '24px 20px', sm: '48px 40px' },
          backgroundColor: '#FFFFFF',
        }}
      >
        {isMobile && (
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img src="/agt_logo.png" alt="AGT" style={{ height: '40px' }} />
          </Box>
        )}

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 3, sm: 4 } }}>
            <Box>
              <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: { xs: '24px', sm: '28px' }, mb: 1 }}>
                {t('login.title')}
              </Typography>
              <Typography sx={{ color: '#64748B', fontSize: { xs: '14px', sm: '15px' } }}>
                {t('login.subtitle')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[
                { code: 'pt', label: 'PT' },
                { code: 'en', label: 'EN' },
                { code: 'zh', label: 'ZH' },
              ].map((lang) => (
                <Box
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: i18n.language === lang.code ? '#F0F7FF' : 'transparent',
                    border: `1px solid ${i18n.language === lang.code ? '#BFDBFE' : '#E2E8F0'}`,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: '#003D99' },
                  }}
                >
                  <Typography
                    sx={{
                      color: i18n.language === lang.code ? '#003D99' : '#64748B',
                      fontWeight: i18n.language === lang.code ? 600 : 400,
                      fontSize: '11px',
                    }}
                  >
                    {lang.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                borderRadius: '8px',
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="username"
              placeholder={t('login.emailPlaceholder')}
              value={formData.username}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <PersonOutlineIcon sx={{ color: '#94A3B8', mr: 1 }} />,
              }}
              sx={{ mb: { xs: 2, sm: 2.5 } }}
            />

            <TextField
              fullWidth
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              required
              InputProps={{
                startAdornment: <LockOutlinedIcon sx={{ color: '#94A3B8', mr: 1 }} />,
                endAdornment: (
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: '#94A3B8' }}>
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                ),
              }}
              sx={{ mb: { xs: 2, sm: 2.5 } }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    size="small"
                    sx={{ color: '#CBD5E1', '&.Mui-checked': { color: '#003D99' } }}
                  />
                }
                label={<Typography sx={{ color: '#64748B', fontSize: '13px' }}>{t('login.rememberMe')}</Typography>}
              />
              <Typography sx={{ color: '#003D99', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {t('login.forgotPassword')}
              </Typography>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              endIcon={!loading && <ArrowForwardIcon />}
              sx={{
                py: { xs: 1.3, sm: 1.5 },
                fontSize: { xs: '14px', sm: '15px' },
                '&.Mui-disabled': { backgroundColor: '#E2E8F0', color: '#94A3B8' },
              }}
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>

          <Box sx={{ display: 'flex', alignItems: 'center', my: 4 }}>
            <Box sx={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            <Typography sx={{ color: '#94A3B8', px: 2, fontSize: '13px' }}>ou</Typography>
            <Box sx={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          </Box>

          <Box sx={{ textAlign: 'center', p: 3, backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Typography sx={{ color: '#64748B', fontSize: '14px' }}>
              {t('login.noAccount')}{' '}
              <Box component="span" sx={{ color: '#003D99', fontWeight: 600, cursor: 'pointer' }}>
                {t('login.contactAdmin')}
              </Box>
            </Typography>
          </Box>

          <Typography sx={{ color: '#94A3B8', fontSize: '11px', textAlign: 'center', mt: 3 }}>
            {t('login.footer')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
