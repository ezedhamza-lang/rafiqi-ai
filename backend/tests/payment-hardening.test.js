import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';
import { processWebhookEvent } from '../src/services/paymentService.js';
import { consumeDiscountCode, validateDiscountCode } from '../src/services/discountService.js';

let prisma;
let userId;
let subscriptionId;
let adminId;

async function mkPendingIntent(ref) {
  return prisma.paymentIntent.create({
    data: {
      subscriptionId,
      userId,
      provider: 'DEMO',
      status: 'PENDING',
      amount: 147,
      currency: 'TND',
      providerReference: ref,
      metadata: { kind: 'INITIAL' }
    }
  });
}

describe('تقوية المدفوعات (R2a)', () => {
  beforeAll(async () => {
    await import('../src/index.js');
    prisma = (await import('../src/db.js')).default;
    await resetDatabase();
    const { users, sub } = await seedTestData();
    userId = users.student.id;
    subscriptionId = sub.id;
    adminId = users.admin.id;
  });

  it('يطبّع CANCELLED (بلا L مضاعفة) إلى مسار الإلغاء بلا خطأ', async () => {
    const intent = await mkPendingIntent('PP-CANCELLED-1');
    const out = await processWebhookEvent({ provider: 'DEMO', type: 'CANCELLED', providerReference: 'PP-CANCELLED-1' });
    expect(out.status).toBe('CANCELED');
    const reloaded = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
    expect(reloaded.status).toBe('CANCELED');
  });

  it('يرفض نوع حدث غير معروف بـ400', async () => {
    await mkPendingIntent('PP-BOGUS-1');
    await expect(
      processWebhookEvent({ provider: 'DEMO', type: 'SOMETHING_WEIRD', providerReference: 'PP-BOGUS-1' })
    ).rejects.toThrow(/غير معروف/);
  });

  it('استهلاك كود خصم غير موجود لا يرمي (best-effort)', async () => {
    await expect(consumeDiscountCode('DOES-NOT-EXIST')).resolves.toBeUndefined();
  });

  it('استهلاك كود قائم يزيد usedCount ويحترم الحدود عند التحقق', async () => {
    const code = `SAVE10-${Date.now()}`;
    await prisma.discountCode.create({
      data: { code, type: 'PERCENTAGE', value: 10, active: true, usageLimit: 1, createdBy: adminId }
    });
    const v = await validateDiscountCode(code, 100);
    expect(v.discountAmount).toBe(10);
    await consumeDiscountCode(code);
    const after = await prisma.discountCode.findUnique({ where: { code } });
    expect(after.usedCount).toBe(1);
    await expect(validateDiscountCode(code, 100)).rejects.toThrow(/أقصى عدد استعمال/);
  });
});
