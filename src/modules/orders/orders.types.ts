export const ORDER_STATUSES = {
  CREATED: 'created',
  PAID: 'paid',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  PAYMENT_FAILED: 'payment_failed',
  OUT_OF_STOCK: 'out_of_stock',
  DELIVERY_FAILED: 'delivery_failed',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['paid', 'payment_failed'],
  paid: ['delivering'],
  delivering: ['delivered', 'out_of_stock', 'delivery_failed'],
  delivered: [],
  payment_failed: [],
  out_of_stock: ['delivering', 'delivered'],
  delivery_failed: ['delivering', 'delivered'],
};

export interface CreateOrderInput {
  sku: string;
}

export interface OrderResponse {
  orderId: string;
  sku: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  key?: string;
  createdAt: string;
}
