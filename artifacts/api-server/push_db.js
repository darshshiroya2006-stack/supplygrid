import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, { 
  max: 1,
  ssl: 'require' 
});
const db = drizzle(client);

async function main() {
  console.log("⚡ લાઈવ ડેટાબેઝ સાથે સિક્યોર SSL કનેક્શન થઈ રહ્યું છે...");
  
  try {
    // 1. admins ટેબલ (મલ્ટી-ટેનન્ટ આઈડી રેફરન્સ માટે જરૂરી)
    console.log("⏳ 'admins' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL,
        "password_hash" text NOT NULL,
        "role" text DEFAULT 'wholesaler',
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'admins' ટેબલ બની ગયું!");

    // 2. products ટેબલ
    console.log("⏳ 'products' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "vendor_id" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'products' ટેબલ બની ગયું!");

    // 3. stock_entries ટેબલ
    console.log("⏳ 'stock_entries' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "stock_entries" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer,
        "product_name" text,
        "quantity_kg" numeric(10, 2) DEFAULT 0,
        "order_id" integer,
        "vendor_id" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'stock_entries' ટેબલ પણ બની ગયું!");

    // 4. customers ટેબલ (જે ખૂટતું હતું)
    console.log("⏳ 'customers' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" serial PRIMARY KEY NOT NULL,
        "shop_name" text NOT NULL,
        "owner_name" text,
        "username" text,
        "password_hash" text,
        "phone" text,
        "email" text,
        "address" text,
        "city" text,
        "notes" text,
        "always_gst" boolean DEFAULT false,
        "role" text DEFAULT 'retailer',
        "vendor_id" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'customers' ટેબલ પણ બની ગયું!");

    // 5. suppliers ટેબલ (જે ખૂટતું હતું)
    console.log("⏳ 'suppliers' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "mobile" text,
        "main_products" text,
        "notes" text,
        "vendor_id" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'suppliers' ટેબલ પણ બની ગયું!");

    // 6. orders ટેબલ
    console.log("⏳ 'orders' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" serial PRIMARY KEY NOT NULL,
        "customer_id" integer,
        "billing_type" text,
        "payment_status" text DEFAULT 'pending',
        "total_amount" numeric(10, 2) DEFAULT 0,
        "vendor_id" integer,
        "sequence_number" integer,
        "vendor_order_index" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'orders' ટેબલ પણ બની ગયું!");

    console.log("🎉 સાચે જ બધા જ મેઇન ટેબલ્સ સક્સેસફુલી લાઈવ થઈ ગયા છે દર્શ ભાઈ!");
  } catch (error) {
    console.error("❌ એરર આવી ભાઈ:", error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

main();