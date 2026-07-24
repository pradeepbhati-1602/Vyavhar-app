require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  const email = 'admin@vyavhar.com';
  const password = 'admin123';
  
  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  
  if (existing) {
    console.log('Super Admin already exists.');
    return;
  }
  
  const password_hash = await bcrypt.hash(password, 10);
  
  await prisma.superAdmin.create({
    data: {
      email,
      password_hash
    }
  });
  
  console.log('Super Admin seeded successfully!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
