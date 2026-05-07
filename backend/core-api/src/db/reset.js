const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const uri = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim();
  const c = await mysql.createConnection({ uri });
  await c.query('SET FOREIGN_KEY_CHECKS = 0');
  const [tables] = await c.query('SHOW TABLES');
  for (const row of tables) {
    const t = Object.values(row)[0];
    await c.query(`DROP TABLE IF EXISTS \`${t}\``);
    console.log(`  ✗ dropped ${t}`);
  }
  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  await c.end();
  console.log(`✓ Reset complete (${tables.length} tables dropped)`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
