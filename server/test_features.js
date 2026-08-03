const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { created_at: 'desc' }});
  if (!tenant) return console.log("No tenant");
  
  console.log("Before:", tenant.features);
  
  // Update features like superadmin.routes.js does
  const features = { whatsapp: false, membership_system: false };
  const updated = await prisma.tenant.update({
    where: { tenant_id: tenant.tenant_id },
    data: {
      features: typeof features === 'object' ? JSON.stringify(features) : features
    }
  });
  
  console.log("After:", updated.features);
  
  // Now parse them like SuperAdminDashboard does
  let parsedFeatures = {};
  if (typeof updated.features === 'string') {
    try { parsedFeatures = JSON.parse(updated.features); } catch(e) {}
  } else if (updated.features) {
    parsedFeatures = updated.features;
  }
  
  console.log("Parsed:", parsedFeatures);
  console.log("Parsed whatsapp:", parsedFeatures.whatsapp);
  console.log("Parsed whatsapp === undefined?", parsedFeatures.whatsapp === undefined);
}

test().catch(console.error).finally(() => prisma.$disconnect());
