const { z } = require('zod');

const registerSchema = z.object({
  in_game_name: z.string().trim().max(120, 'Тоглоом доторх нэр хэт урт').nullish(),
});

const createTournamentSchema = z
  .object({
    title: z.string().trim().min(1, 'Гарчиг шаардлагатай').max(255),
    image_url: z.string().url('Зурагны линк буруу байна').nullish().or(z.literal('')),
    description: z.string().trim().max(8000).nullish(),
    game_title: z.string().trim().min(1, 'Тоглоомын нэр шаардлагатай').max(200),
    cafe_id: z.number().int().positive().nullish(),
    starts_at: z.string().datetime({ message: 'Эхлэх цаг буруу байна' }),
    ends_at: z.string().datetime({ message: 'Дуусах цаг буруу байна' }),
    registration_deadline: z.string().datetime({ message: 'Бүртгэлийн хугацаа буруу байна' }).nullish(),
    max_participants: z.number().int().min(2).max(512).default(32),
    prize_pool_mnt: z.number().nonnegative().max(1e12).default(0),
    visibility: z.enum(['public', 'private']).default('public'),
    setup_mode: z.enum(['manual', 'automatic']).default('manual'),
    bracket_type: z.enum(['elimination', 'double_elimination']).default('elimination'),
  })
  .refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
    message: 'Дуусах цаг эхлэхээс хойш байх ёстой',
    path: ['ends_at'],
  });

const updateTournamentSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    image_url: z.string().url('Зурагны линк буруу байна').nullish().or(z.literal('')).optional(),
    description: z.string().trim().max(8000).nullish(),
    game_title: z.string().trim().min(1).max(200).optional(),
    cafe_id: z.number().int().positive().nullish(),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().optional(),
    registration_deadline: z.string().datetime().nullish(),
    max_participants: z.number().int().min(2).max(512).optional(),
    prize_pool_mnt: z.number().nonnegative().max(1e12).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    setup_mode: z.enum(['manual', 'automatic']).optional(),
    bracket_type: z.enum(['elimination', 'double_elimination']).optional(),
    status: z.enum(['registration', 'closed', 'live', 'finished', 'cancelled']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Шинэчлэх талбар байхгүй' });

module.exports = { registerSchema, createTournamentSchema, updateTournamentSchema };
