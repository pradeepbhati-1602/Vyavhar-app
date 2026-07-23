const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing
app.use(cors());
app.use(express.json());

// Ensure public folders exist for storing PDFs
const publicDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public', 'invoices'),
  path.join(__dirname, 'public', 'prescriptions')
];
publicDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve PDF files
app.use('/invoices', express.static(path.join(__dirname, 'public', 'invoices')));
app.use('/prescriptions', express.static(path.join(__dirname, 'public', 'prescriptions')));

// Mount routes (we will define these next)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/eyetests', require('./routes/eyetests'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/memberships', require('./routes/memberships'));
app.use('/api/audit', require('./routes/audit'));

// Initialize Database & Start Server
const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

startServer();
