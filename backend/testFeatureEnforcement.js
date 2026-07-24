require('dotenv').config();
const { prisma } = require('./src/prisma');
const jwt = require('jsonwebtoken');

async function testFeature() {
  console.log('--- Phase 3: Feature Flag API Enforcement Test ---');
  
  // 1. Setup a test tenant with memberships disabled
  let tenant = await prisma.tenant.findFirst({ where: { business_name: 'Test Tenant No Features' } });
  
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenant_id: 'test-no-features-123',
        business_name: 'Test Tenant No Features',
        owner_name: 'Test Owner',
        owner_email: 'testowner@example.com',
        owner_mobile: '9999999999',
        subscription_status: 'ACTIVE',
        subscription_plan: 'BASIC',
        membership_system_enabled: false,
        advanced_reports_enabled: false
      }
    });
  } else {
    await prisma.tenant.update({
      where: { tenant_id: tenant.tenant_id },
      data: { membership_system_enabled: false, advanced_reports_enabled: false }
    });
  }

  // Create owner user
  let user = await prisma.user.findFirst({ where: { email: 'testowner@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: 'user-test-no-features',
        email: 'testowner@example.com',
        name: 'Test Owner',
        password_hash: 'hashed',
        role: 'OWNER',
        tenant_id: tenant.tenant_id
      }
    });
  }

  // 2. Generate a JWT for this user
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Try to hit a membership endpoint
  console.log('\n[1] Testing Membership API (should be 403 Forbidden)');
  let res = await fetch('http://localhost:5000/api/v1/memberships/assign', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ customer_id: 'test', plan_id: 'test' })
  });

  console.log(`Status: ${res.status}`);
  let data = await res.json();
  console.log(`Response: ${JSON.stringify(data)}`);
  
  if (res.status === 403) {
    console.log('✅ PASS: Membership API correctly rejected request.');
  } else {
    console.log('❌ FAIL: Expected 403, got ' + res.status);
  }

  // 4. Try to hit a reports endpoint
  console.log('\n[2] Testing Reports API (should be 403 Forbidden)');
  res = await fetch('http://localhost:5000/api/v1/reports/dashboard', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log(`Status: ${res.status}`);
  data = await res.json();
  console.log(`Response: ${JSON.stringify(data)}`);

  if (res.status === 403) {
    console.log('✅ PASS: Reports API correctly rejected request.');
  } else {
    console.log('❌ FAIL: Expected 403, got ' + res.status);
  }

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.tenant.delete({ where: { tenant_id: tenant.tenant_id } });
  
  console.log('\nTest cleanup complete.');
}

testFeature().catch(console.error).finally(() => process.exit(0));
