import app from './app';
import { testConnection } from './db/pool';

const PORT = process.env.PORT || 3001;

async function start() {
  // Test database connection (if configured)
  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log('✓ PostgreSQL connected — data will persist');
  } else {
    console.log('⚠ No database connection — using in-memory storage (data lost on restart)');
  }

  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
