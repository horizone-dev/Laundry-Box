const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Local SQLite ID
  shopId: { type: String, required: true },
  branchId: { type: String },
  customerId: { type: String },
  status: { type: String, default: 'Pending' },
  totalAmount: { type: Number, required: true },
  items: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
