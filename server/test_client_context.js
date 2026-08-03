const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  
  const tenant = await prisma.tenant.findUnique({ where: { tenant_id: user.tenant_id }});
  
  let parsedFeatures = {};
  if (typeof tenant.features === 'string') {
    try {
      parsedFeatures = JSON.parse(tenant.features);
    } catch (e) {
      console.error(e);
    }
  } else if (typeof tenant.features === 'object' && tenant.features !== null) {
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
  
  console.log("FINAL PARSED FEATURES:", parsedFeatures);
  console.log("Has sunglasses_billing?", parsedFeatures['sunglasses_billing'] !== false);
  console.log("Has repair_orders?", parsedFeatures['repair_orders'] !== false);
}

main().catch(console.error).finally(() => prisma.$disconnect());
