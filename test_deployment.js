const pool = require('./backend/core-api/src/db/pool');
require('dotenv').config();

async function test() {
  console.log('Testing connection to:', process.env.DATABASE_URL);
  try {
    const res = await pool.query('SHOW TABLES LIKE "agent_tasks"');
    console.log('Tables found:', res.rowCount);
    if (res.rowCount > 0) {
      const tasks = await pool.query('SELECT status, count(*) as count FROM agent_tasks GROUP BY status');
      console.log('Task stats:', tasks.rows);
      
      const lastTasks = await pool.query('SELECT id, status, error, created_at FROM agent_tasks ORDER BY created_at DESC LIMIT 5');
      console.log('Last 5 tasks:', JSON.stringify(lastTasks.rows, null, 2));
    } else {
      console.log('agent_tasks table does not exist!');
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await pool.end();
  }
}
test();
