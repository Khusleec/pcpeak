-- Normalize role 2 back to moderator (reverses cafe_admin if present)
UPDATE roles
SET name = 'moderator', description = 'Manage cafes and bookings'
WHERE name = 'cafe_admin';
