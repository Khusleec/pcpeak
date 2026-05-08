const { z } = require('zod');

const registerSchema = z.object({
  in_game_name: z.string().trim().max(120, 'Тоглоом доторх нэр хэт урт').nullish(),
});

module.exports = { registerSchema };
