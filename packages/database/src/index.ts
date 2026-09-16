export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
export { createDefaultTiersAndSequences } from "./create-defaults";
export {
  ENTITLED_ACCOUNT_STATUSES,
  isAccountEntitled,
  entitledAccountWhere,
  entitledBusinessWhere,
} from "./entitlement";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
