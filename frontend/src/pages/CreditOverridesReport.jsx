import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert, Calendar, Download, Printer, Search,
  UserCheck, ShieldClose, RotateCcw, ShieldAlert as WarningIcon,
  FileText
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import { useNavigate } from 'react-router-dom';
import CurrencySymbol from '../components/CurrencySymbol';
import Pagination from '../components/Pagination';
import CustomSelect from '../components/CustomSelect';
import styles from './CreditOverridesReport.module.css';
import axios from 'axios';
import { API_BASE_URL } from '../constants';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function CreditOverridesReport() {
  const { settings, formatDate } = useSettings();
  const formatDateTimeSplit = (dateVal) => {
    if (!dateVal) return { date: 'N/A', time: '' };
    const formattedDate = formatDate(dateVal);
    if (formattedDate === 'N/A' || formattedDate === 'Invalid Date') return { date: formattedDate, time: '' };
    
    let d;
    try {
      d = new Date(dateVal);
    } catch(e) {
      return { date: formattedDate, time: '' };
    }
    if (isNaN(d.getTime())) return { date: formattedDate, time: '' };

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (settings.timeFormat === '12h' || !settings.timeFormat) {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
    return { date: formattedDate, time: formattedTime };
  };

  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';

  useEffect(() => {
    if (!isAuthorized) navigate('/');
  }, [isAuthorized, navigate]);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('Today');
  const [actionFilter, setActionFilter] = useState('APPROVED');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange, actionFilter, customStart, customEnd]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/users`);
        if (res.data) setStaffList(res.data);
      } catch (err) {
        console.error("Failed to fetch staff for mapping:", err);
      }
    };
    if (isAuthorized) fetchStaff();
  }, [isAuthorized]);

  const formatUser = (userIdOrFormatted) => {
    if (!userIdOrFormatted) return '—';
    if (userIdOrFormatted.includes(':')) return userIdOrFormatted;
    const staff = staffList.find(s => s.userId === userIdOrFormatted);
    if (staff) {
      const roleName = staff.role === 'super_admin' ? 'Super Admin' : staff.role.charAt(0).toUpperCase() + staff.role.slice(1).replace('_', ' ');
      return `${roleName}: ${staff.name}`;
    }
    return userIdOrFormatted;
  };

  const getDateBounds = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const parseLocal = (str) => {
      if (!str) return new Date();
      const parts = str.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    if (dateRange === 'Today') {
      const start = new Date(today);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }

    if (dateRange === 'This Month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: start, to: end };
    }
    if (dateRange === 'This Year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: start, to: end };
    }
    if (dateRange === 'Custom' && customStart && customEnd) {
      const start = parseLocal(customStart);
      start.setHours(0, 0, 0, 0);
      const end = parseLocal(customEnd);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    return null;
  };

  const fetchData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      const bounds = getDateBounds();

      let query = `SELECT * FROM credit_override_logs`;
      let params = [];
      const whereClauses = [];

      if (bounds) {
        whereClauses.push(`timestamp >= ? AND timestamp <= ?`);
        params.push(bounds.from.toISOString(), bounds.to.toISOString());
      } else if (dateRange === 'Custom') {
        setLogs([]);
        setLoading(false);
        return;
      }

      if (actionFilter !== 'All') {
        whereClauses.push(`actionType = ?`);
        params.push(actionFilter);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }

      query += ` ORDER BY timestamp DESC`;

      const res = await window.electronAPI.dbQuery(query, params);
      setLogs(res.success ? res.data : []);
    } catch (err) {
      console.error('Credit override logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized, dateRange, actionFilter, customStart, customEnd]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const name = (log.customerName || '').toLowerCase();
        const customerId = (log.customerId || '').toLowerCase();
        const orderId = (log.orderId || '').toLowerCase();
        const approvedBy = (log.managerId || '').toLowerCase();
        const staff = (log.userId || '').toLowerCase();
        if (!name.includes(q) && !customerId.includes(q) && !orderId.includes(q) && !approvedBy.includes(q) && !staff.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, searchTerm]);

  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredLogs, currentPage]);

  // KPIs
  const totalApproved = logs.filter(l => l.actionType === 'APPROVED').length;
  const totalFailed = logs.filter(l => l.actionType === 'FAILED_PIN').length;
  const totalRejected = logs.filter(l => l.actionType === 'REJECTED').length;

  const totals = useMemo(() => {
    let orderAmount = 0;
    let exceededAmount = 0;
    filteredLogs.forEach(log => {
      orderAmount += log.orderAmount || 0;
      exceededAmount += log.exceededAmount || 0;
    });
    return { orderAmount, exceededAmount };
  }, [filteredLogs]);

  const exportCSV = () => {
    const headers = ['Date', 'Customer Name', 'Customer ID', 'Order ID', 'Approved By', 'Order Amount', 'Credit Limit', 'Balance Before', 'Exceeded Amount', 'Action'];
    const rows = filteredLogs.map(log => [
      formatDate(log.timestamp),
      `"${log.customerName || ''}"`,
      `"${log.customerId || ''}"`,
      `"${log.orderId || 'N/A'}"`,
      `"${formatUser(log.userId)}"`,
      (log.orderAmount || 0).toFixed(2),
      (log.creditLimit || 0).toFixed(2),
      (log.outstandingBalance || 0).toFixed(2),
      (log.exceededAmount || 0).toFixed(2),
      log.actionType
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `credit_overrides_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // PDF DOWNLOAD
  const handleDownloadPDF = async () => {
    const filename = `Credit_Overrides_Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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

      const reportContainer = document.querySelector(`.${styles.page}`);
      if (!reportContainer) throw new Error("Report content not found");

      const clone = reportContainer.cloneNode(true);
      
      // Hide non-printable elements in the clone
      const headerActions = clone.querySelector(`.${styles.headerActions}`);
      if (headerActions) headerActions.style.display = 'none';

      const toolbar = clone.querySelector(`.${styles.toolbar}`);
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

  if (!isAuthorized) return null;

  return (
    <motion.div className={styles.page} variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div className={styles.headerRow} variants={itemVariants}>
        <div className={styles.headerInfo}>
          <h1>Credit Override Audit Log</h1>
        </div>
        <div className={styles.headerActions} data-noprint="true">
          <button 
            className="btn btn-secondary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#1E293B', fontWeight: '600' }} 
            onClick={exportCSV}
          >
            <Download size={18} /> Export CSV
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
      </motion.div>


      {/* Table Card */}
      <motion.div className={styles.tableCard} variants={itemVariants}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search customer, order ID, or approver..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.filterControls}>
            <CustomSelect
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              options={[
                { value: 'All Time', label: 'All Time' },
                { value: 'Today', label: 'Today' },
                { value: 'This Month', label: 'This Month' },
                { value: 'This Year', label: 'This Year' },
                { value: 'Custom', label: 'Custom Range' }
              ]}
              style={{ width: '185px' }}
            />
            {dateRange === 'Custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="premium-date-input"
                />
                <span className="premium-range-divider">to</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="premium-date-input"
                />
              </div>
            )}

            <CustomSelect
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Actions' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'FAILED_PIN', label: 'Failed PIN' },
                { value: 'REJECTED', label: 'Rejected/Blocked' }
              ]}
              style={{ width: '180px' }}
            />

            {searchTerm && (
              <button className={styles.clearBtn} onClick={() => setSearchTerm('')}>
                <RotateCcw size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className={styles.emptyRow}>Loading credit override logs…</div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyRow}>
            <WarningIcon size={40} color="#CBD5E1" />
            <p>No credit overrides found for the selection.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="base-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>ORDER ID</th>
                  <th>APPROVED BY</th>
                  <th className="num-col">ORDER AMOUNT</th>
                  <th className="num-col">LIMIT</th>
                  <th className="num-col">EXCEEDED</th>
                  <th className="center-col">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, idx) => {
                  let actionBadgeClass = styles.badgeRejected;
                  if (log.actionType === 'APPROVED') actionBadgeClass = styles.badgeApproved;
                  if (log.actionType === 'FAILED_PIN') actionBadgeClass = styles.badgeFailed;

                  return (
                    <tr key={log.id || idx} className={styles.tableRow}>
                      <td className={styles.dateCell}>
                        {(() => {
                          const { date: logDate, time: logTime } = formatDateTimeSplit(log.timestamp);
                          return (
                            <>
                              <div>{logDate}</div>
                              {logTime && (
                                <div className={styles.timeText}>{logTime}</div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <div className={styles.customerName}>{log.customerName || 'Walk-in'}</div>
                        <div className={styles.customerId}>{log.customerId}</div>
                      </td>
                      <td>
                        <span className={styles.billRef}>{log.orderId || '—'}</span>
                      </td>
                      <td>
                        <div className={styles.customerName}>{formatUser(log.userId)}</div>
                      </td>
                      <td className={`num-col ${styles.amountCell}`}>
                        <CurrencySymbol size={11} /> {(log.orderAmount || 0).toFixed(2)}
                      </td>
                      <td className={`num-col ${styles.amountCell}`}>
                        <CurrencySymbol size={11} /> {(log.creditLimit || 0).toFixed(2)}
                      </td>
                      <td className={`num-col ${styles.exceededCell}`}>
                        <CurrencySymbol size={11} /> {(log.exceededAmount || 0).toFixed(2)}
                      </td>
                      <td className="center-col">
                        <span className={`${styles.actionBadge} ${actionBadgeClass}`}>
                          {log.actionType}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredLogs.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#F8FAFC', fontWeight: 'bold', borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan="4" style={{ padding: '1rem', color: '#475569' }}>Total</td>
                    <td className="num-col" style={{ padding: '1rem' }}>
                      <CurrencySymbol size={11} /> {totals.orderAmount.toFixed(2)}
                    </td>
                    <td colSpan="2" className="num-col" style={{ padding: '1rem', color: '#EF4444' }}>
                      <CurrencySymbol size={11} /> {totals.exceededAmount.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredLogs.length / 20)}
            onPageChange={setCurrentPage}
            totalItems={filteredLogs.length}
            pageSize={20}
            itemLabel="entries"
          />
        )}
      </motion.div>
    </motion.div>
  );
}

function KPICard({ icon, bg, label, value, subtext }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.iconBox} style={{ background: bg }}>{icon}</div>
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}</span>
        <span className={styles.kpiSubtext}>{subtext}</span>
      </div>
    </div>
  );
}
