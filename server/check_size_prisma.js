const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const dbSizeRes = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as raw_size;`;
  console.log('DB SIZE:', dbSizeRes);

  const billSizeRes = await prisma.$queryRaw`SELECT pg_total_relation_size('"Bill"') as bill_size_bytes, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'Bill') as bill_count;`;
  console.log('BILL SIZE:', billSizeRes);

  await prisma.$disconnect();
}
run();
