const mysql = require('mysql2/promise');
const config = require('../src/config');

if (process.argv.length < 3) {
  console.error('Usage: node populateForTests.js <database_name>');
  process.exit(1);
}

const dbName = process.argv[2];

async function populateDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password,
    database: dbName
  });

  try {
    console.log('Populating test database...');

    // -----------------------------
    // Clear Existing Data
    // -----------------------------
    // await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // await connection.query('DELETE FROM orderItem');
    // await connection.query('DELETE FROM dinerOrder');
    // await connection.query('DELETE FROM userRole');
    // await connection.query('DELETE FROM store');
    // await connection.query('DELETE FROM franchise');
    // await connection.query('DELETE FROM menu');
    // await connection.query('DELETE FROM auth');
    // await connection.query('DELETE FROM user');

    // await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // =================================================
    // USERS FIRST
    // =================================================

    const admin = { name: 'admin', email: 'a@jwt.com', password: 'admin' };

    const [adminResult] = await connection.query(
      `INSERT INTO user (name, email, password)
       VALUES (?, ?, ?)`,
      [admin.name, admin.email, admin.password]
    );
    const adminId = adminResult.insertId;


    const franchiseOwner = { name: 'Franchise Owner', email: 'owner@test.com', password: 'password' };

    const [ownerResult] = await connection.query(
      `INSERT INTO user (name, email, password)
       VALUES (?, ?, ?)`,
      [franchiseOwner.name, franchiseOwner.email, franchiseOwner.password]
    );
    const ownerId = ownerResult.insertId;

    // =================================================
    // FRANCHISES
    // =================================================

    const [franchise1] = await connection.query(
      `INSERT INTO franchise (name)
       VALUES (?)`,
      ['Pizza Planet']
    );
    const franchise1Id = franchise1.insertId;

    const [franchise2] = await connection.query(
      `INSERT INTO franchise (name)
       VALUES (?)`,
      ['Burger Galaxy']
    );
    const franchise2Id = franchise2.insertId;

    // =================================================
    // STORES
    // =================================================

    await connection.query(
      `INSERT INTO store (franchiseId, name)
       VALUES (?, ?)`,
      [franchise1Id, 'Pizza Planet Downtown']
    );

    await connection.query(
      `INSERT INTO store (franchiseId, name)
       VALUES (?, ?)`,
      [franchise2Id, 'Burger Galaxy Mall']
    );

    // =================================================
    // ROLES
    // =================================================

    // Admin role (global)
    await connection.query(
      `INSERT INTO userRole (userId, role, objectId)
       VALUES (?, ?, ?)`,
      [adminId, 'admin', 0]
    );

    // Owner role for franchise1
    await connection.query(
      `INSERT INTO userRole (userId, role, objectId)
       VALUES (?, ?, ?)`,
      [ownerId, 'franchise', franchise1Id]
    );

    // =================================================
    // MENU ITEMS
    // =================================================

    await connection.query(
      `INSERT INTO menu (title, image, price, description)
       VALUES (?, ?, ?, ?)`,
      [
        'Cheese Pizza',
        '/images/cheese.png',
        9.99,
        'Classic cheese pizza'
      ]
    );

    await connection.query(
      `INSERT INTO menu (title, image, price, description)
       VALUES (?, ?, ?, ?)`,
      [
        'Galaxy Burger',
        '/images/burger.png',
        11.49,
        'Signature burger'
      ]
    );

    console.log('✅ Test data populated successfully');
  } catch (err) {
    console.error('Error populating test database:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

populateDatabase();
