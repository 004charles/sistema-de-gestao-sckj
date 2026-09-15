import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Select,
  FormControl,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Psychology as PsychologyIcon,
  ExitToApp as ExitToAppIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const DRAWER_WIDTH = 260;

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const menuItems = [
    { text: t('navigation.home'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('navigation.accounting'), icon: <PsychologyIcon />, path: '/analise' },
  ];

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleLanguageChange = (event) => {
    i18n.changeLanguage(event.target.value);
  };

  const drawer = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', backgroundColor: '#FFFFFF' }}>
      {/* Logo */}
      <Box
        sx={{
          px: 3,
          py: 3,
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img src="/agt_logo.png" alt="AGT" style={{ height: '40px' }} />
      </Box>

      {/* Menu */}
      <List sx={{ px: 2, pt: 3 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem
              key={item.text}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                cursor: 'pointer',
                backgroundColor: isActive ? '#F0F7FF' : 'transparent',
                borderRadius: '10px',
                mb: 1,
                px: 2,
                py: 1.5,
                border: isActive ? '1px solid #BFDBFE' : '1px solid transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: isActive ? '#F0F7FF' : '#F8FAFC',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? '#003D99' : '#64748B',
                  minWidth: 36,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#003D99' : '#334155',
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          backgroundColor: '#FFFFFF',
          boxShadow: 'none',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: '56px', sm: '64px' }, px: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ display: { sm: 'none' }, color: '#334155', p: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography sx={{ color: '#0F172A', fontWeight: 600, fontSize: { xs: '14px', sm: '16px' } }}>
              {menuItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={i18n.language?.substring(0, 2) || 'pt'}
                onChange={handleLanguageChange}
                sx={{
                  fontSize: '12px',
                  height: '32px',
                  '& .MuiSelect-select': { py: 0.5 },
                }}
              >
                <MenuItem value="pt">{t('language.portuguese')}</MenuItem>
                <MenuItem value="en">{t('language.english')}</MenuItem>
                <MenuItem value="zh">{t('language.chinese')}</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title={t('language.selectLanguage')}>
              <IconButton sx={{ p: 0.5, color: '#64748B' }}>
                <LanguageIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Perfil">
              <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
                <Avatar
                  sx={{
                    width: { xs: 32, sm: 36 },
                    height: { xs: 32, sm: 36 },
                    background: 'linear-gradient(135deg, #003D99, #002266)',
                    fontSize: { xs: '12px', sm: '14px' },
                    fontWeight: 600,
                  }}
                >
                  {user.username?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 180,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                },
              }}
            >
              <MenuItem onClick={handleMenuClose} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" sx={{ color: '#64748B' }} />
                </ListItemIcon>
                <Typography variant="body2" sx={{ fontSize: '14px' }}>{t('navigation.profile') || 'Meu Perfil'}</Typography>
              </MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <ExitToAppIcon fontSize="small" sx={{ color: '#DC2626' }} />
                </ListItemIcon>
                <Typography variant="body2" sx={{ color: '#DC2626', fontSize: '14px' }}>
                  {t('navigation.logout')}
                </Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: '1px solid #E2E8F0',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid #E2E8F0',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          backgroundColor: '#FFFFFF',
          minHeight: '100vh',
          marginTop: { xs: '56px', sm: '64px' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
