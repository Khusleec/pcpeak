const { z } = require('zod');

const createBookingSchema = z.object({
  cafe_id: z.number().int().positive('Салбарын ID буруу байна'),
  pc_ids: z
    .array(z.number().int().positive())
    .min(1, 'Хамгийн багадаа 1 компьютер сонгоно уу')
    .max(10, 'Нэг удаад дээд тал нь 10 компьютер захиалах боломжтой'),
  starts_at: z.string().datetime({ message: 'Эхлэх цаг буруу байна' }),
  ends_at: z.string().datetime({ message: 'Дуусах цаг буруу байна' }),
}).refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
  message: 'Дуусах цаг эхлэх цагаас хойш байх ёстой',
  path: ['ends_at'],
});

const cancelBookingSchema = z.object({
  booking_id: z.string().uuid('Захиалгын ID буруу байна'),
});

module.exports = { createBookingSchema, cancelBookingSchema };
