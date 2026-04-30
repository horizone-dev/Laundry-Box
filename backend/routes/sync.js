const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const auth = require('../middleware/auth');

// Sync endpoint (protected by auth if needed, but for now we rely on shopId)
router.post('/', syncController.syncData);

module.exports = router;
