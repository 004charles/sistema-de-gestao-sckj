import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#003D99',
      dark: '#002266',
      light: '#E6F0FF',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0066CC',
      dark: '#004499',
      light: '#F0F7FF',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    success: {
      main: '#16A34A',
    },
    warning: {
      main: '#F59E0B',
    },
    error: {
      main: '#DC2626',
    },
    grey: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '32px',
      fontWeight: 700,
    },
    h2: {
      fontSize: '24px',
      fontWeight: 700,
    },
    h3: {
      fontSize: '18px',
      fontWeight: 600,
    },
    body1: {
      fontSize: '14px',
    },
    body2: {
      fontSize: '13px',
    },
  },
  shape: {
    borderRadius: '8px',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: '8px',
          padding: '10px 20px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #003D99, #002266)',
          boxShadow: '0 2px 8px rgba(0,61,153,0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #002266, #001133)',
            boxShadow: '0 4px 12px rgba(0,61,153,0.4)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '& fieldset': {
              borderColor: '#E2E8F0',
            },
            '&:hover fieldset': {
              borderColor: '#003D99',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#003D99',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
  },
});

export default theme;
