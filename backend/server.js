const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const orderRoutes = require('./routes/orders');
const roleRoutes = require('./routes/roles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/laundry_saas';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/roles', roleRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Laundry Management System Backend Running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log('--- REFRESHED SCHEMA ACTIVE: PHONE/PIN ONLY ---');
});
