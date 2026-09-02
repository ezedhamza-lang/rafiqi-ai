import prisma from '../db.js';
import { ApiError } from '../middleware/errorHandler.js';

export function normalizeDiscountCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function computeDiscount(base, discount) {
  const baseValue = Number(base);
  if (!discount) return { discountAmount: 0, finalAmount: baseValue };
  const raw =
    discount.type === 'PERCENTAGE'
      ? (baseValue * Number(discount.value)) / 100
      : Math.min(Number(discount.value), baseValue);
  const discountAmount = Math.min(Math.round(raw * 100) / 100, baseValue);
  return { discountAmount, finalAmount: Math.round((baseValue - discountAmount) * 100) / 100 };
}

export async function validateDiscountCode(code, amount) {
  const normalized = normalizeDiscountCode(code);
  if (!normalized) return null;

  const dc = await prisma.discountCode.findUnique({ where: { code: normalized } });
  if (!dc || !dc.active) throw new ApiError(400, 'كود التخفيض غير صالح');
  if (dc.expiresAt && dc.expiresAt < new Date()) throw new ApiError(400, 'انتهت صلاحية كود التخفيض');
  if (dc.usageLimit != null && dc.usedCount >= dc.usageLimit) {
    throw new ApiError(400, 'بلغ كود التخفيض أقصى عدد استعمال');
  }

  const { discountAmount, finalAmount } = computeDiscount(amount, dc);
  return {
    discountId: dc.id,
    code: dc.code,
    type: dc.type,
    value: Number(dc.value),
    discountAmount,
    finalAmount
  };
}

export async function consumeDiscountCode(code) {
  const normalized = normalizeDiscountCode(code);
  if (!normalized) return;
  await prisma.discountCode.update({
    where: { code: normalized },
    data: { usedCount: { increment: 1 } }
  });
}
