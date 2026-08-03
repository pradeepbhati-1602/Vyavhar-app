const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  
  // 1. Update DB with repair_orders: false
  await prisma.tenant.update({
    where: { tenant_id: user.tenant_id },
    data: { features: JSON.stringify({ repair_orders: false }) }
  });
  
  // 2. Fetch tenant
  const tenant = await prisma.tenant.findUnique({ where: { tenant_id: user.tenant_id }});
  
  // 3. Simulate FeatureContext
  let parsedFeatures = {};
  if (typeof tenant.features === 'string') {
    parsedFeatures = JSON.parse(tenant.features);
  } else if (typeof tenant.features === 'object') {
    parsedFeatures = tenant.features;
  }
  
  const legacyMap = {
    'multi_store': tenant.multi_store_enabled,
    'membership_system': tenant.membership_system_enabled,
    'referral_system': tenant.referral_system_enabled,
    'whatsapp': tenant.whatsapp_auto_send_enabled,
    'eye_test': tenant.eye_test_module_enabled,
    'repair_orders': tenant.repair_module_enabled,
    'reports': tenant.advanced_reports_enabled
  };

  for (const [key, value] of Object.entries(legacyMap)) {
    if (value !== undefined && parsedFeatures[key] === undefined) {
      parsedFeatures[key] = value;
    }
  }
  
  console.log("Legacy DB repair_module_enabled:", tenant.repair_module_enabled);
  console.log("FINAL parsedFeatures.repair_orders:", parsedFeatures.repair_orders);
}

main().catch(console.error).finally(() => prisma.$disconnect());
