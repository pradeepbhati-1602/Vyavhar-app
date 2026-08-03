const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bills = await prisma.bill.findMany({
    take: 5
  });
  console.log("Found bills:", bills.length);
  if (bills.length > 0) {
    console.log("First bill:", bills[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
