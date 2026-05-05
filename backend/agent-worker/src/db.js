const mysql = require('mysql2/promise');
require('dotenv').config();

const rawPool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  decimalNumbers: true,
  multipleStatements: false,
});

function normaliseResult(result) {
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  return {
    rows: [],
    rowCount: result.affectedRows ?? 0,
    insertId: result.insertId,
  };
}

async function query(sql, params = []) {
  const [result] = await rawPool.query(sql, params);
  return normaliseResult(result);
}

async function connect() {
  const connection = await rawPool.getConnection();
  let inTx = false;
  return {
    query: async (sql, params = []) => {
      const upper = String(sql).trim().toUpperCase();
      if (upper === 'BEGIN' || upper === 'START TRANSACTION') {
        await connection.beginTransaction();
        inTx = true;
        return { rows: [], rowCount: 0 };
      }
      if (upper === 'COMMIT') {
        if (inTx) await connection.commit();
        inTx = false;
        return { rows: [], rowCount: 0 };
      }
      if (upper === 'ROLLBACK') {
        if (inTx) await connection.rollback();
        inTx = false;
        return { rows: [], rowCount: 0 };
      }
      const [result] = await connection.query(sql, params);
      return normaliseResult(result);
    },
    release: async () => {
      if (inTx) {
        try { await connection.rollback(); } catch { /* swallow */ }
        inTx = false;
      }
      connection.release();
    },
  };
}

rawPool.on('error', (err) => {
  console.error('agent-worker MySQL pool error:', err);
});

module.exports = { query, connect, end: () => rawPool.end(), raw: rawPool };
