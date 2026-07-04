import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

// અહીં આપણે ખાસ સિક્યોરિટી માટે SSL Require ઓપ્શન ઉમેર્યો છે
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, { 
  max: 1,
  ssl: 'require' // આ લાઇન ક્લાઉડ સિક્યોરિટી કનેક્શન પાકું કરશે
});
const db = drizzle(client);

async function main() {
  console.log("⚡ લાઈવ ડેટાબેઝ સાથે સિક્યોર SSL કનેક્શન થઈ રહ્યું છે...");
  
  try {
    // 1. products ટેબલ બનાવવું
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

    // 2. stock_entries ટેબલ બનાવવું
    console.log("⏳ 'stock_entries' ટેબલ બનાવવાનું ચાલુ છે...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "stock_entries" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer,
        "product_name" text,
        "vendor_id" integer,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ 'stock_entries' ટેબલ પણ બની ગયું!");

    console.log("🎉 સાચે જ બધું સેટ થઈ ગયું દર્શ ભાઈ! બધા ટેબલ્સ સક્સેસફુલી લાઈવ થઈ ગયા છે!");
  } catch (error) {
    console.error("❌ એરર આવી ભાઈ:", error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

main();