const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { shopId, name, email, password, pin, userId, role } = req.body;
    const user = new User({ shopId, name, email, password, pin, userId, role });
    await user.save();
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, userId, shopId, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, secret, method } = req.body; // identifier: email/name/userId, secret: password/pin
    
    // Find user by any identifier
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { userId: identifier },
        { name: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    let isMatch = false;
    if (method === 'pin') {
      isMatch = await user.comparePin(secret);
    } else {
      isMatch = await user.comparePassword(secret);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, userId: user.userId, shopId: user.shopId, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
