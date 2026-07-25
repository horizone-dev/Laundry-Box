import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';
import styles from './FinancialIntegrity.module.css';

const ISSUE_SECTIONS = [
  {
    key: 'balanceMismatches',
    title: 'Balance differences',
    description: 'Saved customer balance differs from the new read-only calculation.',
    columns: ['Customer', 'Saved balance', 'Calculated balance', 'Saved advance', 'Calculated advance'],
    row: (item, currency) => [
      item.customerName || item.customerId,
      formatAmount(item.savedBalance, currency),
      formatAmount(item.canonicalBalance, currency),
      formatAmount(item.savedAdvance, currency),
      formatAmount(item.canonicalAdvance, currency)
    ],
    customerId: (item) => item.customerId
  },
  {
    key: 'ambiguousConvertedDeletes',
    title: 'Deleted orders needing review',
    description: 'A converted-to-advance deleted order has no clear usable receipt in the current history.',
    columns: ['Customer', 'Order', 'Paid amount', 'Reason'],
    row: (item, currency) => [
      item.customerName || item.customerId,
      item.orderId,
      formatAmount(item.paidAmount, currency),
      item.reason
    ],
    customerId: (item) => item.customerId
  },
  {
    key: 'overAllocatedSources',
    title: 'Legacy advance allocations',
    description: 'The amount applied from a source receipt is larger than that receipt amount.',
    columns: ['Customer', 'Receipt', 'Method', 'Source amount', 'Applied amount'],
    row: (item, currency) => [
      item.customerName || item.customerId,
      item.paymentId,
      item.method,
      formatAmount(item.sourceAmount, currency),
      formatAmount(item.amountUsed, currency)
    ],
    customerId: (item) => item.customerId
  },
  {
    key: 'orphanAllocations',
    title: 'Orphan allocations',
    description: 'An advance allocation refers to a missing receipt or order.',
    columns: ['Allocation', 'Receipt', 'Order', 'Amount'],
    row: (item, currency) => [item.id, item.paymentId || 'Missing', item.orderId || 'Missing', formatAmount(item.amountUsed, currency)]
  },
  {
    key: 'invalidOrderAmounts',
    title: 'Order amounts needing review',
    description: 'Paid amount or due amount is outside the normal order range. These are never changed automatically.',
    columns: ['Order', 'Customer', 'Order total', 'Paid', 'Due', 'Status'],
    row: (item, currency) => [
      item.id,
      item.customerId,
      formatAmount(item.totalAmount, currency),
      formatAmount(item.paidAmount, currency),
      formatAmount(item.dueAmount, currency),
      item.status || item.paymentStatus || '—'
    ]
  }
];

function formatAmount(value, currency) {
  const amount = Number(value) || 0;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryCard({ label, value, warning = false }) {
  return (
    <article className={`${styles.summaryCard} ${warning && value > 0 ? styles.summaryCardWarning : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function FinancialIntegrity() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAuthorized = user.role === 'super_admin' || user.role === 'manager';
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAudit = useCallback(async () => {
    if (!isAuthorized) return;
    if (!window.electronAPI?.getFinancialAudit) {
      setError('Financial audit is unavailable in this application build.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getFinancialAudit();
      if (!result?.success) throw new Error(result?.error || 'Unable to load financial audit.');
      setAudit(result.data);
    } catch (loadError) {
      console.error('Financial integrity audit failed:', loadError);
      setError(loadError.message || 'Unable to load financial audit.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/pos', { replace: true });
      return;
    }
    loadAudit();
  }, [isAuthorized, loadAudit, navigate]);

  const summary = audit?.summary;
  const currency = settings.currencySymbol || 'AED';

  if (!isAuthorized) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}><ShieldCheck size={16} /> Finance safety check</div>
          <h1>Financial Integrity</h1>
          <p>This report is read-only. It never changes customer balances, payments, advances, refunds, or orders.</p>
        </div>
        <button className={styles.refreshButton} type="button" onClick={loadAudit} disabled={loading}>
          <RefreshCw size={17} className={loading ? styles.spinning : ''} />
          Refresh
        </button>
      </header>

      {error && <div className={styles.error}><AlertTriangle size={18} /> {error}</div>}

      {loading && !audit ? (
        <div className={styles.empty}>Checking financial records…</div>
      ) : audit && (
        <>
          <section className={styles.summaryGrid} aria-label="Financial integrity summary">
            <SummaryCard label="Customers checked" value={summary.customersChecked} />
            <SummaryCard label="Balance differences" value={summary.balanceMismatches} warning />
            <SummaryCard label="Deleted orders to review" value={summary.ambiguousConvertedDeletes} warning />
            <SummaryCard label="Advance allocation issues" value={summary.overAllocatedSources} warning />
            <SummaryCard label="Orphan allocations" value={summary.orphanAllocations} warning />
            <SummaryCard label="Order amount issues" value={summary.invalidOrderAmounts} warning />
          </section>

          <div className={styles.generated}>Generated: {new Date(audit.generatedAt).toLocaleString()}</div>

          {ISSUE_SECTIONS.map((section) => {
            const rows = audit.samples?.[section.key] || [];
            const total = summary[section.key] || 0;
            return (
              <section className={styles.section} key={section.key}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                  <span className={total ? styles.issueCount : styles.clearCount}>{total ? `${total} review` : 'Clear'}</span>
                </div>

                {rows.length ? (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          {section.columns.map((column) => <th key={column}>{column}</th>)}
                          {section.customerId && <th aria-label="Open customer statement" />}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item, index) => (
                          <tr key={`${section.key}-${item.id || item.orderId || item.paymentId || index}`}>
                            {section.row(item, currency).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                            {section.customerId && (
                              <td>
                                <button
                                  type="button"
                                  className={styles.statementButton}
                                  onClick={() => navigate(`/reports/customer-statement/${section.customerId(item)}`)}
                                >
                                  Statement
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {total > rows.length && <p className={styles.sampleNote}>Showing the first {rows.length} of {total} records.</p>}
                  </div>
                ) : (
                  <div className={styles.clearState}><CheckCircle2 size={18} /> No issues found in this check.</div>
                )}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
