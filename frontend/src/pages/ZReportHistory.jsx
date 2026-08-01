import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Printer, FileText, ArrowUpRight, ArrowDownRight, RefreshCw,
  Eye, Download, ChevronDown, CheckSquare, Clock, TrendingUp, CreditCard,
  X, Receipt, Box, Users, DollarSign, Shirt, AlertTriangle
} from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import { t } from '../utils/translations';
import styles from './ZReport.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.02 } }
};

export default function ZReportHistory() {
  const { settings, formatDate } = useSettings();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!window.electronAPI?.dbQuery) return;
    try {
      setLoading(true);
      await window.electronAPI.dbQuery(
        `CREATE TABLE IF NOT EXISTS z_reports (
          id TEXT PRIMARY KEY,
          startTime TEXT,
          endTime TEXT,
          businessDate TEXT,
          openingFloat REAL,
          actualCashCounted REAL,
          expectedCash REAL,
          cashDifference REAL,
          cashWithdrawals REAL,
          closedBy TEXT,
          ordersCount INTEGER,
          grossSales REAL,
          netSales REAL,
          vatCollected REAL,
          grandTotal REAL,
          totalCollected REAL,
          cashSales REAL,
          cardSales REAL,
          bankTransfer REAL,
          nomodSales REAL,
          creditSales REAL,
          partialPayments REAL,
          otherPayments REAL,
          detailsJson TEXT
        );`, []
      );
      const res = await window.electronAPI.dbQuery(
        `SELECT * FROM z_reports ORDER BY endTime DESC`, []
      );
      if (res.success) {
        setReports(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch Z Report history:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(rep => {
    const term = searchTerm.toLowerCase();
    return (
      rep.businessDate.includes(term) ||
      (rep.closedBy || '').toLowerCase().includes(term) ||
      rep.id.toLowerCase().includes(term)
    );
  });

  const handleOpenReport = (rep) => {
    let parsedDetails = {};
    try {
      if (rep && rep.detailsJson) {
        parsedDetails = JSON.parse(rep.detailsJson);
      }
    } catch (e) {
      console.warn("Error parsing report details JSON:", e);
    }
    setSelectedReport({
      ...rep,
      details: parsedDetails || {}
    });
    setShowDetailModal(true);
  };

  const handlePrintSelected = () => {
    window.print();
  };

  return (
    <motion.div
      className={styles.zReportPage}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Row */}
      <div className={`${styles.headerRow} no-print`}>
        <div className={styles.headerTitleArea}>
          <div className={styles.iconCircle}>
            <Clock size={22} color="var(--primary)" />
          </div>
          <div>
            <h1>Z Report History</h1>
            <p className={styles.subtext}>View and audit past closed Z-reports</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.datePicker}>
            <Calendar size={16} />
            <input
              type="text"
              placeholder="Search date, manager..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.dateInput}
              style={{ width: '180px' }}
            />
          </div>
          <button className={styles.iconBtn} onClick={fetchHistory} title="Refresh History">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <RefreshCw size={36} className={styles.spinner} />
          <p>Loading historical Z-report logs...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '1.5rem' }}>
          <FileText size={48} color="#94A3B8" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#1E293B', fontWeight: 600, fontSize: '1.1rem' }}>No Z-Reports Found</h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>No Z-reports have been locked and closed yet.</p>
        </div>
      ) : (
        <div className={`no-print ${styles.historyCard}`}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>REPORT ID</th>
                <th>BUSINESS DATE</th>
                <th>CLOSED AT</th>
                <th>CLOSED BY</th>
                <th style={{ textAlign: 'right' }}>EXPECTED CASH</th>
                <th style={{ textAlign: 'right' }}>ACTUAL CASH</th>
                <th style={{ textAlign: 'right' }}>DISCREPANCY</th>
                <th style={{ textAlign: 'right' }}>GRAND TOTAL</th>
                <th style={{ textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((rep) => {
                const diff = rep.cashDifference || 0;
                const isMatched = diff === 0;
                return (
                  <tr key={rep.id} className={styles.historyRow} onClick={() => handleOpenReport(rep)}>
                    <td style={{ fontWeight: 600, color: '#334155' }}>{rep.id}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{formatDate(rep.businessDate)}</td>
                    <td>{rep.endTime ? new Date(rep.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                    <td>{rep.closedBy || 'Manager'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}><CurrencySymbol /> {(rep.expectedCash || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}><CurrencySymbol /> {(rep.actualCashCounted || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`${styles.badge} ${isMatched ? styles.badgeSuccess : diff > 0 ? styles.badgeWarning : styles.badgeDanger}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}><CurrencySymbol /> {(rep.grandTotal || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenReport(rep)}
                        className={styles.viewBtn}
                      >
                        <Eye size={14} />
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Modal view mirroring the original Z-Report Page style */}
      {showDetailModal && selectedReport && (
        <div className={styles.modalOverlay} style={{ zIndex: 9999 }}>
          <div className={styles.modalContainer} style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.modalHeader} no-print`} style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={24} color="var(--primary)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Historical Z Close Report [{selectedReport.id || ''}]</h2>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={handlePrintSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={16} /> Print Report
                </button>
                <button className={styles.closeModalBtn} onClick={() => { setShowDetailModal(false); setSelectedReport(null); }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={styles.reportLayout}>
              {/* 1. Report Metadata */}
              <div className={styles.sectionCard}>
                <div className={styles.metaGrid}>
                  <div>
                    <span className={styles.metaLabel}>Business Date</span>
                    <span className={styles.metaVal}>{formatDate(selectedReport.businessDate)}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Report ID</span>
                    <span className={styles.metaVal}>{selectedReport.id || ''}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>POS Terminal</span>
                    <span className={styles.metaVal}>Terminal 01</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Closed By</span>
                    <span className={styles.metaVal}>{selectedReport.closedBy || 'Manager'}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Status</span>
                    <span className={styles.metaVal} style={{ color: '#10B981', fontWeight: 800 }}>LOCKED & CLOSED</span>
                  </div>
                </div>
              </div>

              {/* 2. Business Information */}
              <div className={styles.sectionCard}>
                <h3 className={styles.sectionTitle}><Clock size={16} /> Business Operation Times</h3>
                <div className={styles.metaGrid}>
                  <div>
                    <span className={styles.metaLabel}>Session Start</span>
                    <span className={styles.metaVal}>{selectedReport.startTime ? new Date(selectedReport.startTime).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Session End (Closed At)</span>
                    <span className={styles.metaVal}>{selectedReport.endTime ? new Date(selectedReport.endTime).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>



              {/* 4. Revenue Summary & Tax */}
              <div className={styles.gridTwoCols}>
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Revenue Summary</h3>
                  <table className={styles.dataTable}>
                    <tbody>
                      <tr>
                        <td>Gross Sales (Items Subtotal)</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.grossSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr style={{ color: '#DC2626' }}>
                        <td>Total Discounts Applied</td>
                        <td className="text-right">- <CurrencySymbol /> {(selectedReport.details?.metrics?.totalDiscount || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={styles.highlightRow}>
                        <td>Net Revenue</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.netSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>VAT Collected</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.vatCollected || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={styles.grandTotalRow}>
                        <td>Grand Total</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.grandTotal || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 5. Payment Breakdown */}
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Payment Breakdown</h3>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Payment Method</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Cash Collections</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.cashSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Card Terminal</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.cardSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Bank Transfer</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.bankTransfer || 0).toFixed(2)}</td>
                      </tr>
                      {settings.enableNomod && (
                        <tr>
                          <td>Nomod Payments</td>
                          <td className="text-right"><CurrencySymbol /> {(selectedReport.nomodSales || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>On Account / Credit sales</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.creditSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={styles.highlightRow}>
                        <td>Total Collections</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.totalCollected || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. Cash Drawer Reconciliation */}
              <div className={styles.gridTwoCols}>
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}><CheckSquare size={16} /> Cash Drawer Reconciliation</h3>
                  <table className={styles.dataTable}>
                    <tbody>
                      <tr>
                        <td>Opening Drawer Float</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.openingFloat || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>(+) Cash Sales</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.cashSales || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>(+) Cash Credit Collections</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.cashCreditCollections || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>(+) Cash Advance / Deposits</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.cashAdvancePayments || 0).toFixed(2)}</td>
                      </tr>
                      <tr style={{ color: '#DC2626' }}>
                        <td>(-) Cash Refunds Processed</td>
                        <td className="text-right">- <CurrencySymbol /> {(selectedReport.details?.metrics?.cashRefunds || 0).toFixed(2)}</td>
                      </tr>
                      <tr style={{ color: '#DC2626' }}>
                        <td>(-) Cash Expenses Paid</td>
                        <td className="text-right">- <CurrencySymbol /> {(selectedReport.details?.metrics?.cashExpenses || 0).toFixed(2)}</td>
                      </tr>
                      <tr style={{ color: '#DC2626' }}>
                        <td>(-) Cash Withdrawals / Drops</td>
                        <td className="text-right">- <CurrencySymbol /> {(selectedReport.cashWithdrawals || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={styles.highlightRow}>
                        <td>Expected Cash In Drawer</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.expectedCash || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Actual Cash Counted</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.actualCashCounted || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={(selectedReport.cashDifference || 0) === 0 ? styles.successRow : styles.dangerRow}>
                        <td style={{ fontWeight: 800 }}>Discrepancy / Difference</td>
                        <td className="text-right" style={{ fontWeight: 800 }}>
                          {(selectedReport.cashDifference || 0) > 0 ? '+' : ''}<CurrencySymbol /> {(selectedReport.cashDifference || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}><Shirt size={16} /> Garment & Service Summaries</h3>
                  <div className={styles.statsList}>
                    <div className={styles.statLine}><span>Total Pieces Processed</span><strong>{selectedReport.details?.metrics?.totalPieces || 0}</strong></div>
                    <div className={styles.statLine}><span>Express Items Count</span><strong>{selectedReport.details?.metrics?.expressPieces || 0}</strong></div>
                  </div>
                </div>
              </div>

              {/* 7. Service Wise Sales & Garments Diagnostics */}
              <div className={styles.gridTwoCols}>
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Service Performance</h3>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Service Category</th>
                        <th className="text-right">Quantity</th>
                        <th className="text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedReport.details?.metrics?.serviceSales || Object.keys(selectedReport.details?.metrics?.serviceSales || {}).length === 0 ? (
                        <tr><td colSpan="3" className="text-center">No service records today</td></tr>
                      ) : (
                        Object.entries(selectedReport.details?.metrics?.serviceSales || {})
                          .sort((a, b) => (b[1]?.revenue || 0) - (a[1]?.revenue || 0))
                          .map(([name, data]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td className="text-right">{data?.qty || 0}</td>
                              <td className="text-right"><CurrencySymbol /> {(data?.revenue || 0).toFixed(2)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Garment Diagnostics</h3>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Garment Item</th>
                        <th className="text-right">Pieces</th>
                        <th className="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedReport.details?.metrics?.garmentSummary || Object.keys(selectedReport.details?.metrics?.garmentSummary || {}).length === 0 ? (
                        <tr><td colSpan="3" className="text-center">No garment items processed today</td></tr>
                      ) : (
                        Object.entries(selectedReport.details?.metrics?.garmentSummary || {})
                          .sort((a, b) => (b[1]?.revenue || 0) - (a[1]?.revenue || 0))
                          .slice(0, 8)
                          .map(([name, data]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td className="text-right">{data?.pieces || 0}</td>
                              <td className="text-right"><CurrencySymbol /> {(data?.revenue || 0).toFixed(2)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 8. Expenses */}
              <div className={styles.sectionCard}>
                <h3 className={styles.sectionTitle}>Store Expenses summary</h3>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Expense Category</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedReport.details?.expenses || (selectedReport.details?.expenses || []).length === 0 ? (
                      <tr><td colSpan="2" className="text-center">No expenses logged today</td></tr>
                    ) : (
                      (selectedReport.details?.expenses || []).map((exp, idx) => (
                        <tr key={idx}>
                          <td>{exp?.title || ''} ({exp?.category || 'Other'})</td>
                          <td className="text-right"><CurrencySymbol /> {(exp?.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 9. Discounts & Refunds */}
              <div className={styles.gridTwoCols}>
                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Discount Diagnostics</h3>
                  <table className={styles.dataTable}>
                    <tbody>
                      <tr>
                        <td>Order Discount</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.orderDiscounts || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Settle Discount</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.settleDiscounts || 0).toFixed(2)}</td>
                      </tr>
                      <tr className={styles.highlightRow}>
                        <td>Total Discounts</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.totalDiscount || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.sectionCard}>
                  <h3 className={styles.sectionTitle}>Refund & Returns Diagnostics</h3>
                  <table className={styles.dataTable}>
                    <tbody>
                      <tr>
                        <td>Refund Count</td>
                        <td className="text-right">{selectedReport.details?.metrics?.refundCount || 0}</td>
                      </tr>
                      <tr>
                        <td>Total Amount Refunded</td>
                        <td className="text-right"><CurrencySymbol /> {(selectedReport.details?.metrics?.refundAmount || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* print thermal footer */}
              <div className="print-only" style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', borderTop: '1px dashed #E2E8F0', paddingTop: '1rem' }}>
                <p>This Z Close report is historical and locked.</p>
                <p>Report ID: {selectedReport.id || ''}</p>
                <p>Closed At: {selectedReport.endTime ? new Date(selectedReport.endTime).toLocaleString() : 'N/A'}</p>
                <p>Laundry Box POS Software</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
