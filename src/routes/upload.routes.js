import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const uploadRateLimitStore = new Map();

function uploadRateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  return (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || "unknown");

    const now = Date.now();

    if (uploadRateLimitStore.size > 1000) {
      for (const [storedKey, storedValue] of uploadRateLimitStore.entries()) {
        if (!storedValue || now > storedValue.resetAt) {
          uploadRateLimitStore.delete(storedKey);
        }
      }
    }

    const key = ip;
    const current = uploadRateLimitStore.get(key) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    uploadRateLimitStore.set(key, current);

    if (current.count > max) {
      return res.status(429).json({
        ok: false,
        error: "TOO_MANY_REQUESTS",
      });
    }

    next();
  };
}

const mediaUploadLimiter = uploadRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

const upload = multer({
  storage: multer.memoryStorage(),
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

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    stream.end(buffer);
  });
}

router.post("/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    console.log("UPLOAD_MEDIA_START", {
      hasFile: !!req.file,
      size: req.file?.size || 0,
      mimetype: req.file?.mimetype || "",
      contentType: req.headers["content-type"],
      user: req.user?.email || ""
    });

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "CLOUDINARY_NOT_CONFIGURED"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "FILE_REQUIRED"
      });
    }

    const mime = String(req.file.mimetype || "");
    const isVideo = mime.startsWith("video/");
    const isImage = mime.startsWith("image/");

    if (!isVideo && !isImage) {
      return res.status(400).json({
        ok: false,
        error: "UNSUPPORTED_FILE_TYPE",
        mimetype: mime
      });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
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
  }
});

export default router;