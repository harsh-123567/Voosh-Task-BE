const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

async function startProduction() {
  console.log('🚀 Starting production deployment...');

  try {
    // Check if dist directory exists
    const distPath = path.join(__dirname, '../dist');
    if (!fs.existsSync(distPath)) {
      console.log('📦 Building application...');
      await execAsync('npm run build');
    }

    // Check if this is the first deployment or if we need to populate the database
    const shouldPopulate = process.env.POPULATE_ON_START === 'true';

    if (shouldPopulate) {
      console.log('📰 Populating database with articles...');
      try {
        // Use the compiled version if available, fallback to ts-node
        if (fs.existsSync(path.join(distPath, 'scripts/populate-db.js'))) {
          await execAsync('npm run populate:prod');
        } else {
          await execAsync('npm run populate');
        }
        console.log('✅ Database populated successfully');
      } catch (error) {
        console.warn('⚠️  Database population failed, continuing with startup:', error.message);
        // Don't fail the entire startup if population fails
      }
    }

    console.log('🌐 Starting server...');
    // Start the main application
    require('../dist/app.js');
  } catch (error) {
    console.error('❌ Failed to start production server:', error);
    process.exit(1);
  }
}

startProduction();
