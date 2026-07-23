// ─────────────────────────────────────────────────────────────────
// Server Entry Point
// ─────────────────────────────────────────────────────────────────

require('dotenv').config();
const app    = require('./app');
const { prisma } = require('./prisma');
const { startCronJobs } = require('./services/cron');

const PORT = process.env.PORT || 5000;

async function start() {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Make sure DATABASE_URL in .env is correct and the DB server is running.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Eyevengers API running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Start background jobs
    startCronJobs();
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
