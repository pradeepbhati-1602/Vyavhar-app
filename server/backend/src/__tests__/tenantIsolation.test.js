require('dotenv').config();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { prisma, getTenantDb } = require('../prisma');
const { requireTenantAuth } = require('../middleware/tenantIsolation');

const app = express();
app.use(express.json());

// Dummy route that fetches customers using the isolated db instance
app.get('/api/v1/customers', requireTenantAuth, async (req, res) => {
  try {
    const db = getTenantDb(req.tenant_id);
    const customers = await db.customer.findMany();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

describe('Tenant Isolation Tests', () => {
  let tenantA;
  let tenantB;
  let customerA;
  let tokenB;

  before(async () => {
    // Set a fallback JWT_SECRET if not provided
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'test-secret';
    }

    // 1. Create Tenant A and Tenant B
    tenantA = await prisma.tenant.create({
      data: {
        business_name: 'Tenant A Optical',
        owner_name: 'Owner A',
        owner_email: `ownerA_${Date.now()}@test.com`,
        owner_mobile: `A${Date.now()}`.slice(0, 15),
      }
    });

    tenantB = await prisma.tenant.create({
      data: {
        business_name: 'Tenant B Optical',
        owner_name: 'Owner B',
        owner_email: `ownerB_${Date.now()}@test.com`,
        owner_mobile: `B${Date.now()}`.slice(0, 15),
      }
    });

    // 2. Create dummy data (Customer) under Tenant A
    customerA = await prisma.customer.create({
      data: {
        tenant_id: tenantA.tenant_id,
        name: 'Customer of A',
        mobile: `C${Date.now()}`.slice(0, 15),
      }
    });

    // 3. Generate a valid JWT login token for Tenant B
    tokenB = jwt.sign(
      { tenant_id: tenantB.tenant_id, role: 'OWNER' },
      process.env.JWT_SECRET
    );
  });

  after(async () => {
    // Cleanup
    if (tenantA && tenantB) {
      await prisma.customer.deleteMany({
        where: { tenant_id: { in: [tenantA.tenant_id, tenantB.tenant_id] } }
      });
      await prisma.tenant.deleteMany({
        where: { tenant_id: { in: [tenantA.tenant_id, tenantB.tenant_id] } }
      });
    }
    await prisma.$disconnect();
  });

  it('should not allow Tenant B to fetch Tenant A data (Cross-tenant leak prevention)', async () => {
    // 4. Attempt to fetch the data using Tenant B's token via the API
    const response = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenB}`);

    // 5. Assert that the API correctly returns an empty list [] for Tenant B
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.length, 0); 
  });
  
  it('should fetch Tenant A data successfully when using Tenant A token', async () => {
    const tokenA = jwt.sign(
      { tenant_id: tenantA.tenant_id, role: 'OWNER' },
      process.env.JWT_SECRET
    );
    const response = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.length, 1);
    assert.strictEqual(response.body[0].name, 'Customer of A');
  });
});
