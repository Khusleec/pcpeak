const { z } = require('zod');

const createCafeSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  address: z.string().min(1).max(5000).trim(),
  latitude: z.coerce.number().gte(-90).lte(90),
  longitude: z.coerce.number().gte(-180).lte(180),
  phone: z.union([z.string().max(50), z.null()]).optional(),
  image_url: z.union([z.string().max(2000), z.literal(''), z.null()]).optional(),
});

module.exports = { createCafeSchema };
