import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, Container } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      {/* Nav */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: { xs: 1, sm: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <img src="/agt_logo.svg" alt="AGT" style={{ height: '28px' }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
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
                      px: { xs: 1, sm: 1.5 },
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
              <Button
                onClick={() => navigate('/login')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: { xs: '12px', sm: '14px' },
                  color: '#003D99',
                  '&:hover': { backgroundColor: '#F0F7FF' },
                  minWidth: 'auto',
                  px: { xs: 1, sm: 2 },
                }}
              >
                {t('landing.navEnter')}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pt: 10,
          pb: 4,
          px: { xs: 2, sm: 3 },
        }}
      >
        <Container maxWidth="md" disableGutters>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 4, md: 6 }, gap: { xs: 2, sm: 3 }, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ width: { xs: 80, sm: 100, md: 140 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/agt_logo.svg" alt="AGT" style={{ width: '100%', height: 'auto' }} />
            </Box>
            <Box sx={{ width: { xs: 120, sm: 160, md: 220 }, height: { xs: 70, sm: 90, md: 130 }, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,61,153,0.1)' }}>
              <img src="/contabilidade.jpeg" alt="Contabilidade" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
          </Box>

          <Typography
            sx={{
              color: '#003D99',
              fontWeight: 600,
              fontSize: { xs: '11px', sm: '13px' },
              letterSpacing: '1px',
              textTransform: 'uppercase',
              mb: 2,
            }}
          >
            {t('landing.heroTag')}
          </Typography>

          <Typography
            sx={{
              color: '#0F172A',
              fontWeight: 700,
              fontSize: { xs: '32px', sm: '48px', md: '64px' },
              lineHeight: 1.05,
              letterSpacing: { xs: '-1px', md: '-2px' },
              mb: 3,
            }}
          >
            {t('landing.heroTitle1')}
            <br />
            {t('landing.heroTitle2')}{' '}
            <Box component="span" sx={{ color: '#003D99' }}>
              {t('landing.heroTitleHighlight')}
            </Box>
          </Typography>

          <Typography
            sx={{
              color: '#64748B',
              fontSize: { xs: '15px', sm: '17px', md: '20px' },
              lineHeight: 1.6,
              mb: 4,
              maxWidth: 500,
              mx: 'auto',
            }}
          >
            {t('landing.heroDescription')}
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            endIcon={<ArrowForwardIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: { xs: 4, sm: 5 },
              py: { xs: 1.5, sm: 1.8 },
              fontSize: { xs: '14px', sm: '16px' },
              borderRadius: '100px',
            }}
          >
            {t('landing.heroCta')}
          </Button>
        </Container>
      </Box>

      {/* Features */}
      <Box sx={{ py: { xs: 8, sm: 10, md: 12 }, backgroundColor: '#FFFFFF' }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 6, sm: 8, md: 10 } }}>
            <Typography sx={{ color: '#003D99', fontWeight: 600, fontSize: { xs: '12px', sm: '14px' }, mb: 2 }}>
              {t('landing.featuresTitle')}
            </Typography>
            <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: { xs: '28px', sm: '36px', md: '44px' }, letterSpacing: '-1px' }}>
              {t('landing.featuresSubtitle')}
              <br />
              <Box component="span" sx={{ color: '#003D99' }}>{t('landing.featuresSubtitleHighlight')}</Box>
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 3, sm: 4 } }}>
            {[
              { icon: '📊', title: t('landing.feature1Title'), desc: t('landing.feature1Desc') },
              { icon: '⚡', title: t('landing.feature2Title'), desc: t('landing.feature2Desc') },
              { icon: '📈', title: t('landing.feature3Title'), desc: t('landing.feature3Desc') },
            ].map((f, i) => (
              <Box
                key={i}
                sx={{
                  textAlign: 'center',
                  p: { xs: 3, sm: 4, md: 5 },
                  borderRadius: '16px',
                  backgroundColor: '#F8FAFC',
                  transition: 'all 0.3s ease',
                  '&:hover': { backgroundColor: '#F0F7FF', transform: 'translateY(-4px)' },
                }}
              >
                <Typography sx={{ fontSize: { xs: '32px', sm: '36px', md: '40px' }, mb: 2 }}>{f.icon}</Typography>
                <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: { xs: '16px', sm: '17px', md: '18px' }, mb: 1.5 }}>
                  {f.title}
                </Typography>
                <Typography sx={{ color: '#64748B', fontSize: { xs: '14px', sm: '15px' }, lineHeight: 1.6 }}>
                  {f.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 8, sm: 10, md: 12 }, backgroundColor: '#FFFFFF' }}>
        <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ color: '#0F172A', fontWeight: 700, fontSize: { xs: '24px', sm: '32px', md: '40px' }, mb: 3, letterSpacing: '-1px' }}>
              {t('landing.ctaTitle')}
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: { xs: '15px', sm: '16px', md: '17px' }, mb: 4, maxWidth: 400, mx: 'auto' }}>
              {t('landing.ctaDescription')}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                px: { xs: 4, sm: 5 },
                py: { xs: 1.5, sm: 1.8 },
                fontSize: { xs: '14px', sm: '16px' },
                borderRadius: '100px',
              }}
            >
              {t('landing.ctaButton')}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', py: 3 }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img src="/agt_logo.svg" alt="AGT" style={{ height: '20px', opacity: 0.4 }} />
              <Typography sx={{ color: '#94A3B8', fontSize: { xs: '11px', sm: '12px' } }}>
                {t('landing.footer')}
              </Typography>
            </Box>
            <Typography sx={{ color: '#CBD5E1', fontSize: '11px' }}>
              Feito por SCKJ
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
