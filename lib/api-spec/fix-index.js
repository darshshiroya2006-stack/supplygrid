import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "..", "api-zod", "src", "index.ts");

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, "utf8");
  // Remove export * from './generated/types' to resolve name conflicts with zod schemas
  content = content.replace(
    /export \* from ['"]\.\/generated\/types['"];?/g,
    ""
  );
  content = content.replace(
    /export type \* from ['"]\.\/generated\/types['"];?/g,
    ""
  );

  const lines = content.split(/\r?\n/);
  const uniqueLines = [];
  const seen = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      if (seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
    }
    uniqueLines.push(line);
  }
  fs.writeFileSync(indexPath, uniqueLines.join("\n"), "utf8");
  console.log("[CodeGen] Successfully sanitized api-zod index.ts exports");
}
