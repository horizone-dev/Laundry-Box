const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes      = require('./routes/auth');
const syncRoutes      = require('./routes/sync');
const orderRoutes     = require('./routes/orders');
const roleRoutes      = require('./routes/roles');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'file://'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith('file://')) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Access Denied'));
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Force HTTPS check in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      return res.status(403).json({ success: false, message: 'HTTPS security connection is required' });
    }
  }
  next();
});

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  message: { success: false, message: 'Too many requests from this IP, please try again later' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit login attempts to 10 per window
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' }
});

// Serve static dashboard files from backend/public
app.use(express.static(path.join(__dirname, 'public')));

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Disable Mongoose query buffering when offline to fail fast
mongoose.set('bufferCommands', false);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/laundry_saas';
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 2000 // Fail fast (2 seconds) if offline
})
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/sync',      apiLimiter, syncRoutes);
app.use('/api/orders',    apiLimiter, orderRoutes);
app.use('/api/roles',     roleRoutes);

// Protect dashboard login route specifically with stricter rate limits
app.use('/api/dashboard/login', loginLimiter);
app.use('/api/dashboard', dashboardRoutes);

// Serve dashboard HTML at /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Laundry Box Backend Running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`📊 Branch Dashboard: http://localhost:${PORT}/dashboard`);
  console.log('--- REFRESHED SCHEMA ACTIVE: SECURE AUTHENTICATION ---');
});
