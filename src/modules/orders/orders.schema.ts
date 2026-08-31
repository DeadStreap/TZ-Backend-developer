import { z } from 'zod';

export const CreateOrderSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
});

export const OrderParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});
