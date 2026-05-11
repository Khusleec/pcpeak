// Runs before loading the app — keep NODE_ENV=test so production fail-fast rules do not run.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  'test-jwt-secret-must-be-thirty-two-chars-plus';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// CI provides DATABASE_URL pointing at ephemeral MySQL; local dev can unset to skip integration tests only if needed.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'mysql://root:root@127.0.0.1:3306/pcpeak_ci';
