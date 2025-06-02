import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CompleteProfile from './pages/CompleteProfile';
import CreateFiche from './pages/CreateFiche';
import FicheDetail from './pages/FicheDetail';
import AdminAffectations from './pages/AdminAffectations';
import ObjectifsAnnuels from './pages/ObjectifsAnnuels';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/complete-profile" element={
            <PrivateRoute>
              <CompleteProfile />
            </PrivateRoute>
          } />
          <Route path="/" element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="fiches/create" element={<CreateFiche />} />
            <Route path="fiches/:id" element={<FicheDetail />} />
            <Route path="admin/affectations" element={<AdminAffectations />} />
            <Route path="objectifs-annuels" element={<ObjectifsAnnuels />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;