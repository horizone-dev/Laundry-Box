import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, Search, RefreshCw, Calendar, 
  DollarSign, CheckCircle, Clock, AlertTriangle,
  Printer, Download
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';
import styles from './Reports.module.css';

export default function NomodHistory() {
  const { settings, formatDate } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (settings.noModPayEnabled === false || settings.paymentHistoryEnabled === false) {
      navigate('/pos', { replace: true });
    }
  }, [settings.noModPayEnabled, settings.paymentHistoryEnabled, navigate]);

  if (settings.noModPayEnabled === false || settings.paymentHistoryEnabled === false) return null;
  
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    fetchNomodData();
  }, []);

  const fetchNomodData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const res = await window.electronAPI.dbQuery(
        `SELECT 
           checkoutId AS id,
           REPLACE(REPLACE(description, 'Order #', ''), 'LNK-', '') AS orderId,
           customerName,
           date AS createdAt,
           status,
           amount
         FROM payment_links
         WHERE checkoutId IS NOT NULL AND checkoutId != ''
         ORDER BY date DESC`,
        []
      );
      if (res.success) {
        setTxns(res.results || res.data || []);
      }
    } catch (err) {
      console.error("Failed to load Nomod transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTxns = txns.filter(t => {
    const matchesSearch = 
      !searchTerm || 
      t.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.orderId && t.orderId.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = filterStatus === 'All' || t.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const paginatedTxns = React.useMemo(() => {
    return filteredTxns.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredTxns, currentPage]);

  // Statistics calculation
  const totalCount = filteredTxns.length;
  const paidCount = filteredTxns.filter(t => t.status === 'Paid').length;
  const pendingCount = filteredTxns.filter(t => t.status === 'Pending').length;
  const expiredCount = filteredTxns.filter(t => t.status === 'Expired').length;
  const totalAmount = filteredTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const stats = [
    { label: 'Total Links', value: totalCount, icon: CreditCard, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Total Volume', value: totalAmount, isCurrency: true, icon: DollarSign, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Paid Payments', value: paidCount, icon: CheckCircle, color: '#059669', bg: '#D1FAE5' },
    { label: 'Pending Links', value: pendingCount, icon: Clock, color: '#D97706', bg: '#FEF3C7' },
  ];

  // PDF DOWNLOAD
  const handleDownloadPDF = async () => {
    const filename = `Nomod_Transaction_History_${new Date().toISOString().split('T')[0]}.pdf`;
    if (!window.electronAPI?.printToPDF) {
      if (window.appPrint) { window.appPrint(); } else { window.print(); }
      return;
    }

    try {
      let css = '';
      document.querySelectorAll('style').forEach(styleTag => {
        css += styleTag.innerHTML + '\n';
      });
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          css += rules.map(r => r.cssText).join('\n') + '\n';
        } catch (_) {}
      }

      const reportContainer = document.querySelector(`.${styles.reportsPage}`);
      if (!reportContainer) throw new Error("Report content not found");

      const clone = reportContainer.cloneNode(true);
      
      // Hide non-printable elements in the clone
      const headerActions = clone.querySelector(`.${styles.headerActions}`);
      if (headerActions) headerActions.style.display = 'none';

      const toolbar = clone.querySelector(`.${styles.tableToolbar}`);
      if (toolbar) toolbar.style.display = 'none';

      const pagination = clone.querySelector('[class*="pagination"]');
      if (pagination) pagination.style.display = 'none';

      const html = clone.outerHTML;

      await window.electronAPI.printToPDF({
        filename,
        html,
        css,
        pdfDownloadPath: settings.pdfDownloadPath || '',
        origin: window.location.origin,
        pageSize: 'A4'
      });

      alert(`Saved to Downloads: ${filename}`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Falling back to print.");
      if (window.appPrint) { window.appPrint(); } else { window.print(); }
    }
  };

  return (
    <div className={styles.reportsPage}>
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <h1>Nomod Transaction History</h1>
        </div>
        <div className={styles.headerActions} data-noprint="true">
          <button 
            className="btn btn-secondary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#1E293B', fontWeight: '600' }} 
            onClick={fetchNomodData}
          >
            <RefreshCw size={18} /> Refresh Data
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2563EB', border: '1px solid #2563EB', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={() => { if (window.appPrint) { window.appPrint(); } else { window.print(); } }}
          >
            <Printer size={18} /> Print Report
          </button>
          <button 
            className="btn btn-primary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#10B981', border: '1px solid #10B981', borderRadius: '8px', color: '#FFFFFF', fontWeight: '600' }} 
            onClick={handleDownloadPDF}
          >
            <Download size={18} /> Download PDF
          </button>
        </div>
      </div>


      <div className={styles.tableCard} style={{ marginTop: '0.75rem', background: 'white', borderRadius: '16px', padding: '0.75rem 1rem', border: '1px solid #E2E8F0' }}>
        <div className={styles.tableToolbar} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className={styles.searchBox} style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search by Order ID, Customer, or Checkout ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <CustomSelect
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Expired', label: 'Expired' }
              ]}
              style={{ width: '180px' }}
            />
          </div>
        </div>

          <div className="table-container">
            <table className="base-table">
              <thead>
                <tr>
                  <th>CHECKOUT ID</th>
                  <th>ORDER / DESC</th>
                  <th>CUSTOMER</th>
                  <th>CREATED AT</th>
                  <th className="center-col">STATUS</th>
                  <th className="num-col">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTxns.map((t, i) => (
                  <tr key={i} className={styles.tableRow}>
                    <td style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748B' }}>{t.id}</td>
                    <td style={{ fontWeight: 700, color: '#1E293B' }}>{t.orderId === 'Settlement' ? 'Settlement' : `Order #${t.orderId}`}</td>
                    <td style={{ fontSize: '0.9rem', color: '#334155' }}>{t.customerName}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748B' }}>{formatDate(t.createdAt)}</td>
                    <td className="center-col">
                      <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700,
                        background: t.status === 'Paid' ? '#DCFCE7' : (t.status === 'Expired' ? '#FEE2E2' : '#FEF3C7'),
                        color: t.status === 'Paid' ? '#166534' : (t.status === 'Expired' ? '#991B1B' : '#92400E')
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td className="num-col" style={{ fontWeight: 800, color: '#1E293B' }}>
                      <CurrencySymbol size={14} /> {parseFloat(t.amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {filteredTxns.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                      No Nomod transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredTxns.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={filteredTxns.length}
            pageSize={20}
            itemLabel="transactions"
          />
        )}
      </div>
    </div>
  );
}
