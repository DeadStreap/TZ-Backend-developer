import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validatePromo, applyPromo } from './promocodes.service.js';

const ValidatePromoSchema = z.object({
  code: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('RUB'),
});

const ApplyPromoSchema = z.object({
  code: z.string().min(1),
});

export async function promocodesRoutes(app: FastifyInstance) {
  app.post('/promocodes/validate', async (request, reply) => {
    const parsed = ValidatePromoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues[0].message);
    }

    const result = await validatePromo(parsed.data);
    return result;
  });

  app.post('/promocodes/apply', async (request, reply) => {
    const parsed = ApplyPromoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues[0].message);
    }

    const applied = await applyPromo(parsed.data.code);
    return { applied };
  });
}
