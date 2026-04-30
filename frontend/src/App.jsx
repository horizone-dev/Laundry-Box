import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Services from './pages/Services';
import ServiceList from './pages/services/ServiceList';
import ServiceType from './pages/services/ServiceType';
import Addons from './pages/services/Addons';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Invoice from './pages/Invoice';
import Login from './pages/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={setIsAuthenticated} />} />
        <Route 
          path="/*" 
          element={
            isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<Customers />} />
          <Route path="services">
            <Route index element={<Services />} />
            <Route path="list" element={<ServiceList />} />
            <Route path="type" element={<ServiceType />} />
            <Route path="addons" element={<Addons />} />
          </Route>
          <Route path="reports" element={<Reports />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<Settings />} />
          <Route path="invoice/:id" element={<Invoice />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
