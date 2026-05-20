const pool = require('./pool');

// ============================================================
// CAFE NETWORK :: 8 facilities across Ulaanbaatar
// Each cafe has a custom mix of Zaal (public) and VIP nodes
// ============================================================
const CAFES = [
  {
    name: 'Pro Gaming',
    address: 'Баянгол дүүрэг, Улаанбаатар',
    latitude: 47.9100,
    longitude: 106.8700,
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
    name: 'P Gaming',
    address: '100 айл, Сүхбаатар дүүрэг, Улаанбаатар',
    latitude: 47.9300,
    longitude: 106.9200,
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

    const tc = await pool.query('SELECT id FROM cafes ORDER BY id ASC LIMIT 1');
    const venueId = tc.rows[0]?.id;
    if (venueId) {
      const tExist = await pool.query('SELECT id FROM tournaments LIMIT 1');
      if (tExist.rows.length === 0) {
        const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
        const s1 = new Date(Date.now() + 10 * 86400000);
        const e1 = new Date(s1.getTime() + 5 * 3600000);
        const reg1 = new Date(s1.getTime() - 2 * 3600000);
        const s2 = new Date(Date.now() + 24 * 86400000);
        const e2 = new Date(s2.getTime() + 8 * 3600000);
        const reg2 = new Date(s2.getTime() - 3600000);
        const s3 = new Date(Date.now() + 45 * 86400000);
        const e3 = new Date(s3.getTime() + 10 * 3600000);
        const reg3 = new Date(s3.getTime() - 24 * 3600000);
        await pool.query(
          `INSERT INTO tournaments (
            title, description, game_title, cafe_id, starts_at, ends_at, registration_deadline,
            max_participants, prize_pool_mnt, status, visibility, setup_mode, bracket_type
          )
           VALUES
           (?, ?, ?, ?, ?, ?, ?, ?, ?, 'registration', 'public', 'manual', 'elimination'),
           (?, ?, ?, ?, ?, ?, ?, ?, ?, 'registration', 'public', 'automatic', 'elimination'),
           (?, ?, ?, ?, ?, ?, ?, ?, ?, 'registration', 'public', 'manual', 'double_elimination')`,
          [
            'MGL OPEN — Valorant (Season 1)',
            'Сүлжээний нээлтийн цуврал. 5v5 эсвэл түвшин тогтоосон формат.',
            'Valorant',
            venueId,
            fmt(s1),
            fmt(e1),
            fmt(reg1),
            32,
            5000000,
            'CS2 5v5 — Хан-Уул',
            'Хан-Уул салбарт LAN. Шууд элиминаци.',
            'Counter-Strike 2',
            venueId,
            fmt(s2),
            fmt(e2),
            fmt(reg2),
            16,
            3000000,
            'League of Legends — Дээд лиг (үзүүлэн)',
            'Тоглолтын хуваарь урьдчилсан. Үзэгчийн суудал тусдаа.',
            'League of Legends',
            venueId,
            fmt(s3),
            fmt(e3),
            fmt(reg3),
            8,
            2000000,
          ]
        );
        console.log('  ◆ Sample tournaments :: 3 rows inserted');
      } else {
        console.log('  ◆ Tournaments :: already present — skip sample insert');
      }
    }

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
