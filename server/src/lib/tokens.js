const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { hashToken, generateToken };
