import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/template.css';
import LoginPage from './components/auth/LoginPage';
import MainLayout from './components/common/MainLayout';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import Configuracoes from './pages/Configuracoes';
import Documentos from './pages/Documentos';
import Motores from './pages/Motores';
import Relatorios from './pages/Relatorios';
import { PeriodoProvider } from './context/PeriodoContext';

function ProtectedRoute({ children }) {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RootRoute() {
  const user = localStorage.getItem('user');
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

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
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/empresas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Empresas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/analise" element={<Navigate to="/dashboard" replace />} />
          <Route path="/historico" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Configuracoes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Configuracoes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documentos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Documentos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/motores"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Motores />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/motores/:codigo"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Motores />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/reconciliacao" element={<Navigate to="/motores/M1" replace />} />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Relatorios />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PeriodoProvider>
      </Router>
    </>
  );
}

export default App;
