const mysql = require('mysql2/promise');
async function testRoot() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
    });
    console.log('SUCCESS: Connected as root with no password!');
    await conn.end();
  } catch (err) {
    console.error('FAILED: root with no password:', err.message);
    try {
      const conn2 = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'password',
      });
      console.log('SUCCESS: Connected as root with password "password"!');
      await conn2.end();
    } catch (err2) {
      console.error('FAILED: root with password "password":', err2.message);
    }
  }
}
testRoot();
