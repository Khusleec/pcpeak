const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Имэйл хаяг буруу байна').max(255),
  password: z.string().min(8, 'Нууц үг доод тал нь 8 тэмдэгт байх ёстой').max(128),
  display_name: z.string().min(2).max(255).trim(),
});

const loginSchema = z.object({
  email: z.string().email('Имэйл хаяг буруу байна'),
  password: z.string().min(1, 'Нууц үгээ оруулна уу'),
});

const firebaseIdTokenSchema = z.object({
  idToken: z.string().min(100, 'Firebase токен дутуу байна').max(12000),
});

module.exports = { registerSchema, loginSchema, firebaseIdTokenSchema };
