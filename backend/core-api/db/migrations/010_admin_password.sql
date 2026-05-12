-- Applied by: npm run db:migrate
-- Sets the bcrypt password hash for the admin account (admin@pcpeak.mn).

UPDATE users
SET    password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm'
WHERE  email = 'admin@pcpeak.mn'
  AND  id    = '550e8400-e29b-41d4-a716-446655440000';
