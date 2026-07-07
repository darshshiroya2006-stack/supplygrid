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
    console.log("Adding available_stock column if not exists...");
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS available_stock INT NOT NULL DEFAULT 0;
    `);

    console.log("Updating existing available_stock values...");
    await client.query(`
      UPDATE products p
      SET available_stock = ROUND(COALESCE((
        SELECT SUM(
          CASE 
            WHEN se.order_id IS NULL THEN se.quantity_kg::float8
            ELSE -ABS(se.quantity_kg::float8)
          END
        )
        FROM stock_entries se
        WHERE se.product_id = p.id
      ), 0))::int;
    `);

    console.log("Creating sync trigger function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION sync_product_stock_trigger()
      RETURNS TRIGGER AS $$
      DECLARE
        p_id INT;
        total_stock INT;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          p_id := OLD.product_id;
        ELSE
          p_id := NEW.product_id;
        END IF;

        IF p_id IS NOT NULL THEN
          SELECT ROUND(COALESCE(SUM(
            CASE 
              WHEN order_id IS NULL THEN quantity_kg::float8
              ELSE -ABS(quantity_kg::float8)
            END
          ), 0))::int
          INTO total_stock
          FROM stock_entries
          WHERE product_id = p_id;

          UPDATE products
          SET available_stock = total_stock
          WHERE id = p_id;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.product_id IS NOT NULL AND OLD.product_id <> NEW.product_id THEN
          SELECT ROUND(COALESCE(SUM(
            CASE 
              WHEN order_id IS NULL THEN quantity_kg::float8
              ELSE -ABS(quantity_kg::float8)
            END
          ), 0))::int
          INTO total_stock
          FROM stock_entries
          WHERE product_id = OLD.product_id;

          UPDATE products
          SET available_stock = total_stock
          WHERE id = OLD.product_id;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log("Creating trigger ON stock_entries...");
    await client.query(`
      DROP TRIGGER IF EXISTS trg_sync_product_stock ON stock_entries;
      CREATE TRIGGER trg_sync_product_stock
      AFTER INSERT OR UPDATE OR DELETE ON stock_entries
      FOR EACH ROW EXECUTE FUNCTION sync_product_stock_trigger();
    `);

    console.log("Migration successful!");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
