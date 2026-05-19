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

const forgotPasswordSchema = z.object({
  email: z.string().email('Имэйл хаяг буруу байна'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Токен шаардлагатай'),
  password: z.string().min(8, 'Нууц үг доод тал нь 8 тэмдэгт байх ёстой').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Одоогийн нууц үгээ оруулна уу'),
  newPassword: z.string().min(8, 'Шинэ нууц үг доод тал нь 8 тэмдэгт байх ёстой').max(128),
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema };
