import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Services from './pages/Services';
import RevenueReport from './pages/RevenueReport';
import CustomerStatement from './pages/CustomerStatement';
import Expenses from './pages/Expenses';
import TaxReport from './pages/TaxReport';
import DailyTaxReport from './pages/DailyTaxReport';
import ZReport from './pages/ZReport';
import CancelledOrdersReport from './pages/CancelledOrdersReport';
import CreditOverridesReport from './pages/CreditOverridesReport';
import DeletedOrders from './pages/DeletedOrders';
import ExpectedDeliveries from './pages/ExpectedDeliveries';
import ServicesReport from './pages/ServicesReport';
import Invoice from './pages/Invoice';
import Login from './pages/Login';
import Users from './pages/Users';
import Accounts from './pages/Accounts';
import Settlement from './pages/Settlement';
import OutstandingBills from './pages/OutstandingBills';
import OverdueStatement from './pages/OverdueStatement';
import HelpCenter from './pages/HelpCenter';
import Activation from './pages/Activation';
import Workflow from './pages/Workflow';
import { SettingsProvider } from './store/SettingsContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    sessionStorage.getItem('isAuthenticated') === 'true'
  );

  return (
    <SettingsProvider>
      <HashRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={setIsAuthenticated} />} />
        <Route 
          path="/*" 
          element={
            isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="workflow" element={<Workflow />} />
          <Route path="orders">
            <Route index element={<Orders />} />
            <Route path="pending" element={<Orders isPendingView={true} />} />
            <Route path="expected-delivery" element={<ExpectedDeliveries />} />
            <Route path="deleted" element={<DeletedOrders />} />
            <Route path="cancelled" element={<CancelledOrdersReport />} />
          </Route>
          <Route path="customers" element={<Customers />} />
          <Route path="services">
            <Route index element={<Services defaultTab="list" />} />
            <Route path="list" element={<Services defaultTab="list" />} />
            <Route path="type" element={<Services defaultTab="type" />} />
            <Route path="addons" element={<Services defaultTab="addons" />} />
          </Route>
          <Route path="reports">
            <Route index element={<Navigate to="services" replace />} />
            <Route path="services" element={<ServicesReport />} />
            <Route path="revenue" element={<RevenueReport />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="customer-statement" element={<CustomerStatement />} />
            <Route path="customer-statement/:customerId" element={<CustomerStatement />} />
            <Route path="tax" element={<TaxReport />} />
            <Route path="daily-tax" element={<DailyTaxReport />} />
            <Route path="z-report" element={<ZReport />} />
            <Route path="cancelled" element={<CancelledOrdersReport />} />
            <Route path="credit-overrides" element={<CreditOverridesReport />} />
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
    </HashRouter>
    </SettingsProvider>
  );
}

export default App;
