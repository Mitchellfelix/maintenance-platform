const prisma = require("../lib/prisma");

async function generateWorkOrderCode() {
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;

  const latest = await prisma.workOrder.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let nextNumber = 1;
  if (latest) {
    const suffix = latest.code.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}

module.exports = { generateWorkOrderCode };
