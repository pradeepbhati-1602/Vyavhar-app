require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const enums = [
    `CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'YEARLY');`,
    `CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TRIAL', 'SUSPENDED');`,
    `CREATE TYPE "Role" AS ENUM ('OWNER', 'EMPLOYEE');`,
    `CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');`,
    `CREATE TYPE "Language" AS ENUM ('HINDI', 'ENGLISH');`,
    `CREATE TYPE "ProductCategory" AS ENUM ('FRAMES', 'CONTACT_LENS', 'READING_GLASSES', 'SUNGLASSES', 'ACCESSORIES', 'LENS', 'REPAIR_PARTS');`,
    `CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DISCONTINUED');`,
    `CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'DUE');`,
    `CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED');`,
    `CREATE TYPE "BillStatus" AS ENUM ('ACTIVE', 'CANCELLED');`,
    `CREATE TYPE "BillType" AS ENUM ('REGULAR', 'SUNGLASSES');`,
    `CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'READY', 'DELIVERED');`,
    `CREATE TYPE "ReferralMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');`,
    `CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');`
  ];

  for (let query of enums) {
    try {
        await client.query(query);
    } catch(e) {}
  }
  
  await client.end();
  console.log('Enums created');
}
main().catch(console.error);
