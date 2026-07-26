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
  // Stored separately from the display reference so DISC-0000001 can be
  // used for every discount without losing order vs settlement meaning.
  discountScope: { type: String, enum: ['order', 'settlement'], default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound unique index for multi-branch/SaaS scalability and duplicate protection
paymentSchema.index({ shopId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
