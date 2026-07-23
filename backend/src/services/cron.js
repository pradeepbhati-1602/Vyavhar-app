const cron = require('node-cron');
const { prisma } = require('../prisma');

function startCronJobs() {
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running daily subscription expiry check...');
    try {
      const now = new Date();

      // 1. Expire subscriptions that are past their date
      const expiredTenants = await prisma.tenant.updateMany({
        where: {
          subscription_expiry_date: {
            lt: now
          },
          subscription_status: {
            not: 'EXPIRED'
          }
        },
        data: {
          subscription_status: 'EXPIRED'
        }
      });
      
      if (expiredTenants.count > 0) {
        console.log(`⏰ Updated ${expiredTenants.count} tenants to EXPIRED status.`);
      }

      // 2. Reminders for tenants expiring in exactly 3 days
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(threeDaysFromNow.setHours(0,0,0,0));
      const endOfDay = new Date(threeDaysFromNow.setHours(23,59,59,999));

      const expiringTenants = await prisma.tenant.findMany({
        where: {
          subscription_expiry_date: {
            gte: startOfDay,
            lte: endOfDay
          },
          subscription_status: 'ACTIVE'
        }
      });

      for (const tenant of expiringTenants) {
        // Here we would hook into our WA or email service.
        // For now, we log it.
        console.log(`⏰ [REMINDER] Tenant ${tenant.business_name} (${tenant.owner_email}) expires in 3 days on ${tenant.subscription_expiry_date}.`);
        // TODO: integrate WhatsApp sending logic here in Phase 6
      }
      
    } catch (error) {
      console.error('⏰ Error running subscription cron:', error);
    }
  });

  console.log('✅ Cron jobs initialized');
}

module.exports = { startCronJobs };
