// How much of the 50-request auth budget does ONE page load of the app consume?
// This measures the real production characteristic behind ISS-020 rather than guessing:
// the answer decides whether a classroom behind one NAT IP is actually at risk.
import fs from 'fs';

const API = process.env.AUDIT_API || 'http://localhost:3003';
const FRONT = process.env.AUDIT_FRONT || 'http://localhost:5174';
const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((p) => fs.existsSync(p));
const puppeteer = (await import('puppeteer-core')).default;

const remaining = async () => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'probe-budget@invalid.local', password: 'x' })
  });
  return { status: r.status, remaining: r.headers.get('ratelimit-remaining'), resetIn: r.headers.get('ratelimit-reset') };
};

const lines = [];
const before = await remaining();
lines.push(`auth budget BEFORE the measurement: remaining=${before.remaining} (a failed login still counts)`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const authCalls = [];
page.on('response', (r) => {
  const u = r.url();
  if (/\/api\/auth\//.test(u)) authCalls.push({ m: r.request().method(), p: u.replace(FRONT, '').replace(API, ''), s: r.status() });
});

const login = await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@test.tn', password: 'qarn-zeft-7alib-2026!' })
})).json();

await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate((s) => {
  localStorage.setItem('school_token', s.token);
  localStorage.setItem('school_user', JSON.stringify(s.user));
  if (s.refreshToken) localStorage.setItem('school_refresh_token', s.refreshToken);
}, login);
lines.push(`refresh token present in the session: ${!!login.refreshToken}`);

authCalls.length = 0;
await page.goto(`${FRONT}/student-space/leaderboard`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
lines.push(`\nONE page load of /student-space/leaderboard produced ${authCalls.length} /api/auth/* call(s):`);
for (const c of authCalls) lines.push(`   ${c.m} ${c.p} -> ${c.s}`);
if (!authCalls.length) lines.push('   (none — a valid access token means no refresh call)');

const afterOne = await remaining();
lines.push(`\nauth budget after ONE page load: remaining=${afterOne.remaining}`);

authCalls.length = 0;
for (let i = 0; i < 5; i += 1) {
  await page.goto(`${FRONT}/student-space/leaderboard`, { waitUntil: 'networkidle2' });
}
await new Promise((r) => setTimeout(r, 2000));
lines.push(`\nFIVE more page loads produced ${authCalls.length} /api/auth/* call(s):`);
for (const c of authCalls) lines.push(`   ${c.m} ${c.p} -> ${c.s}`);

const afterSix = await remaining();
lines.push(`\nauth budget after SIX page loads total: remaining=${afterSix.remaining}`);
const used = Number(before.remaining) - Number(afterSix.remaining);
lines.push(`=> ${used} of the 50-request auth budget consumed by 6 page loads of ONE student (plus the probes)`);
lines.push('=> extrapolated: a class of 30 students each loading 6 pages behind one NAT IP would need ~'
  + `${Math.round((used / 6) * 6 * 30)} auth requests, against a shared ceiling of 50 per 15 minutes.`);

await browser.close();
fs.writeFileSync('scripts/_budget.txt', lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
