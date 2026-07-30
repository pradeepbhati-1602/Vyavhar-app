const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found");
    return;
  }
  const tenant_id = tenant.tenant_id;
  
  let targetStoreId = null;
  let defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
  if (defaultStore) {
    targetStoreId = defaultStore.store_id;
  }
  
  console.log("Using store:", targetStoreId);

  const customers = [
    {
      name: "Test Customer",
      mobile: "9999999999",
      total_amount: "2500" // Mapped as a string from frontend
    }
  ];

  let skipped = 0;
  let updated = 0;
  let imported = 0;

  for (const c of customers) {
    let customer = await prisma.customer.findUnique({
      where: { tenant_id_mobile: { tenant_id, mobile: c.mobile } }
    });
    
    // Create it if it doesn't exist so we can test the update path
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenant_id,
          name: c.name,
          mobile: c.mobile,
          language: 'English',
          pending_due: 0
        }
      });
    }

    let rowUpdated = false;

    // Simulate duplicateStrategy = 'skip'
    if (customer) {
      if (c.total_amount === undefined && !c.invoice_number && c.re_sph === undefined && c.le_sph === undefined) {
         skipped++;
         continue;
      }
    }

    if (targetStoreId && (c.total_amount !== undefined || c.invoice_number)) {
      console.log("Would create bill for total:", c.total_amount);
      rowUpdated = true;
    }

    if (targetStoreId && (c.re_sph !== undefined || c.le_sph !== undefined)) {
      console.log("Would create eye test");
      rowUpdated = true;
    }

    if (rowUpdated) {
      updated++;
      console.log("Row updated!");
    }
  }

  console.log({ imported, skipped, updated });
}

test().catch(console.error).finally(() => prisma.$disconnect());
