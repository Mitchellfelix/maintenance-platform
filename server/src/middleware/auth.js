const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * Authenticate request and load fresh role/status from the database.
 * Demotions, deactivations, and pending status take effect immediately.
 */
module.exports = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token) return res.status(401).json({ error: "No token provided" });
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not configured" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        error: "Your account is pending admin approval. Please try again after an admin approves your access request.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
