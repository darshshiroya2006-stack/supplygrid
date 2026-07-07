import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const uploadDir = path.join(process.cwd(), ".local/storage/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const isLocal = !process.env.REPL_ID;
    if (isLocal) {
      const objectId = randomUUID();
      const ext = path.extname(name) || ".png";
      const filename = `${objectId}${ext}`;

      const host = req.headers.host || "localhost:3002";
      const protocol = req.secure ? "https" : "http";
      const uploadURL = `${protocol}://${host}/api/storage/local-upload/${filename}`;
      const objectPath = `/objects/uploads/${filename}`;

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

// ─── Cloud Storage Helpers ──────────────────────────────────────────────────

async function uploadToCloudinary(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) throw new Error("CLOUDINARY_URL not configured");

  const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (!match) throw new Error("Invalid CLOUDINARY_URL format");

  const [, apiKey, apiSecret, cloudName] = match;
  const timestamp = Math.round(Date.now() / 1000);
  
  const crypto = await import("crypto");
  const signatureStr = `timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const base64Data = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64:${base64Data}`;

  const params = new URLSearchParams();
  params.append("file", dataUrl);
  params.append("api_key", apiKey);
  params.append("timestamp", String(timestamp));
  params.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const resData = await response.json() as any;
  return resData.secure_url;
}

async function uploadToPixeldrain(buffer: Buffer, filename: string): Promise<string> {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
  const boundaryMiddle = `--${boundary}\r\n`;
  const boundaryLast = `--${boundary}--\r\n`;

  const bodyParts: Buffer[] = [];
  bodyParts.push(Buffer.from(boundaryMiddle));
  bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
  bodyParts.push(Buffer.from("Content-Type: application/octet-stream\r\n\r\n"));
  bodyParts.push(buffer);
  bodyParts.push(Buffer.from("\r\n"));
  bodyParts.push(Buffer.from(boundaryLast));

  const bodyBuffer = Buffer.concat(bodyParts);

  const response = await fetch("https://pixeldrain.com/api/file", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(bodyBuffer.length),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    throw new Error(`Pixeldrain upload failed with status ${response.status}`);
  }

  const data = await response.json() as any;
  if (!data.id) {
    throw new Error("Pixeldrain response did not contain file id");
  }

  return `https://pixeldrain.com/api/file/${data.id}`;
}

async function uploadToCatbox(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
  const boundaryMiddle = `--${boundary}\r\n`;
  const boundaryLast = `--${boundary}--\r\n`;

  const bodyParts: Buffer[] = [];

  // reqtype field
  bodyParts.push(Buffer.from(boundaryMiddle));
  bodyParts.push(Buffer.from('Content-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n'));

  // fileToUpload field
  bodyParts.push(Buffer.from(boundaryMiddle));
  bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\n`));
  bodyParts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));
  bodyParts.push(buffer);
  bodyParts.push(Buffer.from("\r\n"));

  // Closing boundary
  bodyParts.push(Buffer.from(boundaryLast));

  const bodyBuffer = Buffer.concat(bodyParts);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(bodyBuffer.length),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    throw new Error(`Catbox upload failed with status ${response.status}: ${await response.text()}`);
  }

  const fileUrl = await response.text();
  return fileUrl.trim();
}

async function uploadToGCS(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("GCS_BUCKET not configured");
  }

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(`uploads/${filename}`);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
    resumable: false,
  });

  try {
    await file.makePublic();
  } catch (err) {
    console.warn("[Storage] Could not make GCS file public:", err);
  }

  return `https://storage.googleapis.com/${bucketName}/uploads/${filename}`;
}

async function saveToLocal(buffer: Buffer, filename: string): Promise<string> {
  const filePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  console.log(`[Storage] Saved file locally to ${filePath}`);
  return `/objects/uploads/${filename}`;
}

async function uploadToStorage(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  // 1. Try GCS / Firebase Storage
  if (process.env.GCS_BUCKET) {
    try {
      console.log("[Storage] Attempting to upload to GCS...");
      return await uploadToGCS(buffer, filename, mimeType);
    } catch (err) {
      console.error("[Storage] GCS upload failed:", err);
    }
  }

  // 2. Try Cloudinary
  if (process.env.CLOUDINARY_URL) {
    try {
      console.log("[Storage] Attempting to upload to Cloudinary...");
      return await uploadToCloudinary(buffer, filename, mimeType);
    } catch (err) {
      console.error("[Storage] Cloudinary upload failed:", err);
    }
  }

  // 3. Try Pixeldrain (only if API key is provided)
  if (process.env.PIXELDRAIN_API_KEY) {
    try {
      console.log("[Storage] Attempting to upload to Pixeldrain...");
      return await uploadToPixeldrain(buffer, filename);
    } catch (err) {
      console.error("[Storage] Pixeldrain upload failed:", err);
    }
  }

  // 4. Try Catbox (only if userhash is provided)
  if (process.env.CATBOX_USERHASH) {
    try {
      console.log("[Storage] Attempting to upload to Catbox...");
      return await uploadToCatbox(buffer, filename, mimeType);
    } catch (err) {
      console.error("[Storage] Catbox upload failed:", err);
    }
  }

  // 5. Fallback to Local storage (always works)
  try {
    console.log("[Storage] Falling back to local storage...");
    return await saveToLocal(buffer, filename);
  } catch (err) {
    console.error("[Storage] Local storage save failed:", err);
    throw new Error("Failed to save file to any storage provider.");
  }
}

/**
 * PUT /storage/local-upload/:filename
 *
 * Direct file upload endpoint proxying to Cloud Storage.
 */
router.put(
  "/storage/local-upload/:filename",
  express.raw({ type: "*/*", limit: "20mb" }),
  async (req: Request, res: Response) => {
    try {
      const buffer = req.body as Buffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: "Empty file body" });
        return;
      }

      const rawFilename = req.params.filename;
      const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
      const contentType = req.headers["content-type"] || "image/png";

      console.log(`[Storage] Received upload buffer for ${filename} (${buffer.length} bytes)`);
      const imageUrl = await uploadToStorage(buffer, filename, contentType);
      console.log(`[Storage] Proxy uploaded to cloud successfully: ${imageUrl}`);

      res.json({ ok: true, imageUrl });
    } catch (err: any) {
      req.log.error({ err }, "Cloud proxy upload failed");
      res.status(500).json({ error: err.message || "Failed to upload file to cloud" });
    }
  }
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    const localFilename = wildcardPath.replace(/^uploads\//, "");
    const localFilePath = path.join(uploadDir, localFilename);
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      const ext = path.extname(localFilePath).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      fs.createReadStream(localFilePath).pipe(res);
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
