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
import RevenueReport from './pages/RevenueReport';
import Expenses from './pages/Expenses';
import Invoice from './pages/Invoice';
import Login from './pages/Login';
import Users from './pages/Users';
import Accounts from './pages/Accounts';
import Settlement from './pages/Settlement';
import OutstandingBills from './pages/OutstandingBills';
import OverdueStatement from './pages/OverdueStatement';
import HelpCenter from './pages/HelpCenter';
import Activation from './pages/Activation';
import { SettingsProvider } from './store/SettingsContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    sessionStorage.getItem('isAuthenticated') === 'true'
  );

  return (
    <SettingsProvider>
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
          <Route path="orders">
            <Route index element={<Orders />} />
            <Route path="pending" element={<Orders isPendingView={true} />} />
          </Route>
          <Route path="customers" element={<Customers />} />
          <Route path="services">
            <Route index element={<Services />} />
            <Route path="list" element={<ServiceList />} />
            <Route path="type" element={<ServiceType />} />
            <Route path="addons" element={<Addons />} />
          </Route>
          <Route path="reports">
            <Route index element={<Reports />} />
            <Route path="revenue" element={<RevenueReport />} />
            <Route path="expenses" element={<Expenses />} />
          </Route>
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="accounts/:type" element={<Accounts />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="outstanding-bills" element={<OutstandingBills />} />
          <Route path="invoice/:id" element={<Invoice />} />
          <Route path="overdue-statement/:customerId" element={<OverdueStatement />} />
          <Route path="activation" element={<Activation />} />
          <Route path="help" element={<HelpCenter />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
