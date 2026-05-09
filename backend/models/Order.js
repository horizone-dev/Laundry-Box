const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, 
  billNumber: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String },
  shopId: { type: String, required: true },
  branchId: { type: String, required: true },
  status: { 
    type: String, 
    default: 'Payment Pending'
  },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, default: 'Paid' },
  paymentMethod: { type: String, default: 'CASH' },
  items: { type: Array, required: true },
  qrCode: { type: String },
  statusHistory: [{
    status: String,
    updatedBy: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
