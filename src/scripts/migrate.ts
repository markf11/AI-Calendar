#!/usr/bin/env ts-node

import { MigrationRunner } from '../config/migrations';
import { config } from '../config/environment';

async function runMigrations() {
  console.log('Starting database migrations...');
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
  
  try {
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runMigrations();
    console.log('✓ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}