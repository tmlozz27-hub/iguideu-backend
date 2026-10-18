import express from "express";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID())
  }),
  limits: {
    fileSize: 75 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || "");
    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");

    if (!isVideo && !isImage) {
      req.uploadRejectReason = "UNSUPPORTED_FILE_TYPE";
      req.uploadRejectedMime = mime;
      return cb(null, false);
    }

    return cb(null, true);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadFileToCloudinary(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let input;
    let output;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;

      if (error) {
        input?.destroy();
        output?.destroy();
        reject(error);
        return;
      }

      if (!result?.secure_url || !result?.public_id) {
        reject(new Error("CLOUDINARY_UPLOAD_RESULT_INVALID"));
        return;
      }

      resolve(result);
    };

    try {
      input = fs.createReadStream(filePath);
      output = cloudinary.uploader.upload_stream(options, (error, result) => {
        finish(error, result);
      });

      input.on("error", finish);
      output.on("error", finish);
      input.pipe(output);
    } catch (error) {
      finish(error);
    }
  });
}
const activeUploads = new Set();

function limitConcurrentUploads(req, res, next) {
  const userId = String(req.user?.id || "").trim();

  if (!userId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  if (activeUploads.has(userId)) {
    return res.status(429).json({
      ok: false,
      error: "UPLOAD_ALREADY_IN_PROGRESS"
    });
  }

  activeUploads.add(userId);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeUploads.delete(userId);
  };

  res.once("finish", release);
  res.once("close", release);
  next();
}

const uploadMedia = upload.single("file");

function handleMediaUpload(req, res, next) {
  uploadMedia(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        ok: false,
        error: error.code === "LIMIT_FILE_SIZE"
          ? "FILE_TOO_LARGE"
          : "UPLOAD_INVALID"
      });
    }

    console.error("UPLOAD_MULTER_ERROR", error?.message || "");
    return res.status(500).json({
      ok: false,
      error: "UPLOAD_MEDIA_ERROR"
    });
  });
}
router.post("/media", requireAuth, limitConcurrentUploads, handleMediaUpload, async (req, res) => {
  const temporaryFile = req.file?.path;
  try {
    console.log("UPLOAD_MEDIA_START", {
      hasFile: !!req.file,
      size: req.file?.size || 0,
      mimetype: req.file?.mimetype || "",
      contentType: req.headers["content-type"],
    });

    if (req.uploadRejectReason === "UNSUPPORTED_FILE_TYPE") {
      return res.status(400).json({
        ok: false,
        error: "UNSUPPORTED_FILE_TYPE",
        mimetype: String(req.uploadRejectedMime || "")
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "FILE_REQUIRED"
      });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "CLOUDINARY_NOT_CONFIGURED"
      });
    }


    const mime = String(req.file.mimetype || "");
    const detected = await fileTypeFromFile(req.file.path);
    const detectedMime = String(detected?.mime || "");

    if (!detected || (!detectedMime.startsWith("image/") && !detectedMime.startsWith("video/"))) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_MEDIA_CONTENT"
      });
    }
    const isVideo = detectedMime.startsWith("video/");
    const isImage = detectedMime.startsWith("image/");

    if (!isVideo && !isImage) {
      return res.status(400).json({
        ok: false,
        error: "UNSUPPORTED_FILE_TYPE",
        mimetype: mime
      });
    }

    const result = await uploadFileToCloudinary(req.file.path, {
      folder: "iguideu/guides",
      resource_type: isVideo ? "video" : "image"
    });

    console.log("UPLOAD_MEDIA_SUCCESS", {
      resourceType: result.resource_type
    });

    return res.json({
      ok: true,
      url: result.secure_url,
      resourceType: result.resource_type,
      publicId: result.public_id
    });
  } catch (error) {
    console.log("UPLOAD_MEDIA_ERROR", {
      message: error?.message || "",
      name: error?.name || "",
      code: error?.code || ""
    });

    return res.status(500).json({
      ok: false,
      error: "UPLOAD_MEDIA_ERROR"
    });
  } finally {
    if (temporaryFile) {
      await fs.promises.unlink(temporaryFile).catch((error) => {
        console.error("UPLOAD_TEMP_CLEANUP_ERROR", error?.message || "");
      });
    }
  }
});

export default router;