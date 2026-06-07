const mongoose = require('mongoose');

const deletedOrderSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  billNumber: { type: String },
  customerId: { type: String },
  customerName: { type: String },
  customerPhone: { type: String },
  totalAmount: { type: Number },
  items: { type: Array },
  deletedAt: { type: Date, default: Date.now },
  deletedBy: { type: String },
  approvedBy: { type: String },
  originalPaymentStatus: { type: String },
  paidAmount: { type: Number, default: 0 },
  returnStatus: { type: String, default: 'N/A' },
  originalPaymentMethod: { type: String },
  payments: { type: mongoose.Schema.Types.Mixed },
  refundMethod: { type: String },
  returnedAt: { type: Date },
  refundStatus: { type: String, default: 'Deleted' }
}, { 
  timestamps: true,
  strict: true 
});

module.exports = mongoose.model('DeletedOrder', deletedOrderSchema);
