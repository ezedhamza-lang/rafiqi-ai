import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import { computeScore, applySkillUpdate, MASTERY_THRESHOLD } from '../src/services/knowledgeGardenService.js';

let app;
let token;
let userId;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  token = (await login('student@test.tn', 'student123')).body.token;
  userId = (await prisma.user.findUnique({ where: { email: 'student@test.tn' } })).id;
});

const base = '/api/games/knowledge-garden';
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

/** Report a finished run. The body carries counters only — never a score. */
function reportRun(levelId, worldId, over = {}) {
  return auth(request(app).post(`${base}/level-result`)).send({
    levelId,
    worldId,
    correct: 4,
    wrong: 1,
    total: 5,
    timeSec: 60,
    bestStreak: 4,
    hintsUsed: 0,
    skills: [{ skillId: 'letter:م', skillType: 'LETTER', label: 'حرف م', correct: 4, wrong: 1 }],
    ...over
  });
}

/** Clear a whole world so the next one unlocks. */
async function clearWorld(worldIndex) {
  const worldIds = ['letters-garden', 'word-forest', 'sentence-village', 'knowledge-castle', 'challenge-valley', 'knowledge-city', 'champions-island'];
  const worldId = worldIds[worldIndex - 1];
  for (let l = 1; l <= 4; l++) await reportRun(`w${worldIndex}-l${l}`, worldId);
  return worldId;
}

/** Force a level back to "never cleared" so reward assertions are deterministic. */
async function resetLevel(levelId) {
  await prisma.gardenLevelResult.deleteMany({ where: { userId, levelId } });
}

describe('حديقة المعرفة — المصادقة وسلامة البيانات', () => {
  it('يرفض كل المسارات بدون رمز صالح', async () => {
    expect((await request(app).get(`${base}/state`)).status).toBe(401);
    expect((await request(app).post(`${base}/level-result`).send({})).status).toBe(401);
  });

  it('يتجاهل النقاط والنجوم المزروعة في حمولة العميل', async () => {
    // Reset so this run is a genuine first clear and the reward maths is visible.
    await prisma.gardenLevelResult.deleteMany({ where: { userId, levelId: 'w1-l1' } });
    const res = await auth(request(app).post(`${base}/level-result`)).send({
      levelId: 'w1-l1', worldId: 'letters-garden', correct: 4, total: 5,
      score: 999999, stars: 3, gems: 999999, xp: 999999
    });
    expect(res.status).toBe(200);
    // The injected fields are ignored entirely — nothing is echoed back.
    expect(res.body.result.score).toBeLessThan(999999);
    expect(res.body.rewards.gems).toBeLessThan(100);
  });

  it('يرفض مرحلة غير موجودة أو غير مرتبطة بعالمها', async () => {
    expect((await reportRun('w9-l9', 'letters-garden')).status).toBe(404);
    expect((await reportRun('w1-l1', 'word-forest')).status).toBe(400);
  });

  it('يمنع تخطّي المراحل المقفلة', async () => {
    expect((await reportRun('w2-l1', 'word-forest')).status).toBe(403);
  });
});

describe('حديقة المعرفة — التحصيل والتقدّم', () => {
  it('يقبل المرحلة الأولى ويحسب النجوم على الخادم', async () => {
    await resetLevel('w1-l1');
    const res = await reportRun('w1-l1', 'letters-garden');
    expect(res.status).toBe(200);
    expect(res.body.result.stars).toBeGreaterThanOrEqual(1);
    expect(res.body.result.stars).toBeLessThanOrEqual(3);
    expect(res.body.result.accuracyPercent).toBe(80);
    expect(res.body.rewards.stars).toBeGreaterThan(0);
    expect(res.body.rewards.gems).toBeGreaterThan(0);
    expect(res.body.nextLevelId).toBe('w1-l2');
  });

  it('يفتح المرحلة التالية بعد إتمام السابقة', async () => {
    expect((await reportRun('w1-l2', 'letters-garden')).status).toBe(200);
    const state = await auth(request(app).get(`${base}/state`));
    expect(state.body.levels.find((l) => l.id === 'w1-l3').unlocked).toBe(true);
  });

  it('لا يضاعف المكافآت عند إعادة اللعب بنفس النتيجة', async () => {
    const before = await auth(request(app).get(`${base}/state`));
    const again = await reportRun('w1-l1', 'letters-garden');
    expect(again.body.rewards.stars).toBe(0);
    expect(again.body.rewards.gems).toBe(0);
    const after = await auth(request(app).get(`${base}/state`));
    expect(after.body.profile.stars).toBe(before.body.profile.stars);
  });

  it('يرفع النجوم عند التحسّن ولا يخفضها بعد تحقيقها', async () => {
    expect((await reportRun('w1-l3', 'letters-garden', { correct: 1, total: 5, bestStreak: 1 })).body.result.stars).toBe(1);
    const strong = await reportRun('w1-l3', 'letters-garden', { correct: 5, total: 5, bestStreak: 5, hintsUsed: 0 });
    expect(strong.body.result.stars).toBe(3);
    const weak = await reportRun('w1-l3', 'letters-garden', { correct: 1, total: 5, bestStreak: 1 });
    expect(weak.body.result.stars).toBe(3); // best run is kept
  });

  it('يمنح المفتاح عند إنهاء مرحلة زعيم فقط', async () => {
    const worldId = await clearWorld(1);
    expect(worldId).toBe('letters-garden');
    await resetLevel('w1-l5');
    const boss1 = await reportRun('w1-l5', 'letters-garden', { correct: 9, total: 10, bestStreak: 9 });
    expect(boss1.body.rewards.keys).toBe(1);
    const boss2 = await reportRun('w1-l5', 'letters-garden', { correct: 9, total: 10, bestStreak: 9 });
    expect(boss2.body.rewards.keys).toBe(0); // replay earns no extra key
  });
});

describe('حديقة المعرفة — نظام الإتقان والتكيّف', () => {
  it('يسجّل المهارة ويصنّفها (متقن / يحتاج تدريب / يحتاج مراجعة)', async () => {
    await prisma.gardenSkill.deleteMany({ where: { userId, skillId: 'word:قلم' } });
    await auth(request(app).post(`${base}/level-result`)).send({
      levelId: 'w1-l1', worldId: 'letters-garden', correct: 6, total: 6,
      timeSec: 40, bestStreak: 6, hintsUsed: 0,
      skills: [{ skillId: 'word:قلم', skillType: 'WORD', label: 'قلم', correct: 12, wrong: 0 }]
    });
    const state = await auth(request(app).get(`${base}/state`));
    const s = state.body.skills.find((x) => x.skillId === 'word:قلم');
    expect(s.mastery).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
    expect(s.status).toBe('MASTERED');
    expect(s.statusAr).toContain('متقن');
  });

  it('يضع المهارة الضعيفة في قائمة التدريب الإضافي تلقائياً', async () => {
    await prisma.gardenSkill.deleteMany({ where: { userId, skillId: 'letter:س' } });
    await auth(request(app).post(`${base}/level-result`)).send({
      levelId: 'w1-l1', worldId: 'letters-garden', correct: 5, total: 5,
      timeSec: 40, bestStreak: 5, hintsUsed: 0,
      skills: [{ skillId: 'letter:س', skillType: 'LETTER', label: 'حرف س', correct: 0, wrong: 3 }]
    });
    const state = await auth(request(app).get(`${base}/state`));
    expect(state.body.practiceQueue).toContain('letter:س');
    const s = state.body.skills.find((x) => x.skillId === 'letter:س');
    expect(s.status).toBe('NEEDS_REVIEW');
    expect(s.statusAr).toContain('مراجعة');
  });

  it('أخطاء المتعلم لا تُنقص أي مكافأة (تعلّم بلا عقاب)', async () => {
    const res = await reportRun('w2-l1', 'word-forest', { correct: 3, wrong: 6, total: 6, bestStreak: 2, hintsUsed: 2 });
    expect(res.status).toBe(200);
    expect(res.body.rewards.stars).toBeGreaterThanOrEqual(1);
    expect(res.body.result.score).toBeGreaterThan(0);
  });

  it('المرحلة المقفلة تعطي 403 بدل كشف محتواها', async () => {
    const res = await auth(request(app).get(`${base}/level/w6-l1`));
    expect(res.status).toBe(403);
  });

  it('brief المرحلة المفتوحة يقدّم تدريباً إضافياً وتلميحات ووقتاً مناسباً', async () => {
    const res = await auth(request(app).get(`${base}/level/w1-l1`));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('practiceSkills');
    expect(res.body.allowHints).toBe(false); // very easy tier: no hints needed
    expect(res.body.timeLimitSec).toBeNull(); // timers only from the Challenge Valley
  });
});

describe('حديقة المعرفة — التخصيص والشارات وتحدي اليوم', () => {
  it('يرفض تجهيز عنصر لم يُفتح بعد', async () => {
    const res = await auth(request(app).patch(`${base}/appearance`)).send({
      appearance: { cap: 'turban', glasses: 'round', backpack: 'none', book: 'none', trail: 'none', jump: 'puff' }
    });
    expect(res.status).toBe(200);
    const state = await auth(request(app).get(`${base}/state`));
    const turban = state.body.cosmetics.find((c) => c.key === 'cap:turban');
    // Either it was genuinely unlocked, or the server kept the default cap.
    expect(res.body.appearance.cap).toBe(turban.unlocked ? 'turban' : 'graduation');
  });

  it('يمنح شارة الإنجاز الأول بعد أول مرحلة', async () => {
    const badges = await prisma.gardenBadge.findMany({ where: { userId } });
    expect(badges.map((b) => b.badgeKey)).toContain('first-steps');
  });

  it('تحدي اليوم: مرة واحدة فقط، وبتاريخ اليوم الحقيقي فقط', async () => {
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const first = await auth(request(app).post(`${base}/daily`)).send({
      dayKey, correct: 4, total: 5,
      skills: [{ skillId: 'letter:ب', skillType: 'LETTER', label: 'حرف ب', correct: 4, wrong: 1 }]
    });
    expect(first.status).toBe(200);
    expect(first.body.stars).toBeGreaterThan(0);
    expect(first.body.gems).toBeGreaterThan(0);

    const replay = await auth(request(app).post(`${base}/daily`)).send({ dayKey, correct: 5, total: 5, skills: [] });
    expect(replay.status).toBe(409);
    const fake = await auth(request(app).post(`${base}/daily`)).send({ dayKey: '1999-01-01', correct: 5, total: 5, skills: [] });
    expect(fake.status).toBe(400);
  });

  it('يعرض حالة كاملة: 35 مرحلة، 7 عوالم، تخصيصات وزعماء', async () => {
    const res = await auth(request(app).get(`${base}/state`));
    expect(res.status).toBe(200);
    expect(res.body.levels).toHaveLength(35);
    expect(res.body.worlds).toHaveLength(7);
    expect(res.body.levels.filter((l) => l.isBoss)).toHaveLength(7);
    expect(res.body.cosmetics.length).toBeGreaterThanOrEqual(9);
    expect(res.body.bosses).toHaveLength(7);
    expect(res.body.worlds.every((w) => w.percent >= 0 && w.percent <= 100)).toBe(true);
    expect(res.body.levels.filter((l) => l.isBoss).every((l) => l.challengeCount === 10)).toBe(true);
  });
});

describe('حديقة المعرفة — منطق الإتقان (وحدات)', () => {
  it('النمو سريع والاضمحلال لطيف', () => {
    const up = applySkillUpdate({ mastery: 10, attempts: 1, correct: 1, streak: 1 }, true);
    const down = applySkillUpdate({ mastery: 80, attempts: 5, correct: 5, streak: 5 }, false);
    expect(up.mastery).toBeGreaterThan(10);
    expect(down.mastery).toBeLessThan(80);
    expect(down.mastery).toBeGreaterThan(70);
  });

  it('النجوم تعتمد على الإتقان لا على السرعة وحدها', () => {
    const independent = computeScore({ correct: 5, total: 5, streak: 5, hints: 0 });
    const helped = computeScore({ correct: 5, total: 5, streak: 5, hints: 2 });
    expect(independent.stars).toBe(3);
    expect(helped.stars).toBe(2);
  });

  it('لا يمنح 3 نجوم مع أخطاء كثيرة', () => {
    expect(computeScore({ correct: 6, total: 10, streak: 6, hints: 0 }).stars).toBe(1);
    expect(computeScore({ correct: 9, total: 10, streak: 9, hints: 0 }).stars).toBe(3);
  });
});
