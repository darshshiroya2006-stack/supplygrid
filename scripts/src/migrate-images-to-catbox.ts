import { db, productsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function uploadToCatbox(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  const blob = new Blob([new Uint8Array(buffer)], { type: mimetype });
  formData.append("fileToUpload", blob, originalname);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Catbox upload HTTP ${response.status} failed: ${errText}`);
  }

  const fileUrl = await response.text();
  if (!fileUrl.trim().startsWith("https://files.catbox.moe/")) {
    throw new Error(`Catbox upload failed: ${fileUrl}`);
  }

  return fileUrl.trim();
}

async function main() {
  console.log("Starting product image migration to Catbox...");

  const products = await db.select().from(productsTable);
  console.log(`Found ${products.length} products total.`);

  for (const product of products) {
    const imageUrl = product.imageUrl;
    if (!imageUrl) {
      console.log(`Product ${product.id} (${product.name}) has no image.`);
      continue;
    }

    // Skip if it's already an absolute URL or standard asset
    if (
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://") ||
      imageUrl.includes("://") ||
      imageUrl.startsWith("/assets/")
    ) {
      console.log(`Product ${product.id} (${product.name}) already has absolute or asset URL: ${imageUrl}`);
      continue;
    }

    // Resolve relative path
    const match = imageUrl.match(/(?:objects\/uploads\/|storage\/objects\/uploads\/)([^/]+)$/);
    if (!match) {
      console.log(`Product ${product.id} (${product.name}) image path is not relative uploads path: ${imageUrl}`);
      continue;
    }

    const filename = match[1];
    const possiblePaths = [
      path.join(process.cwd(), "artifacts/api-server/.local/storage/uploads", filename),
      path.join(process.cwd(), "../artifacts/api-server/.local/storage/uploads", filename),
      path.join(process.cwd(), ".local/storage/uploads", filename),
    ];

    let filePath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      console.warn(`[WARNING] Local file not found for product ${product.id} (${product.name}) image: ${filename}. Setting to null fallback.`);
      await db.update(productsTable)
        .set({ imageUrl: null })
        .where(eq(productsTable.id, product.id));
      continue;
    }

    try {
      console.log(`Migrating product ${product.id} (${product.name}) local file ${filePath}...`);
      const buffer = await fs.promises.readFile(filePath);

      const ext = path.extname(filename).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      const absoluteUrl = await uploadToCatbox(buffer, filename, contentType);
      console.log(`Uploaded to Catbox: ${absoluteUrl}`);

      // Update in database
      await db.update(productsTable)
        .set({ imageUrl: absoluteUrl })
        .where(eq(productsTable.id, product.id));
      console.log(`Successfully migrated product ${product.id} (${product.name}) to ${absoluteUrl}`);
    } catch (err) {
      console.error(`Failed to migrate product ${product.id} (${product.name}):`, err);
    }
  }

  console.log("Migration complete.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Migration script crashed:", err);
  await pool.end();
  process.exit(1);
});
