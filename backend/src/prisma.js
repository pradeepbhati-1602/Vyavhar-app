const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error']
});

// Array of models that require tenant isolation
const tenantModels = [
  'User', 'Customer', 'ReferralMember', 'MembershipPlan', 
  'CustomerMembership', 'Product', 'InventoryHistory', 
  'Bill', 'EyeTest', 'RepairOrder', 'Setting', 'MessageTemplate', 'AuditLog', 'Store'
];

// Helper to get a tenant-scoped database client
const getTenantDb = (tenant_id) => {
  if (!tenant_id) {
    throw new Error("tenant_id is required for scoped database access.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Only apply scoping to models that have a tenant_id
          if (tenantModels.includes(model)) {
            // Read/Update/Delete operations
            if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany', 'aggregate', 'groupBy'].includes(operation)) {
              args.where = { ...args.where, tenant_id };
            } 
            // Create operations
            else if (['create', 'createMany'].includes(operation)) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map(item => ({ ...item, tenant_id }));
              } else {
                args.data = { ...args.data, tenant_id };
              }
            } 
            // Upsert operation
            else if (operation === 'upsert') {
              args.where = { ...args.where, tenant_id };
              args.create = { ...args.create, tenant_id };
            }
          }
          return query(args);
        },
      },
    },
  });
};

module.exports = {
  prisma,
  getTenantDb
};
