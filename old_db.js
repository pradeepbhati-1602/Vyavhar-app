require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const pg = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { AsyncLocalStorage } = require('async_hooks');

const usePostgres = !!process.env.DATABASE_URL;
let db;
let pool;
const transactionStorage = new AsyncLocalStorage();

if (usePostgres) {
  console.log('🔌 Connecting to Supabase/PostgreSQL...');
  // Configure pg to parse numeric/bigint as float/int
  pg.types.setTypeParser(1700, val => parseFloat(val));
  pg.types.setTypeParser(20, val => parseInt(val, 10));
  
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log('📁 Connecting to local SQLite...');
  const dbPath = path.join(__dirname, 'database.sqlite');
  db = new sqlite3.Database(dbPath);
}

// SQL Query translator from SQLite to PostgreSQL
const translateQuery = (sql) => {
  if (!usePostgres) return sql;

  let translated = '';
  let inString = false;
  let paramIndex = 1;

  // Safely replace ? with $1, $2 etc., ignoring those inside string literals
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      // Handle escaped single quotes inside strings
      if (inString && i + 1 < sql.length && sql[i + 1] === "'") {
        translated += "''";
        i++;
      } else {
        inString = !inString;
        translated += char;
      }
    } else if (char === '?' && !inString) {
      translated += `$${paramIndex++}`;
    } else {
      translated += char;
    }
  }

  // SQLite date functions to PostgreSQL equivalents
  translated = translated.replace(/date\('now'(,\s*'localtime'\)?)/gi, 'CURRENT_DATE');
  translated = translated.replace(/date\('now',\s*'\+30 days'\)/gi, "(CURRENT_DATE + INTERVAL '30 days')");
  translated = translated.replace(/date\('now',\s*'\+(\d+) days'\)/gi, "(CURRENT_DATE + INTERVAL '$1 days')");
  translated = translated.replace(/date\('now',\s*'-7 days',\s*'localtime'\)/gi, "(CURRENT_DATE - INTERVAL '7 days')");
  translated = translated.replace(/date\('now',\s*'-(\d+) days'(,\s*'localtime'\)?)/gi, "(CURRENT_DATE - INTERVAL '$1 days')");
  
  translated = translated.replace(/datetime\('now',\s*'-45 days',\s*'localtime'\)/gi, "(CURRENT_TIMESTAMP - INTERVAL '45 days')");
  translated = translated.replace(/datetime\('now',\s*'-(\d+) days'(,\s*'localtime'\)?)/gi, "(CURRENT_TIMESTAMP - INTERVAL '$1 days')");
  
  translated = translated.replace(/datetime\('now',\s*'-'\s*\|\|\s*(\$\d+)\s*\|\|\s*' days'\)/gi, "(CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL)");
  translated = translated.replace(/date\(([^,]+),\s*'localtime'\)/gi, '$1::date');

  // Translate strftime functions for PostgreSQL
  translated = translated.replace(/strftime\(\s*'%m-%d'\s*,\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi, "to_char(CURRENT_DATE, 'MM-DD')");
  translated = translated.replace(/strftime\(\s*'%Y-%m'\s*,\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi, "to_char(CURRENT_DATE, 'YYYY-MM')");
  translated = translated.replace(/strftime\(\s*'%Y-%m'\s*,\s*([^,]+?)(?:,\s*'localtime'\s*)?\)/gi, "to_char($1, 'YYYY-MM')");
  translated = translated.replace(/strftime\(\s*'%m-%d'\s*,\s*([^,]+?)(?:,\s*'localtime'\s*)?\)/gi, "to_char($1, 'MM-DD')");

  translated = translated.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

  // Fix Bug 2: MAX(0, pending_due - ?) in SQLite should be GREATEST(0, ...) in Postgres
  translated = translated.replace(/\bMAX\s*\(\s*0\s*,/gi, 'GREATEST(0,');

  // Handle SQLite specific "INSERT OR IGNORE" -> "INSERT ... ON CONFLICT DO NOTHING"
  translated = translated.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  if (sql.match(/INSERT OR IGNORE INTO settings/i)) {
    translated = translated + ' ON CONFLICT (key) DO NOTHING';
  }

  return translated;
};

// Utility promise wrappers
const dbRun = (sql, params = []) => {
  if (usePostgres) {
    const client = transactionStorage.getStore() || pool;
    const pgSql = translateQuery(sql);
    return client.query(pgSql, params);
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = async (sql, params = []) => {
  if (usePostgres) {
    const client = transactionStorage.getStore() || pool;
    const pgSql = translateQuery(sql);
    const res = await client.query(pgSql, params);
    return res.rows[0];
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = async (sql, params = []) => {
  if (usePostgres) {
    const client = transactionStorage.getStore() || pool;
    const pgSql = translateQuery(sql);
    const res = await client.query(pgSql, params);
    return res.rows;
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Transaction wrapper helper
const runTransaction = async (queriesCallback) => {
  if (usePostgres) {
    const client = await pool.connect();
    return transactionStorage.run(client, async () => {
      try {
        await client.query('BEGIN');
        const result = await queriesCallback();
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    });
  }
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        db.run('BEGIN TRANSACTION');
        const result = await queriesCallback();
        db.run('COMMIT');
        resolve(result);
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
};

// Migration helper — safe column addition
const addColumnIfNotExists = async (table, column, definition) => {
  try {
    let exists = false;
    if (usePostgres) {
      const result = await dbGet(`
        SELECT COLUMN_NAME 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      exists = !!result;
    } else {
      const columns = await dbAll(`PRAGMA table_info(${table})`);
      exists = columns.some(c => c.name === column);
    }
    if (!exists) {
      await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`  Migration: Added ${table}.${column}`);
    }
  } catch (e) {
    console.warn(`  Migration warning on ${table}.${column}:`, e.message);
  }
};

const initDb = async () => {
  console.log('Initializing database...');

  if (!usePostgres) {
    // Enable WAL mode for better concurrent performance
    await dbRun('PRAGMA journal_mode=WAL');
    await dbRun('PRAGMA foreign_keys=ON');
  }

  if (!usePostgres) {
    // Migration: Relax products barcode unique constraint (from barcode UNIQUE to UNIQUE(barcode, store_id))
    try {
    const prodSchema = await dbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
    if (prodSchema && prodSchema.sql.includes('barcode TEXT UNIQUE')) {
      console.log('Migrating products table constraint...');
      await dbRun('ALTER TABLE products RENAME TO products_old');
      
      await dbRun(`
        CREATE TABLE products (
          product_id TEXT PRIMARY KEY,
          barcode TEXT NOT NULL,
          category TEXT CHECK(category IN ('Frames', 'Contact Lens', 'Reading Glasses', 'Sunglasses', 'Accessories', 'Lens', 'Repair Parts')) NOT NULL,
          brand TEXT NOT NULL,
          frame_name TEXT NOT NULL,
          frame_color TEXT,
          size TEXT,
          purchase_price DECIMAL(10, 2) NOT NULL,
          selling_price DECIMAL(10, 2) NOT NULL,
          opening_stock INTEGER NOT NULL,
          current_stock INTEGER NOT NULL,
          low_stock_limit INTEGER DEFAULT 5,
          supplier TEXT,
          last_purchase_date DATE,
          last_updated_date DATETIME,
          status TEXT CHECK(status IN ('Active', 'Discontinued')) DEFAULT 'Active',
          store_id TEXT,
          warranty_months INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(barcode, store_id)
        )
      `);

      await dbRun(`
        INSERT INTO products (
          product_id, barcode, category, brand, frame_name, frame_color, size,
          purchase_price, selling_price, opening_stock, current_stock, low_stock_limit,
          supplier, last_purchase_date, last_updated_date, status, store_id, warranty_months, created_at
        )
        SELECT 
          product_id, barcode, category, brand, frame_name, frame_color, size,
          purchase_price, selling_price, opening_stock, current_stock, low_stock_limit,
          supplier, last_purchase_date, last_updated_date, status, store_id, 0, created_at
        FROM products_old
      `);

      await dbRun('DROP TABLE products_old');
      console.log('Products table constraint migration completed.');
    }
  } catch (err) {
    console.error('Error migrating products table constraint:', err.message);
  }
  }

  // ── CORE TABLES ──────────────────────────────────────────────────────────

  // v2 Upgrade: STORES TABLE
  await dbRun(`
    CREATE TABLE IF NOT EXISTS stores (
      store_id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      address TEXT,
      gst_number TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active'
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('Owner', 'Employee')) NOT NULL,
      name TEXT NOT NULL,
      store_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      birthday DATE,
      gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
      address TEXT,
      language TEXT CHECK(language IN ('Hindi', 'English')) DEFAULT 'English',
      last_visit DATETIME,
      total_bills INTEGER DEFAULT 0,
      total_purchase DECIMAL(10, 2) DEFAULT 0.00,
      referral_code_used TEXT,
      current_cashback DECIMAL(10, 2) DEFAULT 0.00,
      pending_due DECIMAL(10, 2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // v2 Upgrade: AUDIT LOGS TABLE
  await dbRun(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      store_id TEXT
    )
  `);

  // v2 Upgrade: MEMBERSHIP PLANS TABLE
  await dbRun(`
    CREATE TABLE IF NOT EXISTS membership_plans (
      plan_id TEXT PRIMARY KEY,
      plan_name TEXT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      duration_months INTEGER NOT NULL,
      discount_percent DECIMAL(5, 2) NOT NULL,
      perks TEXT,
      status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active'
    )
  `);

  // v2 Upgrade: CUSTOMER MEMBERSHIPS TABLE
  await dbRun(`
    CREATE TABLE IF NOT EXISTS customer_memberships (
      membership_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      expiry_date DATETIME NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('Paid', 'Due')) DEFAULT 'Paid',
      amount_paid DECIMAL(10, 2) DEFAULT 0.00,
      store_id TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
      FOREIGN KEY (plan_id) REFERENCES membership_plans(plan_id) ON DELETE RESTRICT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS referral_members (
      referral_id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referral_count INTEGER DEFAULT 0,
      cashback_earned DECIMAL(10, 2) DEFAULT 0.00,
      cashback_used DECIMAL(10, 2) DEFAULT 0.00,
      status TEXT CHECK(status IN ('Active', 'Inactive')) DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      category TEXT CHECK(category IN ('Frames', 'Contact Lens', 'Reading Glasses', 'Sunglasses', 'Accessories', 'Lens', 'Repair Parts')) NOT NULL,
      brand TEXT NOT NULL,
      frame_name TEXT NOT NULL,
      frame_color TEXT,
      size TEXT,
      purchase_price DECIMAL(10, 2) NOT NULL,
      selling_price DECIMAL(10, 2) NOT NULL,
      opening_stock INTEGER NOT NULL,
      current_stock INTEGER NOT NULL,
      low_stock_limit INTEGER DEFAULT 5,
      supplier TEXT,
      last_purchase_date DATE,
      last_updated_date DATETIME,
      status TEXT CHECK(status IN ('Active', 'Discontinued')) DEFAULT 'Active',
      store_id TEXT,
      warranty_months INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(barcode, store_id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bills (
      bill_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      referral_code TEXT,
      frame_product_id TEXT,
      lens_details TEXT,
      power_details TEXT,
      subtotal DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(10, 2) DEFAULT 0.00,
      cashback_used DECIMAL(10, 2) DEFAULT 0.00,
      advance_paid DECIMAL(10, 2) DEFAULT 0.00,
      due_amount DECIMAL(10, 2) NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('Paid', 'Partial', 'Due')) NOT NULL,
      delivery_status TEXT CHECK(delivery_status IN ('Pending', 'Delivered')) DEFAULT 'Pending',
      delivery_date DATETIME,
      bill_type TEXT CHECK(bill_type IN ('Regular', 'Sunglasses')) DEFAULT 'Regular',
      bill_status TEXT CHECK(bill_status IN ('Active', 'Cancelled')) DEFAULT 'Active',
      store_id TEXT,
      warranty_expiry_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
      FOREIGN KEY (frame_product_id) REFERENCES products(product_id) ON DELETE RESTRICT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS eye_tests (
      eyetest_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      age INTEGER,
      vision_category TEXT,
      re_sph DECIMAL(4,2), re_cyl DECIMAL(4,2), re_axis INTEGER,
      le_sph DECIMAL(4,2), le_cyl DECIMAL(4,2), le_axis INTEGER,
      pd DECIMAL(4,2), add_power DECIMAL(4,2),
      doctor_notes TEXT,
      prescription_pdf_url TEXT,
      converted_to_bill_id TEXT,
      store_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS repair_orders (
      repair_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      frame_details TEXT NOT NULL,
      repair_type TEXT NOT NULL,
      charges DECIMAL(10, 2) NOT NULL,
      expected_date DATE NOT NULL,
      repair_status TEXT CHECK(repair_status IN ('Received', 'In Progress', 'Ready', 'Delivered')) DEFAULT 'Received',
      delivery_status TEXT CHECK(delivery_status IN ('Pending', 'Delivered')) DEFAULT 'Pending',
      store_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_history (
      history_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      added_quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      updated_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      bill_id TEXT,
      store_id TEXT,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      transfer_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      from_store_id TEXT NOT NULL,
      to_store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT CHECK(status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
      requested_by TEXT NOT NULL,
      action_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
      FOREIGN KEY (from_store_id) REFERENCES stores(store_id) ON DELETE RESTRICT,
      FOREIGN KEY (to_store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
    )
  `);

  // Indexes
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(last_visit)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_referral_code ON referral_members(referral_code)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_invhist_product ON inventory_history(product_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_status_store ON bills(bill_status, store_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_delivery_status ON bills(delivery_status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_eyetests_customer ON eye_tests(customer_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_repairorders_customer ON repair_orders(customer_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_products_status_store ON products(status, store_id)`);

  // v2 Migration: add store_id and warranty columns to existing tables
  await addColumnIfNotExists('users', 'store_id', 'TEXT');
  await addColumnIfNotExists('bills', 'store_id', 'TEXT');
  await addColumnIfNotExists('products', 'store_id', 'TEXT');
  await addColumnIfNotExists('inventory_history', 'store_id', 'TEXT');
  await addColumnIfNotExists('repair_orders', 'store_id', 'TEXT');
  await addColumnIfNotExists('eye_tests', 'store_id', 'TEXT');
  await addColumnIfNotExists('products', 'warranty_months', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('bills', 'warranty_expiry_date', 'DATE');
  await addColumnIfNotExists('users', 'cross_store_read', 'INTEGER DEFAULT 0');

  // v2 Migration: add pending_due to existing customers table if missing
  await addColumnIfNotExists('customers', 'pending_due', 'DECIMAL(10, 2) DEFAULT 0.00');

  // v2 Migration: add new product columns if missing
  await addColumnIfNotExists('products', 'last_purchase_date', 'DATE');
  await addColumnIfNotExists('products', 'last_updated_date', 'DATETIME');

  // v2 Migration: add new bill columns if missing
  await addColumnIfNotExists('bills', 'delivery_status', "TEXT DEFAULT 'Pending'");
  await addColumnIfNotExists('bills', 'delivery_date', 'DATETIME');
  await addColumnIfNotExists('bills', 'bill_type', "TEXT DEFAULT 'Regular'");

  // v3 Migration: add status to customer_memberships
  await addColumnIfNotExists('customer_memberships', 'status', "TEXT DEFAULT 'Active'");

  // Backfill default store if no store exists
  const storeCount = await dbGet('SELECT COUNT(*) as count FROM stores');
  if (storeCount.count === 0) {
    console.log('Seeding default store...');
    const mainStoreId = 'store-main';
    await dbRun(`
      INSERT INTO stores (store_id, store_name, address, gst_number, phone)
      VALUES (?, ?, ?, ?, ?)
    `, [mainStoreId, 'Main Store', '101 Golden Frame Blvd, Sector 7, New Delhi', '27EYEVEN1001A1Z0', '9876543210']);

    // Backfill existing records with default store_id
    console.log('Backfilling store_id for existing records...');
    await dbRun(`UPDATE users SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
    await dbRun(`UPDATE bills SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
    await dbRun(`UPDATE products SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
    await dbRun(`UPDATE inventory_history SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
    await dbRun(`UPDATE repair_orders SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
    await dbRun(`UPDATE eye_tests SET store_id = ? WHERE store_id IS NULL`, [mainStoreId]);
  }


  // ── SEED DATA ─────────────────────────────────────────────────────────────

  const settingsCount = await dbGet('SELECT COUNT(*) as count FROM settings');
  if (settingsCount.count === 0) {
    console.log('Seeding settings...');
    const defaultSettings = [
      ['store_name', 'Eyevengers Optical'],
      ['gst_number', '27EYEVEN1001A1Z0'],
      ['store_address', '101 Golden Frame Blvd, Sector 7, New Delhi'],
      ['store_mobile', '9876543210'],
      ['upi_id', 'eyevengers@upi'],
      ['referral_cashback_percent', '5'],
      ['inactive_customer_days', '45'],
      ['low_stock_limit', '5'],
      ['whatsapp_auto_send', 'false'],
      ['invoice_prefix', 'INV-'],
      ['whatsapp_delivery_template_en', 'Dear *{customer_name}*, we are pleased to inform you that your spectacles for invoice *{bill_id}* have been handed over. Thank you for choosing Eyevengers Optical!'],
      ['whatsapp_delivery_template_hi', 'प्रिय *{customer_name}*, हमें आपको सूचित करते हुए खुशी हो रही है कि आपके बिल *{bill_id}* का चश्मा डिलीवर कर दिया गया है। Eyevengers Optical को चुनने के लिए धन्यवाद!'],
      ['feedback_link', 'https://g.page/r/eyevengers-optical/review']
    ];
    for (const [key, value] of defaultSettings) {
      await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  } else {
    // Ensure new settings keys exist even on upgraded databases
    const newKeys = [
      ['upi_id', 'eyevengers@upi'],
      ['invoice_prefix', 'INV-'],
      ['whatsapp_delivery_template_en', 'Dear *{customer_name}*, we are pleased to inform you that your spectacles for invoice *{bill_id}* have been handed over. Thank you for choosing Eyevengers Optical!'],
      ['whatsapp_delivery_template_hi', 'प्रिय *{customer_name}*, हमें आपको सूचित करते हुए खुशी हो रही है कि आपके बिल *{bill_id}* का चश्मा डिलीवर कर दिया गया है। Eyevengers Optical को चुनने के लिए धन्यवाद!'],
      ['feedback_link', 'https://g.page/r/eyevengers-optical/review']
    ];
    for (const [key, value] of newKeys) {
      await dbRun('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('Seeding user roles...');
    const hashedOwner = await bcrypt.hash('owner123', 10);
    const hashedEmployee = await bcrypt.hash('emp123', 10);

    await dbRun('INSERT INTO users (user_id, username, password, role, name, store_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['usr-owner', 'owner', hashedOwner, 'Owner', 'Dr. Stark (Owner)', 'store-main']);
    await dbRun('INSERT INTO users (user_id, username, password, role, name, store_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['usr-emp', 'employee', hashedEmployee, 'Employee', 'Peter Parker (Staff)', 'store-main']);
  }

  const productCount = await dbGet('SELECT COUNT(*) as count FROM products');
  if (productCount.count === 0) {
    console.log('Seeding inventory products...');
    const sampleProducts = [
      ['p-1', '8053672000123', 'Frames', 'Ray-Ban', 'Aviator Classic', 'Gold/Green', 'Medium', 4000.00, 6500.00, 10, 10, 3, 'Rayban Distributors', 'Active', 'store-main'],
      ['p-2', '700200100456', 'Frames', 'Oakley', 'Holbrook', 'Matte Black', 'Large', 3500.00, 5800.00, 8, 8, 2, 'Oakley India', 'Active', 'store-main'],
      ['p-3', '8901234567890', 'Sunglasses', 'Fastrack', 'Sporty Wrap', 'Neon Blue', 'Medium', 800.00, 1500.00, 15, 15, 4, 'Fastrack Agency', 'Active', 'store-main'],
      ['p-4', 'ESL-CRIZ-01', 'Lens', 'Essilor', 'Crizal Prevencia', 'Clear Blue-Cut', 'Standard', 1500.00, 2500.00, 30, 30, 5, 'Essilor Lab', 'Active', 'store-main'],
      ['p-5', 'BL-SOF-200', 'Contact Lens', 'Bausch + Lomb', 'SofLens Daily', 'Clear Disposable', '-2.00 SPH', 600.00, 1200.00, 4, 4, 5, 'Bausch Lomb India', 'Active', 'store-main']
    ];

    for (const prod of sampleProducts) {
      await dbRun(`
        INSERT INTO products 
        (product_id, barcode, category, brand, frame_name, frame_color, size, purchase_price, selling_price, opening_stock, current_stock, low_stock_limit, supplier, status, store_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, prod);
    }
  }

  const refCount = await dbGet('SELECT COUNT(*) as count FROM referral_members');
  if (refCount.count === 0) {
    console.log('Seeding initial referral members...');
    await dbRun(`
      INSERT INTO referral_members (referral_id, customer_name, mobile, referral_code, referral_count, cashback_earned, cashback_used, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['ref-1001', 'Tony Stark', '9999999999', 'EYE1001', 3, 450.00, 100.00, 'Active']);

    await dbRun(`
      INSERT INTO customers (customer_id, name, mobile, current_cashback, pending_due, total_bills, total_purchase, last_visit)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, ['cust-1001', 'Tony Stark', '9999999999', 350.00, 0.00, 3, 9000.00]);
  }

  // Feature 14 Paid Membership plans seed
  const plansCount = await dbGet('SELECT COUNT(*) as count FROM membership_plans');
  if (plansCount.count === 0) {
    console.log('Seeding initial paid membership plans...');
    const defaultPlans = [
      ['plan-gold', 'Gold Club Member (10% Off)', 500.00, 12, 10.00, '10% discount on spectacles', 'Active'],
      ['plan-plat', 'Platinum Vision Member (15% Off)', 1000.00, 12, 15.00, '15% discount on spectacles', 'Active'],
      ['plan-fam', 'Family Care Elite (20% Off)', 1500.00, 24, 20.00, '20% discount on spectacles', 'Active']
    ];
    for (const plan of defaultPlans) {
      await dbRun(`
        INSERT INTO membership_plans (plan_id, plan_name, price, duration_months, discount_percent, perks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, plan);
    }
  }

  console.log('Database initialization done.');
};

const logAuditEvent = async (user_id, username, action, details) => {
  try {
    const log_id = 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    await dbRun(`
      INSERT INTO audit_logs (log_id, user_id, action_type, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [log_id, username || 'System', action, 'General', 'N/A', typeof details === 'object' ? JSON.stringify(details) : details]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  runTransaction,
  initDb,
  logAuditEvent
};
