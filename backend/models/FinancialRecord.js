const mongoose = require('mongoose');

// Immutable financial history (refunds, ledgers, returns and audit events)
// is stored as a portable payload. The operational collections remain local;
// this model makes the history durable and available to every branch sync.
const financialRecordSchema = new mongoose.Schema({
  id: { type: String, required: true },
  shopId: { type: String, required: true },
  kind: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  occurredAt: { type: Date, default: Date.now }
}, { timestamps: true });

financialRecordSchema.index({ shopId: 1, kind: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('FinancialRecord', financialRecordSchema);
