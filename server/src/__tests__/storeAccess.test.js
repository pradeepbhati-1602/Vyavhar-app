const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const { prisma } = require('../prisma');
const bcrypt = require('bcryptjs');

let server;
let tenantId;
let storeId1;
let storeId2;
let ownerToken;
let employeeToken;

describe('Store Management and Role Access', async () => {
  before(async () => {
    server = app.listen(0);
    
    const uniqueId = Date.now();
    const ownerEmail = `owner-store-${uniqueId}@test.com`;
    const employeeEmail = `employee-store-${uniqueId}@test.com`;
    const ownerMobile = `987${uniqueId}`.substring(0, 10);
    const empMobile = `988${uniqueId}`.substring(0, 10);

    // 1. Create a tenant and stores
    const tenant = await prisma.tenant.create({
      data: {
        business_name: `Test Tenant Stores ${uniqueId}`,
        owner_name: 'Store Owner',
        owner_email: ownerEmail,
        owner_mobile: ownerMobile,
        subscription_status: 'ACTIVE',
        subscription_plan: 'YEARLY'
      }
    });
    tenantId = tenant.tenant_id;

    const store1 = await prisma.store.create({
      data: { tenant_id: tenantId, store_name: 'Branch 1', phone: '111' }
    });
    storeId1 = store1.store_id;

    const store2 = await prisma.store.create({
      data: { tenant_id: tenantId, store_name: 'Branch 2', phone: '222' }
    });
    storeId2 = store2.store_id;

    // 2. Create an Owner and an Employee
    const hash = await bcrypt.hash('password123', 10);
    
    await prisma.user.create({
      data: {
        tenant_id: tenantId,
        store_id: storeId1,
        name: 'The Owner',
        email: ownerEmail,
        mobile: ownerMobile,
        password_hash: hash,
        role: 'OWNER'
      }
    });

    await prisma.user.create({
      data: {
        tenant_id: tenantId,
        store_id: storeId1,
        name: 'The Employee',
        email: employeeEmail,
        mobile: empMobile,
        password_hash: hash,
        role: 'EMPLOYEE'
      }
    });

    // 3. Login to get tokens
    const resOwner = await request(server).post('/api/v1/auth/login').send({
      email: ownerEmail, password: 'password123'
    });
    ownerToken = resOwner.body.token;

    const resEmp = await request(server).post('/api/v1/auth/login').send({
      email: employeeEmail, password: 'password123'
    });
    employeeToken = resEmp.body.token;
  });

  after(async () => {
    if (tenantId) {
      await prisma.user.deleteMany({ where: { tenant_id: tenantId } });
      await prisma.store.deleteMany({ where: { tenant_id: tenantId } });
      await prisma.tenant.delete({ where: { tenant_id: tenantId } });
    }
    
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  it('Owner should be able to fetch all stores', async () => {
    const res = await request(server)
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.length >= 2);
  });

  it('Employee should be able to fetch stores', async () => {
    const res = await request(server)
      .get('/api/v1/stores')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    assert.strictEqual(res.statusCode, 200);
  });

  it('Owner should be able to create a new store', async () => {
    const res = await request(server)
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        store_name: 'Branch 3',
        phone: '333'
      });
    
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.store_name, 'Branch 3');
  });

  it('Employee should NOT be able to create a new store (Forbidden)', async () => {
    const res = await request(server)
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        store_name: 'Branch 4',
        phone: '444'
      });
    
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.error, /Owner privileges required/);
  });
});
