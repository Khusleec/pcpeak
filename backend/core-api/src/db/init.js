const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  // Use a dedicated multi-statement connection (not the wrapped pool)
  const uri = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim();
  const connection = await mysql.createConnection({
    uri,
    multipleStatements: true,
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('▶ Initializing schema...');

    // Strip line-comments first, THEN split on statement terminators.
    // (Filtering whole statements that start with `--` was dropping
    //  every CREATE that had a comment header above it.)
    const stripped = schema
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = stripped
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let executed = 0;
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
        executed++;
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          executed++;
          continue;
        }
        console.error('Failed statement:', stmt.slice(0, 120) + '...');
        throw err;
      }
    }

    console.log(`✓ Database schema initialized (${executed} statements).`);
  } catch (err) {
    console.error('✗ Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initDatabase();
