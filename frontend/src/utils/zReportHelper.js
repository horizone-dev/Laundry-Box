// Helper function to calculate Z-Report metrics and auto-close the session if needed
import { DEFAULT_SHOP_ID } from '../constants';

export async function fetchAndCalculateMetrics(dbQuery, startTime, endTime, settings, targetDate) {
  const taxMethod = settings?.taxMethod || 'inclusive';
  const taxRate = settings?.taxRate || 5;

  // Helper for tax calculations
  const calculateOrderTax = (order) => {
    let items = [];
    try { items = JSON.parse(order.items || '[]'); } catch (e) {}
    let vat = 0;
    
    // Addon calculation
    let addonsTotal = 0;
    items.forEach(item => {
      if (item.addons && Array.isArray(item.addons)) {
        item.addons.forEach(addon => {
          const price = typeof addon === 'string' ? 0 : addon?.price || 0;
          addonsTotal += price * (item.qty || 1);
        });
      }
    });

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0) + addonsTotal;
    const rate = taxRate / 100;

    if (taxMethod === 'inclusive') {
      vat = subtotal - (subtotal / (1 + rate));
    } else {
      vat = subtotal * rate;
    }
    return vat;
  };

  // Queries
  const ordersRes = await dbQuery(
    `SELECT * FROM orders WHERE createdAt >= ? AND createdAt <= ? AND COALESCE(status, '') NOT IN ('Deleted', 'Cancelled')`, [startTime, endTime]
  );
  const expensesRes = await dbQuery(
    `SELECT * FROM expenses WHERE date = ?`, [targetDate]
  );
  const txnsRes = await dbQuery(
    `SELECT * FROM account_transactions WHERE date >= ? AND date <= ?`, [startTime, endTime]
  );
  const deletedRes = await dbQuery(
    `SELECT * FROM deleted_orders WHERE deletedAt >= ? AND deletedAt <= ?`, [startTime, endTime]
  );
  const paymentsRes = await dbQuery(
    `SELECT * FROM payments WHERE createdAt >= ? AND createdAt <= ?`, [startTime, endTime]
  );

  const activeOrders = ordersRes.success ? ordersRes.data : [];
  const expenses = expensesRes.success ? expensesRes.data : [];
  const transactions = txnsRes.success ? txnsRes.data : [];
  const allDeletedOrders = deletedRes.success ? deletedRes.data : [];
  const payments = paymentsRes.success ? paymentsRes.data : [];

  // Totals
  const totalOrders = activeOrders.length;
  const deliveredOrders = activeOrders.filter(o => o.status === 'Delivered').length;
  const pendingOrders = totalOrders - deliveredOrders;
  const cancelledOrders = activeOrders.filter(o => o.status === 'Cancelled').length;

  let totalPieces = 0;
  let expressPieces = 0;
  let expressCount = 0;
  let deliveryCount = 0;
  let pickupCount = 0;
  const garmentSummary = {};
  const serviceSales = {};

  activeOrders.forEach(o => {
    let itemsList = [];
    try { itemsList = JSON.parse(o.items || '[]'); } catch (err) { }
    itemsList.forEach(item => {
      const qty = item.qty || 1;
      totalPieces += qty;

      const sName = item.serviceName || item.service || 'General Service';
      if (!serviceSales[sName]) serviceSales[sName] = { qty: 0, revenue: 0 };
      serviceSales[sName].qty += qty;
      serviceSales[sName].revenue += (item.price * qty);

      const gName = item.name || 'General Item';
      if (!garmentSummary[gName]) garmentSummary[gName] = { pieces: 0, revenue: 0 };
      garmentSummary[gName].pieces += qty;
      garmentSummary[gName].revenue += (item.price * qty);

      if (item.deliveryMethod?.toLowerCase() === 'delivery') deliveryCount++;
      if (item.deliveryMethod?.toLowerCase() === 'pickup') pickupCount++;
      if (item.name?.toLowerCase().includes('express') || item.type?.toLowerCase().includes('express')) {
        expressPieces += qty;
      }
    });
  });

  // Financial Totals
  let grossSales = 0;
  let deliveryCharges = 0;
  let expressCharges = 0;
  let additionalCharges = 0;
  let vatCollected = 0;

  const orderDiscounts = payments
    .filter(p => p.method?.toLowerCase() === 'discount' && p.discountScope !== 'settlement')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const settleDiscounts = payments
    .filter(p => p.method?.toLowerCase() === 'discount' && p.discountScope === 'settlement')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalDiscount = orderDiscounts + settleDiscounts;

  activeOrders.forEach(o => {
    let itemsList = [];
    try { itemsList = JSON.parse(o.items || '[]'); } catch (err) { }
    const subtotal = itemsList.reduce((sum, item) => sum + (item.price * item.qty), 0);
    grossSales += subtotal;
    vatCollected += calculateOrderTax(o);

    itemsList.forEach(item => {
      if (item.addons && Array.isArray(item.addons)) {
        item.addons.forEach(addon => {
          const isStr = typeof addon === 'string';
          const addName = (isStr ? addon : addon?.name || '').toLowerCase();
          const addAmt = (isStr ? 0 : addon?.price || 0) * (item.qty || 1);
          if (addName.includes('express')) {
            expressCharges += addAmt;
          } else if (addName.includes('delivery')) {
            deliveryCharges += addAmt;
          } else {
            additionalCharges += addAmt;
          }
        });
      }
    });
  });

  const netSales = grossSales + additionalCharges + deliveryCharges + expressCharges - orderDiscounts;
  const grandTotal = netSales + vatCollected;

  // Payment Breakdown
  let cashSales = 0;
  let cardSales = 0;
  let bankTransfer = 0;
  let nomodSales = 0;
  let creditSales = 0;
  let partialPayments = 0;
  let otherPayments = 0;

  activeOrders.forEach(o => {
    const paid = o.paidAmount || 0;
    const due = o.dueAmount || 0;
    const method = (o.paymentMethod || '').toLowerCase();
    const status = (o.paymentStatus || '').toLowerCase();

    let breakdown = null;
    try {
      if (o.paymentBreakdown) {
        breakdown = typeof o.paymentBreakdown === 'string' ? JSON.parse(o.paymentBreakdown) : o.paymentBreakdown;
      }
    } catch (e) {}

    if (breakdown) {
      cashSales += parseFloat(breakdown.cash || 0);
      cardSales += parseFloat(breakdown.card || 0);
      bankTransfer += parseFloat(breakdown.bank || 0);
      if (status === 'paid') {
        nomodSales += parseFloat(breakdown.nomod || 0);
      }
      creditSales += due;
    } else {
      if (status === 'credit') {
        creditSales += due;
      } else if (status === 'partial') {
        partialPayments += paid;
        creditSales += due;
      } else {
        if (method === 'cash') cashSales += paid;
        else if (method === 'card') cardSales += paid;
        else if (method === 'bank') bankTransfer += paid;
        else if (method === 'nomod') {
          if (status === 'paid') {
            nomodSales += paid;
          }
        }
        else otherPayments += paid;
      }
    }
  });

  const totalCollected = cashSales + cardSales + bankTransfer + nomodSales + partialPayments + otherPayments;

  // Cash Drawer Reconciliation
  let cashCreditCollections = 0;
  let cashAdvancePayments = 0;
  let cashExpenses = 0;
  let cashRefunds = 0;

  transactions.forEach(t => {
    const amt = t.amount || 0;
    const cat = (t.category || '').toLowerCase();
    if (t.accountType === 'CASH') {
      if (t.type === 'INCOME') {
        if (cat.includes('credit') || cat.includes('settlement')) {
          cashCreditCollections += amt;
        } else if (cat.includes('advance') || cat.includes('deposit')) {
          cashAdvancePayments += amt;
        }
      } else if (t.type === 'EXPENSE') {
        cashExpenses += amt;
      }
    }
  });

  allDeletedOrders.forEach(o => {
    if ((o.paymentMethod || '').toLowerCase() === 'cash' && (o.paidAmount || 0) > 0) {
      cashRefunds += o.paidAmount;
    }
  });

  const expectedCash = (parseFloat(localStorage.getItem('opening_float_active') || '200')) + cashSales + cashCreditCollections + cashAdvancePayments - cashRefunds - cashExpenses - (parseFloat(localStorage.getItem('cash_withdrawal_active') || '0'));

  return {
    metrics: {
      storeOpening: 'N/A',
      storeClosing: 'N/A',
      durationStr: 'N/A',
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalPieces,
      expressPieces,
      expressCount,
      deliveryCount,
      pickupCount,
      avgOrderValue: 0,
      highestInvoice: 0,
      lowestInvoice: 0,
      grossSales,
      deliveryCharges,
      expressCharges,
      additionalCharges,
      orderDiscounts,
      settleDiscounts,
      totalDiscount,
      vatCollected,
      netSales,
      grandTotal,
      cashSales,
      cardSales,
      bankTransfer,
      nomodSales,
      creditSales,
      partialPayments,
      otherPayments,
      totalCollected,
      cashCreditCollections,
      cashAdvancePayments,
      cashExpenses,
      cashRefunds,
      expectedCash,
      cashDifference: 0,
      employeePerf: {},
      refundCount: allDeletedOrders.length,
      refundAmount: allDeletedOrders.reduce((s, o) => s + (o.paidAmount || 0), 0),
      serviceSales,
      garmentSummary
    },
    expenses,
    orders: activeOrders,
    transactions,
    allDeletedOrders
  };
}

export async function performAutoClose(dbQuery, settings, targetDate) {
  try {
    // 1. Get latest report to find start time
    const lastReportRes = await dbQuery(
      `SELECT endTime FROM z_reports ORDER BY endTime DESC LIMIT 1`, []
    );
    let startTime = '1970-01-01 00:00:00';
    if (lastReportRes.success && lastReportRes.data && lastReportRes.data.length > 0) {
      startTime = lastReportRes.data[0].endTime;
    }

    const endTime = new Date().toISOString();

    // 2. Fetch and calculate Z-Report data
    const data = await fetchAndCalculateMetrics(dbQuery, startTime, endTime, settings, targetDate);

    const openingFloat = parseFloat(localStorage.getItem('opening_float_active') || '200');
    const cashWithdrawals = parseFloat(localStorage.getItem('cash_withdrawal_active') || '0');
    const expectedCash = data.metrics.expectedCash;

    // 3. Save Z-Report row
    const reportId = `ZR-AUTO-${Date.now()}`;
    const insertRes = await dbQuery(
      `INSERT INTO z_reports (id, startTime, endTime, businessDate, openingFloat, actualCashCounted, expectedCash, cashDifference, cashWithdrawals, closedBy, ordersCount, grossSales, netSales, vatCollected, grandTotal, totalCollected, cashSales, cardSales, bankTransfer, nomodSales, creditSales, partialPayments, otherPayments, detailsJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        startTime,
        endTime,
        targetDate,
        openingFloat,
        expectedCash, // Auto-close sets actual count equal to expected count to match cash drawer
        expectedCash,
        0, // Difference = 0 on auto-close
        cashWithdrawals,
        'System (Auto-Close)',
        data.metrics.totalOrders,
        data.metrics.grossSales,
        data.metrics.netSales,
        data.metrics.vatCollected,
        data.metrics.grandTotal,
        data.metrics.totalCollected,
        data.metrics.cashSales,
        data.metrics.cardSales,
        data.metrics.bankTransfer,
        data.metrics.nomodSales,
        data.metrics.creditSales,
        data.metrics.partialPayments,
        data.metrics.otherPayments,
        JSON.stringify({
          metrics: data.metrics,
          newCustomersCount: 0,
          returningCustomersCount: 0,
          creditCustomersCount: 0,
          vipCustomersCount: 0,
          topCustomer: { name: 'N/A', amount: 0 },
          totalCustomersCount: 0,
          expenses: data.expenses,
          orders: data.orders,
          transactions: data.transactions,
          allDeletedOrders: data.allDeletedOrders
        })
      ]
    );

    if (insertRes.success) {
      // 4. Clear active session settings
      localStorage.removeItem(`opening_float_active`);
      localStorage.removeItem(`actual_cash_active`);
      localStorage.removeItem(`cash_withdrawal_active`);
      localStorage.removeItem(`view_active_session_${targetDate}`);
      console.log(`Z-Report auto-closed successfully for ${targetDate}`);
      
      // Dispatch event to notify open tabs
      window.dispatchEvent(new CustomEvent('zreport-autoclosed', { detail: { date: targetDate } }));
      return true;
    }
  } catch (error) {
    console.error("Error executing auto-close:", error);
  }
  return false;
}
