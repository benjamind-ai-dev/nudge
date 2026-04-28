import type { Prisma } from "@nudge/database";

/**
 * The transactional Prisma client passed into prisma.$transaction(async (tx) => {...}).
 * Use this type when you need to thread a transaction through a repository method.
 */
export type PrismaTransactionClient = Prisma.TransactionClient;
