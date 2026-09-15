import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export const devUsers = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'alice@planner.test' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'bob@planner.test' },
];

export async function createDevDatabase(dataDir) {
  const db = new PGlite(dataDir);
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text UNIQUE);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  `);
  for (const user of devUsers) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [user.id, user.email]);
  }
  const migration = await readFile(new URL('../supabase/migrations/202609140001_planner_sync.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  return db;
}

export function asUser(db, userId, run) {
  return db.transaction(async transaction => {
    await transaction.exec('SET LOCAL ROLE authenticated');
    await transaction.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return run(transaction);
  });
}
