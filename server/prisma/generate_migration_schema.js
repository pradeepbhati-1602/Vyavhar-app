const fs = require('fs');

let schema = fs.readFileSync('schema.prisma', 'utf8');

// Make tenant_id optional ONLY if it's not the @id column (like in Tenant model)
schema = schema.replace(/tenant_id\s+String(\s+(?!@id)[^\n]*)/g, 'tenant_id String?$1');

// Make updated_at optional
schema = schema.replace(/updated_at\s+DateTime\s+@updatedAt/g, 'updated_at DateTime? @updatedAt');

// Fix uuid() to generate at database level so existing rows get a UUID automatically
schema = schema.replace(/@default\(uuid\(\)\)/g, '@default(dbgenerated("gen_random_uuid()"))');

// Make other required columns optional
const columnsToMakeOptional = [
  'duration_days\\s+Int',
  'name\\s+String',
  'product_name\\s+String',
  'password_hash\\s+String',
];

columnsToMakeOptional.forEach(col => {
  const regex = new RegExp(`(\\s+)${col}(?=\\s|$)`, 'g');
  schema = schema.replace(regex, (match, p1) => {
    return match.replace('Int', 'Int?').replace('String', 'String?');
  });
});

// For category Enum on Product
schema = schema.replace(/category\s+ProductCategory/, 'category ProductCategory?');

fs.writeFileSync('schema_migration.prisma', schema);
console.log('Migration schema generated.');
