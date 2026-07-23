import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientForm from './pages/ClientForm';
import PlanTemplates from './pages/PlanTemplates';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('superadmin_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/plan-templates" 
          element={
            <ProtectedRoute>
              <PlanTemplates />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/add-client" 
          element={
            <ProtectedRoute>
              <ClientForm />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/edit-client/:id" 
          element={
            <ProtectedRoute>
              <ClientForm isEdit />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
