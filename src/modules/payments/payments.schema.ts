import { z } from 'zod';

export const PaymentWebhookSchema = z.object({
  event_id: z.string().min(1, 'event_id is required'),
  order_id: z.string().min(1, 'order_id is required'),
  status: z.enum(['paid', 'failed']),
  amount: z.number().positive(),
  currency: z.string().default('RUB'),
  created_at: z.string(),
});
