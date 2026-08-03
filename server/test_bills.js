const { prisma } = require('./src/prisma');

async function checkBills() {
  const tenants = await prisma.tenant.findMany();
  const tenant_id = tenants[0].tenant_id;
  
  const totalBills = await prisma.bill.count({ where: { tenant_id } });
  console.log(`Total bills for tenant ${tenant_id}: ${totalBills}`);

  if (totalBills > 0) {
    const sample = await prisma.bill.findFirst({ where: { tenant_id } });
    console.log("Sample bill:", sample);
  }
}

checkBills().catch(console.error);
