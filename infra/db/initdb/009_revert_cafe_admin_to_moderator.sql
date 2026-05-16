-- Fresh installs: no row. Existing DBs with cafe_admin: revert to moderator
UPDATE roles
SET name = 'moderator', description = 'Manage cafes and bookings'
WHERE name = 'cafe_admin';
