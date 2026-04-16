import { PrismaClient } from "@prisma/client";
import { createDefaultTiersAndSequences } from "./create-defaults";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const existingAccount = await prisma.account.findFirst({
    where: { email: "seed@nudge.test" },
  });

  if (existingAccount) {
    console.log("Seed data already exists — skipping.");
    return;
  }

  const account = await prisma.account.create({
    data: {
      name: "Seed Test Company",
      email: "seed@nudge.test",
      plan: "starter",
      status: "trial",
      maxBusinesses: 1,
    },
  });
  console.log(`Created account: ${account.id}`);

  const business = await prisma.business.create({
    data: {
      accountId: account.id,
      name: "Seed Test Business",
      accountingProvider: "quickbooks",
      senderName: "Sandra Johnson",
      senderEmail: "sandra@seedtest.com",
      timezone: "America/New_York",
    },
  });
  console.log(`Created business: ${business.id}`);

  await createDefaultTiersAndSequences(prisma, business.id);
  console.log("Created default tiers, sequences, and steps.");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
