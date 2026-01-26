/**
 * Migrate User Accounting Tables
 *
 * Adds the user accounting system tables:
 * - aui_usage_events
 * - aui_user_usage_snapshots
 * - aui_api_keys
 * - aui_tier_defaults
 * - aui_user_quota_overrides
 * - aui_user_preferences
 * - aui_provider_cost_rates
 *
 * Also seeds default tiers and provider cost rates.
 */
import { Pool } from 'pg';
import {
  CREATE_AUI_USAGE_EVENTS_TABLE,
  CREATE_AUI_USER_USAGE_SNAPSHOTS_TABLE,
  CREATE_AUI_API_KEYS_TABLE,
  CREATE_AUI_TIER_DEFAULTS_TABLE,
  CREATE_AUI_USER_QUOTA_OVERRIDES_TABLE,
  CREATE_AUI_USER_PREFERENCES_TABLE,
  CREATE_AUI_PROVIDER_COST_RATES_TABLE,
  CREATE_AUI_USER_ACCOUNTING_INDEXES,
  SEED_AUI_TIER_DEFAULTS,
  SEED_AUI_PROVIDER_COST_RATES,
} from '../src/storage/schema-aui.js';

async function main() {
  console.log('Migrating user accounting tables...\n');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'humanizer_archive',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating aui_usage_events...');
    await client.query(CREATE_AUI_USAGE_EVENTS_TABLE);

    console.log('Creating aui_user_usage_snapshots...');
    await client.query(CREATE_AUI_USER_USAGE_SNAPSHOTS_TABLE);

    console.log('Creating aui_api_keys...');
    await client.query(CREATE_AUI_API_KEYS_TABLE);

    console.log('Creating aui_tier_defaults...');
    await client.query(CREATE_AUI_TIER_DEFAULTS_TABLE);

    console.log('Creating aui_user_quota_overrides...');
    await client.query(CREATE_AUI_USER_QUOTA_OVERRIDES_TABLE);

    console.log('Creating aui_user_preferences...');
    await client.query(CREATE_AUI_USER_PREFERENCES_TABLE);

    console.log('Creating aui_provider_cost_rates...');
    await client.query(CREATE_AUI_PROVIDER_COST_RATES_TABLE);

    console.log('Creating indexes...');
    await client.query(CREATE_AUI_USER_ACCOUNTING_INDEXES);

    console.log('Seeding tier defaults...');
    await client.query(SEED_AUI_TIER_DEFAULTS);

    console.log('Seeding provider cost rates...');
    await client.query(SEED_AUI_PROVIDER_COST_RATES);

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
