import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const uploadDir = path.join(process.cwd(), ".local/storage/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

async function uploadToImgBB(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimetype });
  formData.append("image", blob, originalname);

  const response = await fetch("https://api.imgbb.com/1/upload?key=6d962cfc21ffeb766d744837e289bfad", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ImgBB upload HTTP ${response.status} failed: ${errText}`);
  }

  const resData = (await response.json()) as any;
  if (!resData.success || !resData.data?.url) {
    throw new Error(resData.error?.message || "ImgBB upload was unsuccessful");
  }

  return resData.data.url;
}

router.post(
  "/storage/upload",
  async (req: Request, res: Response) => {
    try {
      await new Promise<void>((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      console.log(`[Storage] Uploading file to ImgBB: ${file.originalname}`);
      const imageUrl = await uploadToImgBB(file.buffer, file.originalname, file.mimetype);
      console.log(`[Storage] Uploaded to ImgBB successfully: ${imageUrl}`);

      res.json({ ok: true, imageUrl });
    } catch (error: any) {
      console.error("SERVER_UPLOAD_CRASH:", error);
      res.status(500).json({ error: error.message || "Failed to upload file to ImgBB" });
    }
  }
);


/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
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

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
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
