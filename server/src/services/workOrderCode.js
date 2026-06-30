const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");

const MAX_RETRIES = 3;

async function nextCodeForPrefix(tx, prefix) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;

  const latest = await tx.workOrder.findFirst({
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

async function createWorkOrderWithCode(data) {
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const code = await nextCodeForPrefix(tx, prefix);
        return tx.workOrder.create({ data: { ...data, code } });
      });
    } catch (error) {
      lastError = error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < MAX_RETRIES - 1
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

module.exports = { createWorkOrderWithCode };
