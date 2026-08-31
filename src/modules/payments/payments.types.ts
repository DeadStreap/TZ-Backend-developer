export interface PaymentWebhookEvent {
  event_id: string;
  order_id: string;
  status: 'paid' | 'failed';
  amount: number;
  currency: string;
  created_at: string;
}

export type WebhookResult =
  | { status: 'ok'; orderId: string }
  | { status: 'duplicate'; eventId: string }
  | { status: 'order_not_found'; orderId: string };
