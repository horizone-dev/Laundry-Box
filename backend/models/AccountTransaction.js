const mongoose = require('mongoose');

const accountTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Local SQLite ID
  shopId: { type: String, required: true },
  accountType: { type: String, required: true }, // CASH / BANK
  type: { type: String, required: true }, // INCOME / EXPENSE
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  date: { type: String },
  icon: { type: String },
  bankAccountId: { type: String },
  createdBy: { type: String },
  createdById: { type: String },
  createdByRole: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

accountTransactionSchema.index({ shopId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('AccountTransaction', accountTransactionSchema);
