const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const dbUri = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim();
  if (!dbUri) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const pool = mysql.createPool({
    uri: dbUri,
  });

  try {
    const [rows] = await pool.query('SELECT id, status, error, created_at FROM agent_tasks ORDER BY created_at DESC LIMIT 5');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end();
  }
}

check();
