import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  IconButton,
  Alert,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { authService } from '../../services/api';
import { toast } from 'react-toastify';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      setFormData((prev) => ({ ...prev, username: remembered }));
      setRememberMe(true);
    }
  }, []);

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
        if (rememberMe) {
          localStorage.setItem('rememberedUser', formData.username);
        } else {
          localStorage.removeItem('rememberedUser');
        }
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
    <Box
      sx={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: '#F8FAFC',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(0, 61, 153, 0.04) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(0, 61, 153, 0.04) 0px, transparent 50%)
        `,
        px: 2,
        boxSizing: 'border-box',
      }}
    >
      {/* Top Accent Line */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #003D99 0%, #0066CC 50%, #0284C7 100%)',
        }}
      />

      {/* Language Switcher */}
      <Box
        sx={{
          position: 'absolute',
          top: { xs: 14, sm: 20 },
          right: { xs: 16, sm: 24 },
          display: 'flex',
          gap: 0.5,
          backgroundColor: '#FFFFFF',
          p: 0.5,
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          zIndex: 10,
        }}
      >
        {[
          { code: 'pt', label: 'PT' },
          { code: 'en', label: 'EN' },
          { code: 'zh', label: 'ZH' },
        ].map((lang) => (
          <Box
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            sx={{
              px: 1.2,
              py: 0.35,
              borderRadius: '5px',
              cursor: 'pointer',
              backgroundColor: i18n.language === lang.code ? '#F0F7FF' : 'transparent',
              border: `1px solid ${i18n.language === lang.code ? '#BFDBFE' : 'transparent'}`,
              transition: 'all 0.15s ease-in-out',
              '&:hover': { backgroundColor: '#F8FAFC' },
            }}
          >
            <Typography
              sx={{
                color: i18n.language === lang.code ? '#003D99' : '#64748B',
                fontWeight: i18n.language === lang.code ? 700 : 500,
                fontSize: '11px',
                lineHeight: 1.2,
              }}
            >
              {lang.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Main Centered Login Card */}
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 3.5 }, '&:last-child': { pb: { xs: 3, sm: 3.5 } } }}>
          {/* Header & Logo */}
          <Box sx={{ textAlign: 'center', mb: 2.5 }}>
            <Box
              component="img"
              src="/logooficial.jpeg"
              alt="SCKJ"
              sx={{
                height: 50,
                width: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                mb: 1.5,
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo.jpeg';
              }}
            />
            <Typography
              sx={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
                mb: 0.5,
              }}
            >
              {t('login.title')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#64748B' }}>
              {t('login.subtitle')}
            </Typography>
          </Box>

          {/* Error Message */}
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                py: 0.5,
                fontSize: '12px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                borderRadius: '8px',
              }}
            >
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ mb: 1.8 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#334155', mb: 0.6 }}>
                {t('login.emailPlaceholder')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                name="username"
                placeholder="Insira o seu NIF ou utilizador"
                value={formData.username}
                onChange={handleChange}
                required
                autoComplete="username"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon sx={{ color: '#94A3B8', fontSize: 19 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    '& fieldset': { borderColor: '#E2E8F0' },
                    '&:hover fieldset': { borderColor: '#CBD5E1' },
                    '&.Mui-focused fieldset': { borderColor: '#003D99' },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '13.5px',
                    py: 1.1,
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 1.2 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#334155', mb: 0.6 }}>
                {t('login.passwordPlaceholder')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Insira a sua palavra-passe"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ color: '#94A3B8', fontSize: 19 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: '#94A3B8', p: 0.5 }}
                      >
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    '& fieldset': { borderColor: '#E2E8F0' },
                    '&:hover fieldset': { borderColor: '#CBD5E1' },
                    '&.Mui-focused fieldset': { borderColor: '#003D99' },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '13.5px',
                    py: 1.1,
                  },
                }}
              />
            </Box>

            {/* Remember Me & Forgot Password */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    size="small"
                    sx={{
                      p: 0.4,
                      color: '#CBD5E1',
                      '&.Mui-checked': { color: '#003D99' },
                    }}
                  />
                }
                label={<Typography sx={{ color: '#64748B', fontSize: '12px' }}>{t('login.rememberMe')}</Typography>}
                sx={{ m: 0 }}
              />
              <Typography
                onClick={() => toast.info('Contacte o suporte da SCKJ para redefinir as suas credenciais.')}
                sx={{
                  color: '#003D99',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {t('login.forgotPassword')}
              </Typography>
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{
                py: 1.2,
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                backgroundColor: '#003D99',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0, 61, 153, 0.2)',
                '&:hover': {
                  backgroundColor: '#002D72',
                  boxShadow: '0 4px 8px rgba(0, 61, 153, 0.3)',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#E2E8F0',
                  color: '#94A3B8',
                },
              }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} color="inherit" />
                  <span>{t('login.submitting')}</span>
                </Box>
              ) : (
                t('login.submit')
              )}
            </Button>
          </Box>

          {/* Help link */}
          <Box sx={{ textAlign: 'center', mt: 2.5, pt: 1.8, borderTop: '1px solid #F1F5F9' }}>
            <Typography sx={{ color: '#64748B', fontSize: '12px' }}>
              {t('login.noAccount')}{' '}
              <Box
                component="span"
                onClick={() => toast.info('Por favor contacte o Administrador da sua organização.')}
                sx={{ color: '#003D99', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                {t('login.contactAdmin')}
              </Box>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Security & Copyright Footer */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7, color: '#64748B', mb: 0.3 }}>
          <VerifiedUserOutlinedIcon sx={{ fontSize: 14, color: '#16A34A' }} />
          <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>
            Ambiente Seguro • Encriptação de Ponta a Ponta
          </Typography>
        </Box>
        <Typography sx={{ color: '#94A3B8', fontSize: '10.5px' }}>
          {t('login.footer')}
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
