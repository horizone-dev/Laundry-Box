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

  if (!isAuthorized) return null;

  return (
    <motion.div className={styles.page} variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div className={styles.headerRow} variants={itemVariants}>
        <div className={styles.headerInfo}>
          <h1>Credit Override Audit Log</h1>
          <p className={styles.subtext}>Monitor all customer credit limit overrides, manager approvals, and failed attempts.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div className={styles.kpiGrid} variants={itemVariants}>
        <KPICard
          icon={<FileText size={20} color="#6366F1" />}
          bg="#EEF2FF"
          label="Total Override Attempts"
          value={logs.length.toLocaleString()}
          subtext="Total logged security overrides"
        />
        <KPICard
          icon={<UserCheck size={20} color="#10B981" />}
          bg="#ECFDF5"
          label="Approved Overrides"
          value={totalApproved.toLocaleString()}
          subtext="Successfully overridden by PIN"
        />
        <KPICard
          icon={<ShieldClose size={20} color="#EF4444" />}
          bg="#FEF2F2"
          label="Failed PIN Entries"
          value={totalFailed.toLocaleString()}
          subtext="Attempts with incorrect PIN"
        />
        <KPICard
          icon={<ShieldAlert size={20} color="#F59E0B" />}
          bg="#FFFBEB"
          label="Rejections & Blocks"
          value={totalRejected.toLocaleString()}
          subtext="Cancellations or hard blocks"
        />
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
            <select
              className={styles.filterSelect}
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
            >
              <option value="All Time">All Time</option>
              <option value="Today">Today</option>
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
              <option value="Custom">Custom Range</option>
            </select>
            {dateRange === 'Custom' && (
              <div className={styles.customDates}>
                <input type="date" className={styles.dateInput} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span className={styles.dateSep}>to</span>
                <input type="date" className={styles.dateInput} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}

            <select
              className={styles.filterSelect}
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="All">All Actions</option>
              <option value="APPROVED">Approved</option>
              <option value="FAILED_PIN">Failed PIN</option>
              <option value="REJECTED">Rejected/Blocked</option>
            </select>

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
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>ORDER ID</th>
                  <th>APPROVED BY</th>
                  <th className={styles.numCol}>ORDER AMOUNT</th>
                  <th className={styles.numCol}>LIMIT</th>
                  <th className={styles.numCol}>EXCEEDED</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
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
                      <td className={`${styles.amountCell} ${styles.numCol}`}>
                        <CurrencySymbol size={11} /> {(log.orderAmount || 0).toFixed(2)}
                      </td>
                      <td className={`${styles.amountCell} ${styles.numCol}`}>
                        <CurrencySymbol size={11} /> {(log.creditLimit || 0).toFixed(2)}
                      </td>
                      <td className={`${styles.exceededCell} ${styles.numCol}`}>
                        <CurrencySymbol size={11} /> {(log.exceededAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`${styles.actionBadge} ${actionBadgeClass}`}>
                          {log.actionType}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
