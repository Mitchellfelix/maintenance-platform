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
    return cb(Object.assign(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF, HEIC)"), { status: 400 }));
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
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Photo must be 10 MB or smaller" });
      }
      return res.status(400).json({ error: error.message });
    }
    const status = error.status || 400;
    return res.status(status).json({ error: error.message || "Upload failed" });
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
};
