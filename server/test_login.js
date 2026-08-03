const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function test() {
  const users = await prisma.user.findMany({ take: 5, orderBy: { created_at: 'desc' } });
  console.log("Recent users:");
  for (const u of users) {
    console.log(u.email, u.mobile, u.role);
    const valid = await bcrypt.compare('owner123', u.password_hash);
    console.log("owner123 valid?", valid);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
