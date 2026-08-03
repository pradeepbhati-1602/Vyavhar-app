const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      store_id: user.store_id
    },
    process.env.JWT_SECRET || 'fallback_secret_key_123'
  );
  console.log("Token:", token);
  
  const tenant = await prisma.tenant.findUnique({ where: { tenant_id: user.tenant_id }});
  console.log("Tenant features type:", typeof tenant.features);
  console.log("Tenant features:", tenant.features);
}

main().catch(console.error).finally(() => prisma.$disconnect());
