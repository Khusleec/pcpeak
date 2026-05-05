const pool = require('./pool');

// ============================================================
// CAFE NETWORK :: 8 facilities across Ulaanbaatar
// Each cafe has a custom mix of Zaal (public) and VIP nodes
// ============================================================
const CAFES = [
  {
    name: 'Mongol PC — Төв',
    address: 'Энх Тайвны өргөн чөлөө 15, Сүхбаатар дүүрэг, Улаанбаатар',
    latitude: 47.9184676,
    longitude: 106.9177016,
    phone: '+976-7000-1234',
    image_url: '/images/cafe-central.jpg',
    zaal: 12,
    vip: 6,
  },
  {
    name: 'Mongol PC — Хан-Уул',
    address: 'Зайсангийн зам 42, Хан-Уул дүүрэг, Улаанбаатар',
    latitude: 47.8864,
    longitude: 106.9057,
    phone: '+976-7000-5678',
    image_url: '/images/cafe-khanuul.jpg',
    zaal: 10,
    vip: 4,
  },
  {
    name: 'Mongol PC — Баянгол',
    address: 'Чингисийн өргөн чөлөө 88, Баянгол дүүрэг, Улаанбаатар',
    latitude: 47.9100,
    longitude: 106.8700,
    phone: '+976-7000-9012',
    image_url: '/images/cafe-bayangol.jpg',
    zaal: 10,
    vip: 5,
  },
  {
    name: 'Mongol PC — Сүхбаатарын талбай',
    address: 'Бага тойруу 23, Сүхбаатарын талбай, Улаанбаатар',
    latitude: 47.9189,
    longitude: 106.9176,
    phone: '+976-7000-2200',
    image_url: '/images/cafe-square.jpg',
    zaal: 14,
    vip: 8,
  },
  {
    name: 'Mongol PC — Баянзүрх',
    address: 'Тэди төв 3-р давхар, Энх Тайвны өргөн чөлөө 47, Баянзүрх дүүрэг',
    latitude: 47.9170,
    longitude: 106.9408,
    phone: '+976-7000-3300',
    image_url: '/images/cafe-bayanzurkh.jpg',
    zaal: 16,
    vip: 4,
  },
  {
    name: 'Mongol PC — Шангри-Ла',
    address: 'Олимпын гудамж 19A, Шангри-Ла төв, Сүхбаатар дүүрэг',
    latitude: 47.9143,
    longitude: 106.9214,
    phone: '+976-7000-4400',
    image_url: '/images/cafe-shangrila.jpg',
    zaal: 8,
    vip: 10,
  },
  {
    name: 'Mongol PC — Сонгинохайрхан',
    address: 'Толгойтын зам 12, Сонгинохайрхан дүүрэг, Улаанбаатар',
    latitude: 47.9266,
    longitude: 106.7833,
    phone: '+976-7000-5500',
    image_url: '/images/cafe-shk.jpg',
    zaal: 12,
    vip: 3,
  },
  {
    name: 'Mongol PC — Сансар',
    address: 'Сансар 4-р хороолол 25, Баянзүрх дүүрэг, Улаанбаатар',
    latitude: 47.9235,
    longitude: 106.9595,
    phone: '+976-7000-6600',
    image_url: '/images/cafe-sansar.jpg',
    zaal: 10,
    vip: 6,
  },
];

async function seed() {
  try {
    console.log('▶ Seeding cafe network...\n');

    for (const c of CAFES) {
      // Upsert cafe by unique name
      const existing = await pool.query(
        'SELECT id FROM cafes WHERE name = ?',
        [c.name]
      );

      let cafeId;
      if (existing.rows.length > 0) {
        cafeId = existing.rows[0].id;
        await pool.query(
          `UPDATE cafes SET address = ?, latitude = ?, longitude = ?, phone = ?, image_url = ?
           WHERE id = ?`,
          [c.address, c.latitude, c.longitude, c.phone, c.image_url, cafeId]
        );
        console.log(`  ◆ ${c.name} :: EXISTS (id=${cafeId}) — coords refreshed`);
      } else {
        const result = await pool.query(
          `INSERT INTO cafes (name, address, latitude, longitude, phone, image_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [c.name, c.address, c.latitude, c.longitude, c.phone, c.image_url]
        );
        cafeId = result.insertId;
        console.log(`  ◆ ${c.name} :: CREATED (id=${cafeId})`);
      }

      // Zaal nodes (tier_id = 1)
      let zaalCreated = 0;
      for (let i = 1; i <= c.zaal; i++) {
        const label = `Z-${String(i).padStart(2, '0')}`;
        const r = await pool.query(
          `INSERT IGNORE INTO pcs (label, tier_id, cafe_id) VALUES (?, 1, ?)`,
          [label, cafeId]
        );
        if (r.rowCount > 0) zaalCreated++;
      }

      // VIP nodes (tier_id = 2)
      let vipCreated = 0;
      for (let i = 1; i <= c.vip; i++) {
        const label = `V-${String(i).padStart(2, '0')}`;
        const r = await pool.query(
          `INSERT IGNORE INTO pcs (label, tier_id, cafe_id) VALUES (?, 2, ?)`,
          [label, cafeId]
        );
        if (r.rowCount > 0) vipCreated++;
      }

      console.log(`     └─ Zaal: ${c.zaal} configured (${zaalCreated} new) // VIP: ${c.vip} configured (${vipCreated} new)`);
    }

    // Summary
    const summary = await pool.query(`
      SELECT c.name,
             SUM(CASE WHEN p.tier_id = 1 THEN 1 ELSE 0 END) AS zaal_count,
             SUM(CASE WHEN p.tier_id = 2 THEN 1 ELSE 0 END) AS vip_count
      FROM cafes c
      LEFT JOIN pcs p ON p.cafe_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `);

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                NETWORK TOPOLOGY SUMMARY                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    let totalZaal = 0, totalVip = 0;
    for (const row of summary.rows) {
      const z = parseInt(row.zaal_count) || 0;
      const v = parseInt(row.vip_count) || 0;
      totalZaal += z;
      totalVip += v;
      console.log(`  ${row.name.padEnd(38)} :: Z×${z}  V×${v}`);
    }
    console.log('  ' + '─'.repeat(56));
    console.log(`  TOTAL FACILITIES: ${summary.rows.length}`);
    console.log(`  TOTAL ZAAL NODES: ${totalZaal}`);
    console.log(`  TOTAL VIP NODES:  ${totalVip}`);
    console.log(`  TOTAL NETWORK:    ${totalZaal + totalVip} nodes\n`);
    console.log('✓ Database seeded successfully.');
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
