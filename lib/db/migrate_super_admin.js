import pg from 'pg';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('../../artifacts/api-server/.env');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    databaseUrl = match[1].replace(/['"]/g, '').trim();
  }
}

if (!databaseUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Connecting to database...");
  const client = await pool.connect();
  try {
    console.log("Adding status column to admins if not exists...");
    await client.query(`
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
    `);

    console.log("Updating existing admin user to super_admin and ACTIVE...");
    await client.query(`
      UPDATE admins SET role = 'super_admin', status = 'ACTIVE' WHERE username = 'admin';
    `);

    console.log("Updating other existing wholesalers to ACTIVE to prevent lockouts...");
    await client.query(`
      UPDATE admins SET status = 'ACTIVE' WHERE username <> 'admin' AND role = 'wholesaler';
    `);

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
