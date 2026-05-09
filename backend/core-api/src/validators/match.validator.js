const { z } = require('zod');

const matchUpdateSchema = z.object({
  score1: z.number().int().min(0).optional(),
  score2: z.number().int().min(0).optional(),
  winner_id: z.string().uuid().nullish(),
  status: z.enum(['pending', 'live', 'finished']).optional(),
});

const createMatchesSchema = z.array(z.object({
  player1_id: z.string().uuid().nullish(),
  player2_id: z.string().uuid().nullish(),
  round: z.number().int().positive(),
  match_order: z.number().int().positive(),
}));

module.exports = { matchUpdateSchema, createMatchesSchema };
