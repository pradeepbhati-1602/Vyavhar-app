const { dbGet, dbRun } = require('../db');

/**
 * Finds a customer by mobile number, or creates a new one if not found.
 * 
 * @param {string} name - Customer name
 * @param {string} mobile - Customer mobile number
 * @returns {Promise<string>} - The customer_id
 */
async function findOrCreateCustomer(name, mobile) {
  if (!mobile) throw new Error('Mobile number is required for customer detection');

  const existing = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
  if (existing) {
    return existing.customer_id;
  }

  // Create new customer
  const customer_id = 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  await dbRun(`
    INSERT INTO customers (customer_id, name, mobile)
    VALUES (?, ?, ?)
  `, [customer_id, name || 'Unknown', mobile]);

  return customer_id;
}

module.exports = {
  findOrCreateCustomer
};
