const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { shopId, name, email, password, role } = req.body;
    const user = new User({ shopId, name, email, password, role });
    await user.save();
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, shopId, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, shopId: user.shopId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, shopId: user.shopId, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
