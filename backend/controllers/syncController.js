const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Payment = require('../models/Payment');
const AccountTransaction = require('../models/AccountTransaction');
const mongoose = require('mongoose');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

exports.syncData = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ success: false, message: 'Sync failed: MongoDB offline' });
  }
  const { shopId, orders, customers, payments, accountTransactions, lastSyncTimestamp } = req.body;
  
  try {
    // 1. Process Orders from client
    if (orders && orders.length > 0) {
      for (const order of orders) {
        // Use the same 'id' for MongoDB and SQLite
        const { isSynced, ...rest } = order;
        
        // Parse JSON strings if necessary
        const statusHistory = typeof order.statusHistory === 'string' 
          ? JSON.parse(order.statusHistory) 
          : order.statusHistory;
        const items = typeof order.items === 'string' 
          ? JSON.parse(order.items) 
          : order.items;

        const mongoOrder = { 
          ...rest, 
          statusHistory,
          items,
          billNumber: order.billNumber || `BN-${Date.now().toString().slice(-6)}` 
        };
        
        await Order.findOneAndUpdate(
          { id: mongoOrder.id },
          { ...mongoOrder, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 2. Process Customers from client
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        const { isSynced, ...rest } = cust;
        await Customer.findOneAndUpdate(
          { id: cust.id },
          { ...rest, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 3. Process Payments from client
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        const { isSynced, ...rest } = payment;
        await Payment.findOneAndUpdate(
          { id: payment.id, shopId },
          { ...rest, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 3.5 Process AccountTransactions from client
    if (accountTransactions && accountTransactions.length > 0) {
      for (const txn of accountTransactions) {
        const { isSynced, ...rest } = txn;
        await AccountTransaction.findOneAndUpdate(
          { id: txn.id, shopId },
          { ...rest, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 4. Process Categories from client
    if (req.body.categories && req.body.categories.length > 0) {
      for (const cat of req.body.categories) {
        const { isSynced, ...rest } = cat;
        await Category.findOneAndUpdate(
          { id: cat.id, shopId },
          { ...rest, shopId, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
    }

    // 5. Fetch updates from cloud since last sync
    const query = { 
      shopId, 
      updatedAt: { $gt: new Date(lastSyncTimestamp || 0) } 
    };

    const newOrders = await Order.find(query);
    const newCustomers = await Customer.find(query);
    const newServices = await Service.find(query);
    const newCategories = await Category.find(query);
    const newPayments = await Payment.find(query);
    const newAccountTransactions = await AccountTransaction.find(query);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        orders: newOrders,
        customers: newCustomers,
        services: newServices,
        categories: newCategories,
        payments: newPayments,
        accountTransactions: newAccountTransactions
      }
    });
  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ success: false, message: 'Sync failed' });
  }
};
