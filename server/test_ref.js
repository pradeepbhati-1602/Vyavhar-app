const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const referrals = await prisma.referralMember.findMany();
    console.log(referrals);
  } catch (err) {
    console.error("Crash:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
