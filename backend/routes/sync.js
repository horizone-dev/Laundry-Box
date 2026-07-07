const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const BranchMeta = require('../models/BranchMeta');
const bcrypt = require('bcryptjs');

// Middleware to verify branch API key before allowing synchronization
async function verifyBranchKey(req, res, next) {
  const branchId = req.header('X-Branch-Id');
  const apiKey = req.header('X-Branch-API-Key');

  if (!branchId || !apiKey) {
    return res.status(401).json({ success: false, message: 'Authentication headers X-Branch-Id and X-Branch-API-Key required' });
  }

  try {
    const branch = await BranchMeta.findOne({ branchId });
    if (!branch) {
      return res.status(401).json({ success: false, message: 'Branch not registered' });
    }

    const isMatch = await bcrypt.compare(apiKey, branch.branchApiKeyHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Branch API Key' });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Protected Sync endpoint
router.post('/', verifyBranchKey, syncController.syncData);

module.exports = router;
