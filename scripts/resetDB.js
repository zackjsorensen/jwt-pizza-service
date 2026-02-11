const mysql = require('mysql2/promise');
const config = require('../config');

if (process.argv.length < 3) {
  console.error('Usage: node resetDB.js <database_name>');
  process.exit(1);
}
const dbName = process.argv[2];

async function resetDatabase() {
  const connection = await mysql.createConnection({
    
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    await connection.query(`CREATE DATABASE \`${dbName}\`;`);
    console.log('Database reset successfully');
  } finally {
    await connection.end();
  }
}

resetDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});
