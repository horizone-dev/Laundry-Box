const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.signup);
router.post('/login', authController.login);
router.get('/users', authController.getUsers);
router.put('/users/:id', authController.updateUser);
router.delete('/users/:id', authController.deleteUser);
router.post('/verify-manager-pin', authController.verifyManagerPin);
router.post('/reset', authController.resetUsers);

module.exports = router;
