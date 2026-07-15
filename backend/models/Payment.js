const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Local SQLite ID
  customerId: { type: String },
  orderId: { type: String },
  shopId: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, required: true },
  paymentReference: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound unique index for multi-branch/SaaS scalability and duplicate protection
paymentSchema.index({ shopId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
