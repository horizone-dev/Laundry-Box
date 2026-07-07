const { getDB } = require('./database');
const { safeStorage, BrowserWindow, app } = require('electron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { execSync } = require('child_process');
const crypto = require('crypto');

let currentCronJob = null;

function getMachineId() {
  try {
    const output = execSync('wmic csproduct get uuid', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = output.split('\n');
    for (const line of lines) {
      if (line && !line.toLowerCase().includes('uuid')) {
        const id = line.trim();
        if (id) return id;
      }
    }
  } catch (err) {
    console.error('Failed to get machine UUID:', err);
  }
  return 'fallback-machine-id-1234';
}

function hardwareEncrypt(text) {
  const machineId = getMachineId();
  const key = crypto.scryptSync(machineId, 'LaundryBoxEmailSalt2026', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag,
    encrypted: encrypted
  });
}

function hardwareDecrypt(payloadStr) {
  const payload = JSON.parse(payloadStr);
  if (!payload.iv || !payload.authTag || !payload.encrypted) {
    throw new Error('Invalid hardware encrypted payload');
  }
  const machineId = getMachineId();
  const key = crypto.scryptSync(machineId, 'LaundryBoxEmailSalt2026', 32);
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getEmailSettings() {
  const db = getDB();
  const settings = db.prepare('SELECT * FROM email_settings WHERE id = ?').get('1');
  if (!settings) return null;

  let password = '';
  if (settings.passwordBuffer && safeStorage.isEncryptionAvailable()) {
    try {
      const decryptedString = safeStorage.decryptString(settings.passwordBuffer);
      try {
        password = hardwareDecrypt(decryptedString);
      } catch (hwErr) {
        // Fallback for passwords encrypted before hardware encryption was added
        password = decryptedString;
      }
    } catch (err) {
      console.error('Failed to decrypt SMTP password:', err);
    }
  }

  return {
    ...settings,
    password
  };
}

function saveEmailSettings(settingsData) {
  const db = getDB();
  let buffer = null;
  
  if (settingsData.password && safeStorage.isEncryptionAvailable()) {
    const hwEncrypted = hardwareEncrypt(settingsData.password);
    buffer = safeStorage.encryptString(hwEncrypted);
  }

  const existing = db.prepare('SELECT id FROM email_settings WHERE id = ?').get('1');

  const includePdf = settingsData.includePdf !== undefined ? (settingsData.includePdf ? 1 : 0) : 1;
  const includeSalesCsv = settingsData.includeSalesCsv ? 1 : 0;
  const includeExpensesCsv = settingsData.includeExpensesCsv ? 1 : 0;
  const includeCollectionsCsv = settingsData.includeCollectionsCsv ? 1 : 0;
  const includeOutstandingCsv = settingsData.includeOutstandingCsv ? 1 : 0;

  if (existing) {
    if (buffer) {
      db.prepare(`
        UPDATE email_settings SET 
        enabled = ?, ownerEmail = ?, sendTime = ?, provider = ?, smtpHost = ?, smtpPort = ?, username = ?, passwordBuffer = ?,
        includePdf = ?, includeSalesCsv = ?, includeExpensesCsv = ?, includeCollectionsCsv = ?, includeOutstandingCsv = ?
        WHERE id = '1'
      `).run(
        settingsData.enabled ? 1 : 0, settingsData.ownerEmail, settingsData.sendTime, 
        settingsData.provider, settingsData.smtpHost, settingsData.smtpPort, settingsData.username, buffer,
        includePdf, includeSalesCsv, includeExpensesCsv, includeCollectionsCsv, includeOutstandingCsv
      );
    } else {
      db.prepare(`
        UPDATE email_settings SET 
        enabled = ?, ownerEmail = ?, sendTime = ?, provider = ?, smtpHost = ?, smtpPort = ?, username = ?,
        includePdf = ?, includeSalesCsv = ?, includeExpensesCsv = ?, includeCollectionsCsv = ?, includeOutstandingCsv = ?
        WHERE id = '1'
      `).run(
        settingsData.enabled ? 1 : 0, settingsData.ownerEmail, settingsData.sendTime, 
        settingsData.provider, settingsData.smtpHost, settingsData.smtpPort, settingsData.username,
        includePdf, includeSalesCsv, includeExpensesCsv, includeCollectionsCsv, includeOutstandingCsv
      );
    }
  } else {
    db.prepare(`
      INSERT INTO email_settings (id, enabled, ownerEmail, sendTime, provider, smtpHost, smtpPort, username, passwordBuffer,
      includePdf, includeSalesCsv, includeExpensesCsv, includeCollectionsCsv, includeOutstandingCsv)
      VALUES ('1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      settingsData.enabled ? 1 : 0, settingsData.ownerEmail, settingsData.sendTime, 
      settingsData.provider, settingsData.smtpHost, settingsData.smtpPort, settingsData.username, buffer,
      includePdf, includeSalesCsv, includeExpensesCsv, includeCollectionsCsv, includeOutstandingCsv
    );
  }
  
  // Restart scheduler when settings change
  initScheduler();
}

function generateSalesHtml(orders, dateStr) {
  let rows = '';
  let grandTotal = 0, grandPaid = 0, grandDue = 0;
  for (const o of orders) {
    const customer = o.customerName || 'Walk-in';
    const total = Number(o.totalAmount || 0);
    const paid = Number(o.paidAmount || 0);
    const due = Number(o.dueAmount || 0);
    grandTotal += total;
    grandPaid += paid;
    grandDue += due;
    rows += `
      <tr>
        <td>${o.id}</td>
        <td>${o.billNumber || ''}</td>
        <td>${customer}</td>
        <td style="text-align:right;">AED ${total.toFixed(2)}</td>
        <td style="text-align:right;">AED ${paid.toFixed(2)}</td>
        <td style="text-align:right;">AED ${due.toFixed(2)}</td>
        <td>${o.paymentStatus}</td>
        <td>${o.paymentMethod}</td>
      </tr>
    `;
  }
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; }
        .summary { font-weight: bold; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Detailed Sales Report - ${dateStr}</h1>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Bill Number</th>
            <th>Customer</th>
            <th style="text-align:right;">Total</th>
            <th style="text-align:right;">Paid</th>
            <th style="text-align:right;">Due</th>
            <th>Payment Status</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="summary">
            <td colspan="3">Grand Total</td>
            <td style="text-align:right;">AED ${grandTotal.toFixed(2)}</td>
            <td style="text-align:right;">AED ${grandPaid.toFixed(2)}</td>
            <td style="text-align:right;">AED ${grandDue.toFixed(2)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generateExpensesHtml(expenses, dateStr) {
  let rows = '';
  let total = 0;
  for (const e of expenses) {
    total += e.amount;
    rows += `
      <tr>
        <td>${e.id}</td>
        <td>${e.title}</td>
        <td>${e.category || 'General'}</td>
        <td style="text-align:right;">AED ${e.amount.toFixed(2)}</td>
        <td>${e.date}</td>
      </tr>
    `;
  }
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #991b1b; border-bottom: 2px solid #ef4444; padding-bottom: 8px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
        th { background-color: #f1f5f9; }
        .summary { font-weight: bold; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Detailed Expenses Report - ${dateStr}</h1>
      <table>
        <thead>
          <tr>
            <th>Expense ID</th>
            <th>Title</th>
            <th>Category</th>
            <th style="text-align:right;">Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="summary">
            <td colspan="3">Total Expenses</td>
            <td style="text-align:right;">AED ${total.toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generateCollectionsHtml(payments, dateStr) {
  let rows = '';
  let total = 0;
  for (const p of payments) {
    total += p.amount;
    const customer = p.customerName || 'Walk-in';
    rows += `
      <tr>
        <td>${p.id}</td>
        <td>${customer}</td>
        <td>${p.orderId || ''}</td>
        <td style="text-align:right;">AED ${p.amount.toFixed(2)}</td>
        <td>${p.method}</td>
        <td>${p.createdAt}</td>
      </tr>
    `;
  }
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #065f46; border-bottom: 2px solid #10b981; padding-bottom: 8px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
        th { background-color: #f1f5f9; }
        .summary { font-weight: bold; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Detailed Collections Report - ${dateStr}</h1>
      <table>
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>Customer</th>
            <th>Order ID</th>
            <th style="text-align:right;">Amount</th>
            <th>Method</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="summary">
            <td colspan="3">Total Collections</td>
            <td style="text-align:right;">AED ${total.toFixed(2)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generateOutstandingHtml(customers, dateStr) {
  let rows = '';
  let totalOutstanding = 0;
  for (const c of customers) {
    const balanceVal = Number(c.balance || 0);
    const creditLimitVal = Number(c.creditLimit || 0);
    totalOutstanding += balanceVal;
    rows += `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.phone || ''}</td>
        <td>${c.email || ''}</td>
        <td>${c.address || ''}</td>
        <td style="text-align:right;">AED ${creditLimitVal.toFixed(2)}</td>
        <td style="text-align:right; color: ${balanceVal > 0 ? '#b91c1c' : '#047857'};">AED ${balanceVal.toFixed(2)}</td>
      </tr>
    `;
  }
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #1e293b; border-bottom: 2px solid #64748b; padding-bottom: 8px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; }
        .summary { font-weight: bold; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Customer Outstanding Balances Report - ${dateStr}</h1>
      <table>
        <thead>
          <tr>
            <th>Customer ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Address</th>
            <th style="text-align:right;">Credit Limit</th>
            <th style="text-align:right;">Outstanding Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="summary">
            <td colspan="6">Total Outstanding Balance</td>
            <td style="text-align:right; color: #b91c1c;">AED ${totalOutstanding.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

async function getDailyStats() {
  const db = getDB();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const shop = db.prepare('SELECT name FROM shops LIMIT 1').get() || { name: 'Laundry Branch' };

  const orders = db.prepare(`SELECT totalAmount, dueAmount, paymentMethod, status FROM orders WHERE createdAt >= ? AND createdAt <= ?`).all(startOfDay, endOfDay);
  let totalSales = 0, cashSales = 0, cardSales = 0, nomodSales = 0, creditSales = 0;
  let totalOrders = orders.length, delivered = 0, ready = 0, pending = 0, cancelled = 0;

  for (const o of orders) {
    totalSales += o.totalAmount;
    if (o.status === 'Delivered') delivered++;
    else if (o.status === 'Ready') ready++;
    else if (o.status === 'Cancelled') cancelled++;
    else pending++;

    if (o.dueAmount > 0 && o.dueAmount === o.totalAmount) {
      creditSales += o.totalAmount;
    } else {
      const paid = o.totalAmount - o.dueAmount;
      if (o.paymentMethod === 'CASH') cashSales += paid;
      else if (o.paymentMethod === 'CARD') cardSales += paid;
      else nomodSales += paid;
      if (o.dueAmount > 0) creditSales += o.dueAmount;
    }
  }

  const payments = db.prepare(`SELECT amount FROM payments WHERE createdAt >= ? AND createdAt <= ?`).all(startOfDay, endOfDay);
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);

  const expenses = db.prepare(`SELECT amount, title FROM expenses WHERE date >= ? AND date <= ?`).all(startOfDay, endOfDay);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    shopName: shop.name,
    dateStr: now.toDateString(),
    totalSales, cashSales, cardSales, nomodSales, creditSales,
    totalOrders, delivered, ready, pending, cancelled,
    totalCollections,
    totalExpenses,
    expensesList: expenses
  };
}

async function generateHtmlReport(stats) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: #f9fafb; }
        .container { max-width: 800px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1d4ed8; margin: 0; }
        .header p { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .grid { display: flex; flex-wrap: wrap; gap: 20px; }
        .card { flex: 1; min-width: 200px; background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .card h3 { margin: 0 0 10px 0; color: #1e3a8a; font-size: 16px; }
        .card .value { font-size: 24px; font-weight: bold; color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; color: #4b5563; }
        .section-title { margin-top: 30px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Business Report</h1>
          <p>${stats.shopName} - ${stats.dateStr}</p>
        </div>
        
        <div class="grid">
          <div class="card">
            <h3>Total Sales</h3>
            <div class="value">AED ${stats.totalSales.toFixed(2)}</div>
          </div>
          <div class="card" style="background:#f0fdf4; border-color:#10b981;">
            <h3 style="color:#065f46;">Collections</h3>
            <div class="value" style="color:#059669;">AED ${stats.totalCollections.toFixed(2)}</div>
          </div>
          <div class="card" style="background:#fef2f2; border-color:#ef4444;">
            <h3 style="color:#991b1b;">Expenses</h3>
            <div class="value" style="color:#dc2626;">AED ${stats.totalExpenses.toFixed(2)}</div>
          </div>
        </div>

        <h2 class="section-title">Sales Breakdown</h2>
        <table>
          <tr><th>Cash Sales</th><td>AED ${stats.cashSales.toFixed(2)}</td></tr>
          <tr><th>Card Sales</th><td>AED ${stats.cardSales.toFixed(2)}</td></tr>
          <tr><th>Nomod Sales</th><td>AED ${stats.nomodSales.toFixed(2)}</td></tr>
          <tr><th>Credit Sales</th><td>AED ${stats.creditSales.toFixed(2)}</td></tr>
        </table>

        <h2 class="section-title">Orders Overview</h2>
        <table>
          <tr><th>Total Orders</th><td>${stats.totalOrders}</td></tr>
          <tr><th>Delivered</th><td>${stats.delivered}</td></tr>
          <tr><th>Ready</th><td>${stats.ready}</td></tr>
          <tr><th>Pending</th><td>${stats.pending}</td></tr>
          <tr><th>Cancelled</th><td>${stats.cancelled}</td></tr>
        </table>
        
        <h2 class="section-title">Expenses List</h2>
        <table>
          <tr><th>Description</th><th>Amount</th></tr>
          ${stats.expensesList.map(e => `<tr><td>${e.title}</td><td>AED ${e.amount.toFixed(2)}</td></tr>`).join('')}
          ${stats.expensesList.length === 0 ? '<tr><td colspan="2">No expenses recorded today</td></tr>' : ''}
        </table>
      </div>
    </body>
    </html>
  `;
}

async function renderPdf(html) {
  const tmpPath = path.join(app.getPath('temp'), `email_pdf_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
  fs.writeFileSync(tmpPath, html, 'utf8');

  return new Promise((resolve, reject) => {
    let win = new BrowserWindow({ 
      show: false, 
      webPreferences: { 
        nodeIntegration: false,
        contextIsolation: true
      } 
    });
    
    win.loadFile(tmpPath);
    
    win.webContents.on('did-finish-load', async () => {
      try {
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4'
        });
        win.close();
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_) {}
        resolve(pdfBuffer);
      } catch (err) {
        win.close();
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_) {}
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      win.close();
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (_) {}
      reject(new Error(`Failed to load HTML: ${errorDescription}`));
    });
  });
}

function logEmailHistory(recipient, status, reason, retryCount = 0) {
  const db = getDB();
  const id = 'EH-' + Date.now();
  const now = new Date();
  db.prepare(`
    INSERT INTO email_history (id, date, time, recipient, status, reason, retryCount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, now.toDateString(), now.toTimeString(), recipient, status, reason, retryCount);
}

async function sendEmailReport(retryCount = 0) {
  try {
    const settings = await getEmailSettings();
    if (!settings || !settings.enabled || !settings.ownerEmail || !settings.smtpHost) {
      return { success: false, message: 'Email reports are disabled or incomplete settings.' };
    }

    const stats = await getDailyStats();
    const htmlBody = await generateHtmlReport(stats);
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const attachments = [];
    
    if (settings.includePdf !== 0) {
      const pdfBuffer = await renderPdf(htmlBody);
      attachments.push({
        filename: `Report-${stats.dateStr.replace(/ /g, '-')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    if (settings.includeSalesCsv === 1) {
      const db = getDB();
      const orders = db.prepare(`
        SELECT orders.id, orders.billNumber, customers.name AS customerName, 
               orders.totalAmount, orders.paidAmount, orders.dueAmount, 
               orders.paymentStatus, orders.paymentMethod, orders.createdAt 
        FROM orders 
        LEFT JOIN customers ON orders.customerId = customers.id
        WHERE orders.createdAt >= ? AND orders.createdAt <= ?
      `).all(startOfDay, endOfDay);
      const salesHtml = generateSalesHtml(orders, stats.dateStr);
      const pdf = await renderPdf(salesHtml);
      attachments.push({
        filename: `Sales-${stats.dateStr.replace(/ /g, '-')}.pdf`,
        content: pdf,
        contentType: 'application/pdf'
      });
    }

    if (settings.includeExpensesCsv === 1) {
      const db = getDB();
      const expenses = db.prepare(`
        SELECT id, title, amount, category, date 
        FROM expenses 
        WHERE date >= ? AND date <= ?
      `).all(startOfDay, endOfDay);
      const expensesHtml = generateExpensesHtml(expenses, stats.dateStr);
      const pdf = await renderPdf(expensesHtml);
      attachments.push({
        filename: `Expenses-${stats.dateStr.replace(/ /g, '-')}.pdf`,
        content: pdf,
        contentType: 'application/pdf'
      });
    }

    if (settings.includeCollectionsCsv === 1) {
      const db = getDB();
      const payments = db.prepare(`
        SELECT payments.id, customers.name AS customerName, payments.orderId, payments.amount, payments.method, payments.createdAt
        FROM payments
        LEFT JOIN customers ON payments.customerId = customers.id
        WHERE payments.createdAt >= ? AND payments.createdAt <= ?
      `).all(startOfDay, endOfDay);
      const collectionsHtml = generateCollectionsHtml(payments, stats.dateStr);
      const pdf = await renderPdf(collectionsHtml);
      attachments.push({
        filename: `Collections-${stats.dateStr.replace(/ /g, '-')}.pdf`,
        content: pdf,
        contentType: 'application/pdf'
      });
    }

    if (settings.includeOutstandingCsv === 1) {
      const db = getDB();
      const customers = db.prepare(`
        SELECT id, name, phone, email, address, creditLimit, balance 
        FROM customers 
        WHERE balance > 0 OR balance < 0
      `).all();
      const outstandingHtml = generateOutstandingHtml(customers, stats.dateStr);
      const pdf = await renderPdf(outstandingHtml);
      attachments.push({
        filename: `Customer-Outstanding-${stats.dateStr.replace(/ /g, '-')}.pdf`,
        content: pdf,
        contentType: 'application/pdf'
      });
    }

    let transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 465,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.username,
        pass: settings.password
      },
      requireTLS: true,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    const mailOptions = {
      from: `"${stats.shopName}" <${settings.username}>`,
      to: settings.ownerEmail,
      subject: `Daily Business Report - ${stats.shopName} - ${stats.dateStr}`,
      html: htmlBody,
      attachments
    };

    await transporter.sendMail(mailOptions);
    logEmailHistory(settings.ownerEmail, 'Success', 'Email sent successfully', retryCount);
    return { success: true, message: 'Email sent successfully' };

  } catch (error) {
    console.error('Email send failed:', error);
    logEmailHistory('Unknown', 'Failed', error.message || 'Unknown error', retryCount);
    
    if (retryCount < 3) {
      const delays = [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000]; // 15, 30, 60 mins
      const delay = delays[retryCount];
      console.log(`Retrying email in ${delay / 60000} minutes...`);
      setTimeout(() => sendEmailReport(retryCount + 1), delay);
    }
    
    return { success: false, message: error.message };
  }
}

async function initScheduler() {
  if (currentCronJob) {
    currentCronJob.stop();
  }

  const settings = await getEmailSettings();
  if (settings && settings.enabled && settings.sendTime) {
    const [hour, minute] = settings.sendTime.split(':');
    const cronStr = `${minute} ${hour} * * *`;
    console.log(`Initializing email scheduler for closing time: ${cronStr}`);
    
    currentCronJob = cron.schedule(cronStr, () => {
      console.log('Running automatic daily email report at closing time...');
      sendEmailReport(0);
    });
  } else {
    console.log('Email scheduler disabled.');
  }
}

module.exports = {
  getEmailSettings,
  saveEmailSettings,
  sendEmailReport,
  initScheduler
};

