const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");

const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, "..", "..", "uploads");
const GREENTAG_DIR = path.join(UPLOAD_ROOT, "greentagging");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const HEIF_BRANDS = new Set(["heic", "heif", "mif1", "msf1", "heim", "heix", "hevc"]);

function ensureUploadDirs() {
  fs.mkdirSync(GREENTAG_DIR, { recursive: true });
}

function publicUrlFor(filename) {
  return `/uploads/greentagging/${filename}`;
}

function absolutePathFor(filename) {
  return path.join(GREENTAG_DIR, filename);
}

function deleteUploadedFile(filename) {
  if (!filename) return;
  const fullPath = absolutePathFor(filename);
  if (!fullPath.startsWith(GREENTAG_DIR)) return;
  try {
    fs.unlinkSync(fullPath);
  } catch {
    // Ignore missing files.
  }
}

/** Sniff image type from file magic bytes (do not trust client mimetype alone). */
function detectImageMime(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(32);
  try {
    fs.readSync(fd, buf, 0, 32, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12).replace(/\0/g, "").toLowerCase();
    if (HEIF_BRANDS.has(brand)) {
      return brand.startsWith("heif") ? "image/heif" : "image/heic";
    }
  }
  return null;
}

function assertUploadedImage(file) {
  if (!file?.path) {
    throw Object.assign(new Error("Upload failed"), { status: 400 });
  }
  const detected = detectImageMime(file.path);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
    throw Object.assign(
      new Error("Only image files are allowed (JPEG, PNG, WebP, GIF, HEIC)"),
      { status: 400 },
    );
  }
  const claimed = file.mimetype;
  const claimedFamily = claimed?.split("/")[0];
  if (claimedFamily && claimedFamily !== "image") {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
    throw Object.assign(new Error("Only image files are allowed"), { status: 400 });
  }
  file.mimetype = detected;
  return detected;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDirs();
    cb(null, GREENTAG_DIR);
  },
  filename(_req, file, cb) {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(
      Object.assign(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF, HEIC)"), {
        status: 400,
      }),
    );
  }
  cb(null, true);
}

const greentagPhotoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single("photo");

function handleMulterUpload(req, res, next) {
  greentagPhotoUpload(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "Photo must be 10 MB or smaller" });
        }
        return res.status(400).json({ error: error.message });
      }
      const status = error.status || 400;
      return res.status(status).json({ error: error.message || "Upload failed" });
    }
    if (!req.file) return next();
    try {
      assertUploadedImage(req.file);
      return next();
    } catch (verifyError) {
      const status = verifyError.status || 400;
      return res.status(status).json({ error: verifyError.message || "Upload failed" });
    }
  });
}

module.exports = {
  UPLOAD_ROOT,
  GREENTAG_DIR,
  ensureUploadDirs,
  publicUrlFor,
  absolutePathFor,
  deleteUploadedFile,
  handleMulterUpload,
  detectImageMime,
};
