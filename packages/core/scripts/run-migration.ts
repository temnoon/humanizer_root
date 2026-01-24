/**
 * Run database migration
 */
import { initContentStore } from '../src/storage/postgres-content-store.js';

async function main() {
  console.log('Running migration...');
  try {
    const store = await initContentStore({
      host: 'localhost',
      port: 5432,
      database: 'humanizer_archive',
      user: 'postgres',
      password: 'postgres',
      embeddingDimension: 768,
    });
    console.log('Migration complete!');
    await store.close();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

main();
