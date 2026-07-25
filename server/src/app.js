// ─────────────────────────────────────────────────────────────────
// Express App Setup (separated from server.js for testability)
// ─────────────────────────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (invoices, prescriptions)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Health check ──────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Eyevengers Optical API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── API Routes (will be added step by step) ───────────────────────
app.use('/api/superadmin', require('./routes/superadmin.routes'));
app.use('/api/auth',       require('./routes/auth.routes'));
app.use('/api/stores',     require('./routes/store.routes'));
app.use('/api/dashboard',  require('./routes/dashboard.routes'));
app.use('/api/customers',  require('./routes/customer.routes'));
app.use('/api/products',   require('./routes/product.routes'));
app.use('/api/bills',      require('./routes/bill.routes'));
app.use('/api/invoices',   require('./routes/invoice.routes'));
app.use('/api/memberships',require('./routes/membership.routes'));
app.use('/api/reports',    require('./routes/report.routes'));
app.use('/api/tenant',     require('./routes/tenant.routes'));
app.use('/api/plan-templates', require('./routes/planTemplate.routes'));
app.use('/api/settings',   require('./routes/settings.routes'));

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

module.exports = app;
