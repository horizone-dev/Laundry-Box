const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const BranchMeta = require('../models/BranchMeta');
const Staff = require('../models/Staff');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ─── Helper: is MongoDB online? ───────────────────────────────────────────────
function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// ─── Helper: get today's date range (UTC) ─────────────────────────────────────
function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

// ─── Middleware: JWT Dashboard Authentication ────────────────────────────────
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, shopId, role, branchId }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
  }
}

// ─── POST /api/dashboard/register-branch ──────────────────────────────────────
// Called by each Electron app on sync — registers/updates branch metadata
router.post('/register-branch', async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ success: false, message: 'MongoDB offline' });
  try {
    const { branchId, shopId, branchName, branchApiKey } = req.body;

    // Strict input validation
    if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
      return res.status(400).json({ success: false, message: 'Valid branchId required' });
    }
    if (!shopId || typeof shopId !== 'string' || shopId.trim() === '') {
      return res.status(400).json({ success: false, message: 'Valid shopId required' });
    }
    if (!branchApiKey || typeof branchApiKey !== 'string' || branchApiKey.length < 16) {
      return res.status(400).json({ success: false, message: 'Valid branchApiKey required (min 16 characters)' });
    }

    const trimmedBranchId = branchId.trim();
    const trimmedShopId = shopId.trim();

    // Check if branch metadata already exists
    let branch = await BranchMeta.findOne({ branchId: trimmedBranchId });
    if (branch) {
      // Verify API Key
      const match = await bcrypt.compare(branchApiKey, branch.branchApiKeyHash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid Branch API Key' });
      }

      // Update last seen and branch name
      branch.lastSeen = new Date();
      if (branchName) branch.branchName = branchName.trim();
      await branch.save();
    } else {
      // First-time registration: hash API Key and save
      const branchApiKeyHash = await bcrypt.hash(branchApiKey, 10);
      branch = new BranchMeta({
        branchId: trimmedBranchId,
        shopId: trimmedShopId,
        branchName: (branchName || 'Branch').trim(),
        branchApiKeyHash,
        lastSeen: new Date()
      });
      await branch.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/dashboard/login ────────────────────────────────────────────────
// User-friendly credentials login for Web Dashboard (Owners/Managers)
router.post('/login', async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ success: false, message: 'MongoDB offline' });
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and Password are required' });
    }

    // Find User in Staff table
    const staff = await Staff.findOne({
      $or: [
        { userId: identifier },
        { phone: identifier },
        { name: identifier }
      ]
    });

    if (!staff) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Gating roles: Only managers and super_admins can login to dashboard
    if (staff.role !== 'super_admin' && staff.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied: Insufficient privileges' });
    }

    const isMatch = await staff.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Sign jwt token
    const token = jwt.sign(
      {
        id: staff._id,
        role: staff.role,
        shopId: staff.shopId,
        branchId: staff.branchId || null
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: staff._id,
        name: staff.name,
        role: staff.role,
        shopId: staff.shopId,
        branchId: staff.branchId || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/dashboard/report ────────────────────────────────────────────────
// Returns KPI summary (Restricted by Role-Based Access Control)
router.get('/report', authenticateJWT, async (req, res) => {
  if (!isMongoConnected()) return res.status(503).json({ success: false, message: 'MongoDB offline' });
  try {
    const { shopId, role, branchId: userBranchId } = req.user;
    const { start, end } = getTodayRange();

    // Query filters: If manager, restrict to their specific branchId
    const isManager = role === 'manager';
    const branchFilter = { shopId };
    if (isManager) {
      if (!userBranchId) {
        return res.status(403).json({ success: false, message: 'Manager account is not linked to any branch' });
      }
      branchFilter.branchId = userBranchId;
    }

    // Fetch branches
    const branches = await BranchMeta.find(branchFilter).lean();

    // Fetch orders filter
    const orderQuery = { shopId, createdAt: { $gte: start, $lte: end } };
    const activeOrderQuery = { shopId, status: { $nin: ['Delivered', 'Cancelled', 'Deleted'] } };
    const paymentQuery = { shopId, createdAt: { $gte: start, $lte: end } };

    if (isManager) {
      orderQuery.branchId = userBranchId;
      activeOrderQuery.branchId = userBranchId;
    }

    const todayOrders = await Order.find(orderQuery).lean();
    const allActiveOrders = await Order.find(activeOrderQuery).lean();
    const todayPayments = await Payment.find(paymentQuery).lean();

    // Aggregate per branch
    const branchReports = branches.map(branch => {
      const branchTodayOrders = todayOrders.filter(o => o.branchId === branch.branchId);
      const branchActiveOrders = allActiveOrders.filter(o => o.branchId === branch.branchId);
      const branchTodayPayments = todayPayments.filter(p => {
        // Match payments to the current branch via order mapping
        const order = todayOrders.find(o => o.id === p.orderId);
        return order && order.branchId === branch.branchId;
      });

      const revenueToday = branchTodayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const cashCollectedToday = branchTodayPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const pendingCount = branchActiveOrders.filter(o => ['Payment Pending', 'Received', 'Processing', 'Washing'].includes(o.status)).length;
      const readyCount = branchActiveOrders.filter(o => o.status === 'Ready').length;
      const outForDelivery = branchActiveOrders.filter(o => o.status === 'Out for Delivery').length;
      const completedToday = branchTodayOrders.filter(o => o.status === 'Delivered').length;
      const dueAmount = branchActiveOrders.reduce((s, o) => s + (o.dueAmount || 0), 0);

      const isOnline = branch.lastSeen && (Date.now() - new Date(branch.lastSeen).getTime()) < 2 * 60 * 60 * 1000;

      return {
        branchId: branch.branchId,
        branchName: branch.branchName,
        lastSeen: branch.lastSeen,
        isOnline,
        kpis: {
          ordersToday: branchTodayOrders.length,
          revenueToday: parseFloat(revenueToday.toFixed(2)),
          cashCollectedToday: parseFloat(cashCollectedToday.toFixed(2)),
          pendingCount,
          readyCount,
          outForDelivery,
          completedToday,
          dueAmount: parseFloat(dueAmount.toFixed(2)),
        }
      };
    });

    // Totals
    const totals = {
      ordersToday: branchReports.reduce((s, b) => s + b.kpis.ordersToday, 0),
      revenueToday: parseFloat(branchReports.reduce((s, b) => s + b.kpis.revenueToday, 0).toFixed(2)),
      cashCollectedToday: parseFloat(branchReports.reduce((s, b) => s + b.kpis.cashCollectedToday, 0).toFixed(2)),
      pendingCount: branchReports.reduce((s, b) => s + b.kpis.pendingCount, 0),
      completedToday: branchReports.reduce((s, b) => s + b.kpis.completedToday, 0),
      dueAmount: parseFloat(branchReports.reduce((s, b) => s + b.kpis.dueAmount, 0).toFixed(2)),
      branchCount: branches.length,
      onlineBranches: branchReports.filter(b => b.isOnline).length,
    };

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      shopId,
      totals,
      branches: branchReports
    });
  } catch (err) {
    console.error('Dashboard report error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
