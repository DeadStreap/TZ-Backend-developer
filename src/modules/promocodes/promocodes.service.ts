import { getPrisma } from '../../config/prisma.js';
import { childLogger } from '../../lib/logger.js';

const prisma = getPrisma();
const log = childLogger({ module: 'promocodes' });

export interface ValidatePromoInput {
  code: string;
  amount: number;
  currency: string;
}

export interface PromoResult {
  valid: boolean;
  code?: string;
  type?: string;
  value?: number;
  discount?: number;
  finalAmount?: number;
  error?: string;
}

export async function validatePromo(input: ValidatePromoInput): Promise<PromoResult> {
  const promo = await prisma.promoCode.findUnique({ where: { code: input.code.toUpperCase() } });

  if (!promo) {
    return { valid: false, error: 'Промокод не найден' };
  }

  if (!promo.active) {
    return { valid: false, error: 'Промокод деактивирован' };
  }

  if (promo.usedCount >= promo.maxUses) {
    return { valid: false, error: 'Промокод исчерпан' };
  }

  let discount = 0;
  if (promo.type === 'percent') {
    discount = Math.round(input.amount * promo.value / 100);
  } else {
    discount = Math.min(promo.value, input.amount);
  }

  const finalAmount = Math.max(0, input.amount - discount);

  return {
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discount,
    finalAmount,
  };
}

export async function applyPromo(code: string): Promise<boolean> {
  try {
    const result = await prisma.promoCode.updateMany({
      where: { code: code.toUpperCase(), active: true, usedCount: { lt: prisma.promoCode.fields.maxUses } },
      data: { usedCount: { increment: 1 } },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

export async function getPromoUsage(code: string) {
  const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo) return null;
  return { code: promo.code, usedCount: promo.usedCount, maxUses: promo.maxUses };
}
