const mysql = require('mysql2/promise');
require('dotenv').config();
async function testRoot() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: process.env.MYSQL_ROOT_PASSWORD,
    });
    console.log('SUCCESS: Connected as root with password from .env!');
    await conn.end();
  } catch (err) {
    console.error('FAILED: root with password from .env:', err.message);
  }
}
testRoot();
