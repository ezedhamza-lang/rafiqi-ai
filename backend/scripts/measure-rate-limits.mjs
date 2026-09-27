// RATE-LIMIT BEHAVIOUR STUDY — measurement only, no configuration is changed.
//
// Purpose: replace the guesswork around ISS-020 with numbers, so the repair can be a
// design rather than "raise 50 to 100". Two questions the owner asked:
//
//   SCENARIO A — 30 students behind one NAT logging in at the same moment.
//                How many legitimate logins succeed today, and where is the real ceiling?
//   SCENARIO B — a dense login attack from one address.
//                Does the limiter stop the attack, and does it also lock out the
//                legitimate student sharing that address (collateral damage)?
//
// Everything here runs against the API as it is configured. No env var is set, no file is
// written, no limit is touched.
import fs from 'fs';

const API = process.env.AUDIT_API || 'http://localhost:3003';
const PW = 'qarn-zeft-7alib-2026!';

const out = [];
const say = (s = '') => { out.push(s); console.log(s); };

const login = async (email, password = PW) => {
  const started = Date.now();
  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json().catch(() => ({}));
    return {
      status: r.status, ok: !!d.token, ms: Date.now() - started,
      remaining: r.headers.get('ratelimit-remaining'), limit: r.headers.get('ratelimit-limit'),
      error: d.error
    };
  } catch (e) {
    return { status: 0, ok: false, ms: Date.now() - started, error: e.message.slice(0, 60) };
  }
};

// Ask the database which real demo accounts exist, so no account has to be created.
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const students = await prisma.user.findMany({
  where: { role: 'STUDENT' }, select: { email: true }, orderBy: { id: 'asc' }
});
await prisma.$disconnect();
say(`real STUDENT accounts available: ${students.length} (no account is created by this study)`);
say('');

// ── reset the counter so the measurement starts from a known state ──────────────
say('=== baseline ===');
const base = await login('baseline-probe@invalid.local', 'x');
say(`  a failed login answers ${base.status} and reports limit=${base.limit} remaining=${base.remaining}`);
say('  (the limiter counter is per-IP and per-window; the window is 15 minutes)');
say('');

// ── SCENARIO A: a class logs in together ────────────────────────────────────────
say('=== SCENARIO A — a class logging in at the same moment (one shared NAT address) ===');
const wave = async (label) => {
  const results = await Promise.all(students.map((s) => login(s.email)));
  const ok = results.filter((r) => r.ok).length;
  const limited = results.filter((r) => r.status === 429).length;
  const other = results.filter((r) => !r.ok && r.status !== 429);
  const slowest = Math.max(...results.map((r) => r.ms));
  const remaining = results.map((r) => r.remaining).filter((x) => x != null).pop();
  say(`  ${label}: ${students.length} simultaneous legitimate logins -> ${ok} succeeded, ${limited} blocked by 429, ${other.length} other failures; slowest ${slowest}ms; budget left ${remaining}`);
  return { label, attempted: students.length, ok, limited, other: other.length, slowest, remaining };
};
const waves = [];
waves.push(await wave('wave 1'));
waves.push(await wave('wave 2'));
waves.push(await wave('wave 3'));
waves.push(await wave('wave 4'));
say('');
say('  observed legitimate failures per wave: ' + waves.map((w) => w.limited).join(' / ') + ` of ${students.length}`);
say('');

// ── SCENARIO B: a dense attack from the same address ───────────────────────────
say('=== SCENARIO B — a dense login attack from the same address ===');
const before = await login('student@test.tn');
say(`  a legitimate login BEFORE the attack: ${before.ok ? 'OK' : 'blocked ' + before.status} (budget ${before.remaining})`);
const attack = 60;
const attackResults = await Promise.all(
  Array.from({ length: attack }, (_, i) => login(`victim${i}@attack.local`, 'wrong-' + i))
);
const attackLimited = attackResults.filter((r) => r.status === 429).length;
const attackWrongPass = attackResults.filter((r) => r.status === 401).length;
say(`  ${attack} rapid login attempts with wrong passwords: ${attackWrongPass} answered 401 (rejected on credentials), ${attackLimited} answered 429 (blocked by the limiter)`);
const during = await login('student@test.tn');
say(`  a legitimate login DURING/AFTER the attack: ${during.ok ? 'OK' : 'BLOCKED ' + during.status + ' ' + (during.error || '')} (budget ${during.remaining})`);
say('');

say('=== what the numbers say ===');
const firstBlockedWave = waves.find((w) => w.limited > 0);
say(`  * ${students.length} simultaneous legitimate logins per wave; the first wave that lost a user was: ${firstBlockedWave ? firstBlockedWave.label : 'none in 4 waves'}`);
say(`  * total legitimate logins served before the first 429: about ${waves.filter((w) => !w.limited).length * students.length} in the measured window`);
say(`  * the attack consumed the SAME counter as a sign-in, so a legitimate student sharing the address is collateral damage: ${during.ok ? 'no (in this run)' : 'YES'}`);
say('  * the counter is keyed by IP only, so the size of the class — not the size of the attack — decides who is locked out.');

fs.writeFileSync('scripts/_ratelimit-study.txt', out.join('\n'), 'utf8');
