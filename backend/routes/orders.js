const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const DeletedOrder = require('../models/DeletedOrder');
const mongoose = require('mongoose');

// Fail-fast middleware to prevent hangs on orders endpoints when MongoDB is offline
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB is offline. Operations are handled locally in SQLite.',
      offline: true
    });
  }
  next();
});

// GET /api/orders/deleted - Fetch all deleted orders
router.get('/deleted', async (req, res) => {
  try {
    const deletedOrders = await DeletedOrder.find({}).sort({ deletedAt: -1 });
    res.json(deletedOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/search - Search orders
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const searchRegex = new RegExp(q, 'i');
    const activeOrders = await Order.find({
      $or: [
        { id: searchRegex },
        { billNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ]
    }).sort({ createdAt: -1 }).lean();

    const deletedOrders = await DeletedOrder.find({
      $or: [
        { id: searchRegex },
        { billNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex }
      ]
    }).sort({ deletedAt: -1 }).lean();

    const activeMapped = activeOrders.map(o => ({
      ...o,
      isDeleted: false
    }));

    const deletedMapped = deletedOrders.map(d => ({
      ...d,
      isDeleted: true,
      status: 'Deleted',
      createdAt: d.deletedAt,
      dueAmount: 0,
      paymentStatus: d.originalPaymentStatus,
      paymentMethod: d.originalPaymentMethod
    }));

    const all = [...activeMapped, ...deletedMapped].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(all);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  const orderId = req.params.id;
  console.log(`Updating status for order: ${orderId}`);
  try {
    const { status, paymentStatus, paidAmount, dueAmount, expectedDeliveryDate, updatedBy } = req.body;

    // Try matching by multiple fields for robustness
    let order = await Order.findOne({
      $or: [
        { id: orderId },
        { id: orderId.replace('#', '') },
        { id: '#' + orderId.replace('#', '') },
        { billNumber: orderId }
      ]
    });

    // If not found by custom ID, try by MongoDB _id if it looks like one
    if (!order && orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      console.error(`Order not found in MongoDB: ${orderId}`);
      return res.status(404).json({ message: `Order ${orderId} not found` });
    }

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paidAmount !== undefined) order.paidAmount = paidAmount;
    if (dueAmount !== undefined) order.dueAmount = dueAmount;
    if (expectedDeliveryDate !== undefined) order.expectedDeliveryDate = expectedDeliveryDate;

    if (!order.statusHistory || !Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: status || order.status,
      updatedBy: updatedBy || 'Staff',
      timestamp: new Date()
    });
    order.updatedAt = new Date();

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/orders - Create or update order (for sync or direct creation)
router.post('/', async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { id: req.body.id },
      req.body,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
  const orderId = req.params.id;
  const { deletedBy, approvedBy, refundImmediately, refundMethod, payments, originalPaymentMethod } = req.body;
  const finalDeletedBy = deletedBy || req.query.deletedBy || 'Staff';
  const finalApprovedBy = approvedBy || req.query.approvedBy || 'Manager';
  try {
    let order = await Order.findOne({
      $or: [
        { id: orderId },
        { id: orderId.replace('#', '') },
        { id: '#' + orderId.replace('#', '') },
        { billNumber: orderId }
      ]
    });

    if (!order && orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isPaid = order.paidAmount > 0 || ['Paid', 'Partial'].includes(order.paymentStatus);
    const initialRefundStatus = isPaid
      ? (refundImmediately ? 'Returned' : 'Converted to Advance')
      : 'Deleted';

    // 0. Save to DeletedOrder audit log collection in MongoDB
    const deletedRecord = new DeletedOrder({
      id: order.id,
      shopId: order.shopId,
      billNumber: order.billNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      items: order.items,
      deletedBy: finalDeletedBy,
      approvedBy: finalApprovedBy,
      deletedAt: new Date(),
      originalPaymentStatus: order.paymentStatus,
      paidAmount: order.paidAmount || 0,
      returnStatus: isPaid ? (refundImmediately ? 'Returned' : 'Converted to Advance') : 'N/A',
      originalPaymentMethod: originalPaymentMethod || order.paymentMethod || 'CASH',
      payments: payments || [],
      refundMethod: refundImmediately ? (refundMethod || 'CASH') : null,
      returnedAt: refundImmediately ? new Date() : null,
      refundStatus: initialRefundStatus
    });
    await deletedRecord.save();

    // 1. Delete associated payments in MongoDB
    await Payment.deleteMany({ orderId: order.id, shopId: order.shopId });

    if (isPaid && (order.paidAmount || 0) > 0 && !refundImmediately) {
      // Create unlinked Advance payment in MongoDB
      const newAdvId = `ADV-CONV-${Date.now()}`;
      const newPayment = new Payment({
        id: newAdvId,
        customerId: order.customerId,
        orderId: null,
        shopId: order.shopId,
        amount: order.paidAmount,
        method: 'Refund Advance',
        status: 'SUCCESS',
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentReference: `ADV-CONV-${Date.now()}`
      });
      await newPayment.save();
    }

    // 2. Delete the order
    await Order.deleteOne({ _id: order._id });

    // 3. Recalculate and update customer balance in MongoDB
    // Formula mirrors the SQLite DataHealer: balance = totalDue - availableAdvance - pendingRefunds
    if (order.customerId && order.customerId !== 'Walk-in') {
      const customerId = order.customerId;
      const shopId = order.shopId;

      // Get all non-cancelled orders for this customer
      const activeOrders = await Order.find({ customerId, shopId, status: { $ne: 'Cancelled' } });
      const totalDue = activeOrders.reduce((sum, o) => sum + (o.dueAmount ?? 0), 0);

      // Get all unlinked payments for this customer (advances, deposits, RV receipts)
      const unlinkedPayments = await Payment.find({
        customerId,
        shopId,
        $or: [{ orderId: { $exists: false } }, { orderId: null }, { orderId: '' }]
      });
      const totalPaymentsRaw = unlinkedPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

      // Deduct advance allocations already consumed on active orders
      const AdvanceAllocation = require('../models/AdvanceAllocation');
      const allocations = await AdvanceAllocation.find({ shopId, paymentId: { $in: unlinkedPayments.map(p => p.id) } });
      const totalUsed = allocations.reduce((sum, a) => sum + (a.amountUsed ?? 0), 0);

      const availableAdvance = totalPaymentsRaw - totalUsed;

      // Deleted orders where refund has NOT been given yet: customer is owed this money.
      // This includes the currently deleted order (if not refunded immediately) AND any prior pending refunds.
      // Only count orders with paidAmount > 0 — unpaid deleted orders don't affect balance.
      const DeletedOrder = require('../models/DeletedOrder');
      const pendingRefunds = await DeletedOrder.find({
        customerId,
        shopId,
        refundStatus: 'Refund Pending',
        paidAmount: { $gt: 0 }
      });
      const totalPendingRefunds = pendingRefunds.reduce((sum, d) => sum + (d.paidAmount ?? 0), 0);

      // The currently deleted order is already converted to an unlinked payment, so additionalPending is 0.
      const additionalPending = 0;

      const newBalance = totalDue - availableAdvance - totalPendingRefunds - additionalPending;

      await Customer.findOneAndUpdate(
        { id: customerId, shopId },
        { balance: newBalance, updatedAt: new Date() }
      );
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/orders/deleted/:id/refund - Update return payment status of a deleted order
router.patch('/deleted/:id/refund', async (req, res) => {
  try {
    const { returnStatus, refundMethod } = req.body;
    const deletedOrder = await DeletedOrder.findOne({ id: req.params.id });
    if (!deletedOrder) return res.status(404).json({ message: 'Deleted order log not found' });

    const oldStatus = deletedOrder.refundStatus || deletedOrder.returnStatus;

    deletedOrder.returnStatus = returnStatus || 'Returned';
    deletedOrder.refundStatus = 'Returned';
    deletedOrder.refundMethod = refundMethod || 'CASH';
    deletedOrder.returnedAt = new Date();

    await deletedOrder.save();

    // If status changed to Returned, adjust customer balance
    if (oldStatus !== 'Returned') {
      if (deletedOrder.customerId) {
        const customer = await Customer.findOne({ id: deletedOrder.customerId, shopId: deletedOrder.shopId });
        if (customer) {
          customer.balance += deletedOrder.paidAmount;
          customer.updatedAt = new Date();
          await customer.save();
        }
      }
    }

    res.json(deletedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
