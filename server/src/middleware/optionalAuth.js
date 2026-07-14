const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * Optional auth — attaches req.user when a valid ACTIVE user token is present.
 * Never elevates missing/invalid tokens to admin-wide access.
 */
module.exports = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token || !process.env.JWT_SECRET) {
    return next();
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
    if (user && user.status === "ACTIVE") {
      req.user = user;
    }
  } catch {
    // Ignore invalid tokens on optional auth routes.
  }

  next();
};
