const mongoose = require('mongoose');

const branchMetaSchema = new mongoose.Schema({
  branchId: { type: String, required: true, unique: true },
  shopId:   { type: String, required: true },
  branchName: { type: String, required: true, default: 'Branch' },
  lastSeen: { type: Date, default: Date.now },
  branchApiKeyHash: { type: String, required: true }, // Bcrypt hash of the branch's unique sync API Key
}, { timestamps: true });

module.exports = mongoose.model('BranchMeta', branchMetaSchema);
