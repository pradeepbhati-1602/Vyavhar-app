const billController = require('./src/controllers/bill.controller');
const { prisma } = require('./src/prisma');

async function testGetBills() {
  const tenants = await prisma.tenant.findMany();
  const tenant_id = tenants[0].tenant_id;

  const req = {
    user: { tenant_id, role: 'Owner' },
    query: { is_paginated: 'true', page: '1', limit: '50', search: '' }
  };

  const res = {
    json: (data) => console.log(JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('STATUS', code, data) })
  };

  await billController.getBills(req, res);
}

testGetBills().catch(console.error);
