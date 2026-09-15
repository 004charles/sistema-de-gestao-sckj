import React, { useState, useEffect } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';

const LoadingPage = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const duration = 3000;
    const interval = 50;
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => {
              if (onComplete) onComplete();
            }, 500);
          }, 300);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0078D4 0%, #005A9E 50%, #003F7F 100%)',
        position: 'relative',
        overflow: 'hidden',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          background: `
            radial-gradient(circle at 20% 80%, white 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, white 1px, transparent 1px),
            radial-gradient(circle at 40% 40%, white 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px, 150px 150px, 80px 80px',
        }}
      />

      {/* Floating Circles */}
      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.03)',
          top: '-100px',
          right: '-100px',
          animation: 'float 6s ease-in-out infinite',
          '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
            '50%': { transform: 'translateY(20px) rotate(180deg)' },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.03)',
          bottom: '-50px',
          left: '-50px',
          animation: 'float 8s ease-in-out infinite reverse',
        }}
      />

      {/* Main Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
          padding: '20px',
        }}
      >
        {/* Logo Container */}
        <Box
          sx={{
            width: isMobile ? 100 : 120,
            height: isMobile ? 100 : 120,
            borderRadius: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(255,255,255,0.2)' },
              '50%': { transform: 'scale(1.02)', boxShadow: '0 0 30px 10px rgba(255,255,255,0.1)' },
            },
          }}
        >
          <img
            src="/agt_logo.svg"
            alt="AGT"
            style={{
              width: isMobile ? '70px' : '85px',
              height: 'auto',
              filter: 'brightness(0) invert(1)',
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h1"
          sx={{
            color: '#FFFFFF',
            fontWeight: 300,
            fontSize: isMobile ? '28px' : '42px',
            textAlign: 'center',
            marginBottom: 1,
            letterSpacing: '-1px',
            textShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          Sistema de Reconciliação
        </Typography>

        <Typography
          variant="h2"
          sx={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: 600,
            fontSize: isMobile ? '20px' : '28px',
            textAlign: 'center',
            marginBottom: 6,
            letterSpacing: '-0.5px',
          }}
        >
          Contabilística e Fiscal
        </Typography>

        {/* Progress Section */}
        <Box
          sx={{
            width: isMobile ? '280px' : '320px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Progress Bar */}
          <Box
            sx={{
              width: '100%',
              height: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 2,
            }}
          >
            <Box
              sx={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#FFFFFF',
                borderRadius: 2,
                transition: 'width 0.1s linear',
                boxShadow: '0 0 10px rgba(255,255,255,0.5)',
              }}
            />
          </Box>

          {/* Loading Text */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                animation: 'dotPulse 1.4s ease-in-out infinite',
                '@keyframes dotPulse': {
                  '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
                  '40%': { opacity: 1, transform: 'scale(1)' },
                },
              }}
            />
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                animation: 'dotPulse 1.4s ease-in-out 0.2s infinite',
              }}
            />
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                animation: 'dotPulse 1.4s ease-in-out 0.4s infinite',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
            letterSpacing: '0.5px',
          }}
        >
          Administração Geral Tributária de Angola
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: '11px',
          }}
        >
          © 2024 AGT - Todos os direitos reservados
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingPage;
