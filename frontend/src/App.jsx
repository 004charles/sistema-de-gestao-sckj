import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/template.css';
import LoginPage from './components/auth/LoginPage';
import MainLayout from './components/common/MainLayout';
import Documentos from './pages/Documentos';
import Confronto from './pages/Confronto';
import Facturas from './pages/Facturas';
import Pgc from './pages/Pgc';
import Legislacao from './pages/Legislacao';
import Definicoes from './pages/Definicoes';
import AdminGestao from './pages/AdminGestao';
import { PeriodoProvider } from './context/PeriodoContext';
import { adminService } from './services/api';

function ProtectedRoute({ children }) {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  try {
    const user = JSON.parse(userStr);
    if (user.is_admin || user.is_superuser || user.is_staff) {
      return children;
    }

    // Registo de segurança: utilizador cliente de empresa tentou entrar no Admin
    adminService
      .registrarTentativa({
        rota: window.location.pathname || '/admin-gestao',
        username: user.username || 'Cliente',
        motivo: 'Tentativa de navegação direta à Área Administrativa por empresa/utilizador cliente.',
      })
      .catch(() => {});

    toast.error(
      'Acesso Restrito: As empresas não têm permissão para aceder à Gestão Global do Administrador. A tentativa foi registada para auditoria de segurança.',
      { toastId: 'admin-access-denied' }
    );
  } catch {
    // fallback
  }
  return <Navigate to="/arquivo" replace />;
}

function RootRoute() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  return <Navigate to="/confronto" replace />;
}

/** Envolve uma página no layout e na guarda de sessão. */
const Pagina = ({ children }) => (
  <ProtectedRoute>
    <MainLayout>{children}</MainLayout>
  </ProtectedRoute>
);


function App() {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <Router>
        <PeriodoProvider>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<LoginPage onLogin={() => {}} />} />

            {/* Área Administrativa Master Multi-Empresa com Template Próprio */}
            <Route
              path="/admin-gestao"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminGestao />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/admin-gestao" replace />} />

            {/* Gestão Contabilística & Fiscal */}
            <Route path="/arquivo" element={<Pagina><Documentos /></Pagina>} />
            <Route path="/confronto" element={<Pagina><Confronto /></Pagina>} />
            <Route path="/facturas" element={<Pagina><Facturas /></Pagina>} />
            <Route path="/pgc" element={<Pagina><Pgc /></Pagina>} />
            <Route path="/legislacao" element={<Pagina><Legislacao /></Pagina>} />
            <Route path="/definicoes" element={<Pagina><Definicoes /></Pagina>} />

            {/* Redirecionamentos de rotas e aliases */}
            <Route path="/faturas" element={<Navigate to="/facturas" replace />} />
            <Route path="/scanner" element={<Navigate to="/facturas" replace />} />
            <Route path="/leitor" element={<Navigate to="/facturas" replace />} />
            <Route path="/reconciliacao" element={<Navigate to="/confronto" replace />} />
            <Route path="/analise" element={<Navigate to="/confronto" replace />} />
            <Route path="/historico" element={<Navigate to="/confronto" replace />} />
            <Route path="/diario" element={<Navigate to="/arquivo" replace />} />
            <Route path="/razao" element={<Navigate to="/arquivo" replace />} />
            <Route path="/balancete" element={<Navigate to="/arquivo" replace />} />
            <Route path="/balancetes" element={<Navigate to="/arquivo" replace />} />
            <Route path="/lancamentos" element={<Navigate to="/arquivo" replace />} />
            <Route path="/auditoria" element={<Navigate to="/confronto" replace />} />
            <Route path="/relatorio" element={<Navigate to="/confronto" replace />} />
            <Route path="/relatorios" element={<Navigate to="/confronto" replace />} />
            <Route path="/fiscal" element={<Navigate to="/legislacao" replace />} />
            <Route path="/codigos-fiscais" element={<Navigate to="/legislacao" replace />} />
            <Route path="/plano-contas" element={<Navigate to="/pgc" replace />} />
            <Route path="/plano" element={<Navigate to="/pgc" replace />} />
            <Route path="/dashboard" element={<Navigate to="/arquivo" replace />} />
            <Route path="/home" element={<Navigate to="/arquivo" replace />} />
            <Route path="/motores" element={<Navigate to="/confronto" replace />} />
            <Route path="/motores/:codigo" element={<Navigate to="/confronto" replace />} />
            <Route path="/auditoria-periodo" element={<Navigate to="/confronto" replace />} />
            <Route path="/documentos" element={<Navigate to="/arquivo" replace />} />
            <Route path="/empresas" element={<Navigate to="/definicoes" replace />} />
            <Route path="/configuracoes" element={<Navigate to="/definicoes" replace />} />
            <Route path="/perfil" element={<Navigate to="/definicoes" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PeriodoProvider>
      </Router>
    </>
  );
}

export default App;
