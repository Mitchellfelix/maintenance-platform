-- Replace MANAGER/TECHNICIAN with OPS_LEAD/OPERATOR
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'OPS_LEAD', 'OPERATOR', 'REQUESTER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'MANAGER' THEN 'OPS_LEAD'::"UserRole_new"
    WHEN 'TECHNICIAN' THEN 'OPERATOR'::"UserRole_new"
    ELSE "role"::text::"UserRole_new"
  END
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'REQUESTER'::"UserRole_new";

ALTER TABLE "AccessRequest" ALTER COLUMN "requestedRole" TYPE "UserRole_new" USING (
  CASE "requestedRole"::text
    WHEN 'MANAGER' THEN 'OPS_LEAD'::"UserRole_new"
    WHEN 'TECHNICIAN' THEN 'OPERATOR'::"UserRole_new"
    ELSE "requestedRole"::text::"UserRole_new"
  END
);

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
