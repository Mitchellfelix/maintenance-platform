const fs = require("fs");
const path = require("path");

let cached = null;

function getAppVersion() {
  if (cached) return cached;

  const candidates = [
    path.join(__dirname, "../../../package.json"),
    path.join(__dirname, "../../package.json"),
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      cached = {
        name: pkg.name || "maintenance-platform",
        version: pkg.version || "0.0.0",
      };
      return cached;
    } catch {
      // try next
    }
  }

  cached = { name: "maintenance-platform", version: "0.0.0" };
  return cached;
}

module.exports = { getAppVersion };
