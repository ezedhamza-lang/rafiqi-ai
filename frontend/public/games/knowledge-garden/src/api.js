/**
 * الاتصال بالخادم — Knowledge Garden API client.
 *
 * Important: this client NEVER sends a score. It sends counters only, and the
 * server recomputes every reward. If the network fails the game keeps running
 * fully offline — progress is cached in localStorage and synced later.
 */

const TOKEN_KEYS = ['school_token', 'rafiqi_token', 'token', 'accessToken'];
const CACHE_KEY = 'kg_save_v1';
const BASE = '/api/games/knowledge-garden';

function getToken() {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return v.replace(/^"|"$/g, '');
    }
    const m = document.querySelector('meta[name="rafiqi-token"]');
    if (m) return m.content;
  } catch { /* storage unavailable */ }
  return null;
}

/** A brand-new player starts with an empty, unlocked-first-level save. */
export function emptySave() {
  return {
    profile: {
      stars: 0, gems: 0, keys: 0,
      currentWorldId: 'letters-garden', currentLevelId: 'w1-l1',
      appearance: null, unlocked: {},
      totalCorrect: 0, totalMistakes: 0, bestScore: 0,
      dailyStreak: 0, lastDailyDay: null, bestStreak: 0
    },
    levelResults: {},
    skills: [],
    practiceQueue: [],
    badges: [],
    daily: [],
    cosmetics: [],
    bosses: []
  };
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return emptySave();
    return { ...emptySave(), ...JSON.parse(raw) };
  } catch {
    return emptySave();
  }
}

function saveCache(save) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(save)); } catch { /* quota */ }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token) return null;                      // played without logging in
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || 'خطأ في الاتصال');
      e.status = res.status;
      throw e;
    }
    return await res.json();
  } catch (e) {
    if (e.status) throw e;                      // a real API error
    return null;                                // offline → keep playing
  }
}

/** Fold the server's level list into a compact { stars, bestScore } map. */
function toResults(levels = []) {
  const out = {};
  for (const l of levels) {
    out[l.id] = { stars: l.stars, bestScore: l.bestScore, bestTimeSec: l.bestTimeSec, unlocked: l.unlocked };
  }
  return out;
}

/**
 * Load the authoritative save.
 * Falls back to the local cache whenever the server is unreachable, so a child
 * on a flaky connection never loses their place.
 *
 * Any API error — including an expired token (401) — degrades to the cache
 * instead of rejecting. An uncaught rejection here used to leave the game
 * stuck on the loading screen forever (2026-09-26: token expired mid-session,
 * `Uncaught (in promise)`, loading never hid).
 */
export async function loadState() {
  let data = null;
  try {
    data = await request('/state');
  } catch {
    data = null;   // 401 / 403 / 5xx → play from the cache, sync later
  }
  if (!data) return { save: loadCache(), offline: true };

  const save = {
    profile: { ...emptySave().profile, ...data.profile },
    levelResults: toResults(data.levels),
    levels: data.levels,
    worlds: data.worlds,
    skills: data.skills,
    practiceQueue: data.practiceQueue || [],
    badges: data.badges,
    daily: data.daily,
    rewards: data.rewards,
    cosmetics: data.cosmetics,
    bosses: data.bosses
  };
  saveCache(save);
  return { save, offline: false };
}

/** Adaptivity brief for one level (extra practice, hints, timer). */
export async function loadLevelBrief(levelId) {
  const data = await request(`/level/${levelId}`);
  return data || { practiceSkills: [], allowHints: true, timeLimitSec: null, previousBest: null };
}

/** Submit a finished run. The response carries the server-decided rewards. */
export async function submitLevel(submission) {
  const data = await request('/level-result', { method: 'POST', body: submission });
  if (!data) return null;

  // Merge the server's verdict into the cache so a refresh stays consistent.
  const save = loadCache();
  save.profile = { ...save.profile, ...data.rewards, stars: save.profile.stars };
  if (data.skills) save.skills = data.skills;
  if (data.practiceQueue) save.practiceQueue = data.practiceQueue;
  saveCache(save);
  return data;
}

/** Daily challenge — once per day, enforced server-side. */
export async function submitDaily(payload) {
  const data = await request('/daily', { method: 'POST', body: payload });
  if (data) {
    const save = loadCache();
    save.profile = { ...save.profile, dailyStreak: (save.profile.dailyStreak || 0) + 1 };
    saveCache(save);
  }
  return data;
}

/** Persist the owl's outfit. The server only accepts unlocked items. */
export async function saveAppearance(appearance) {
  const data = await request('/appearance', { method: 'PATCH', body: { appearance } });
  if (data) {
    const save = loadCache();
    save.profile = { ...save.profile, appearance: data.appearance };
    saveCache(save);
  }
  return data;
}

/** True when the child is signed in and progress can be saved. */
export function isSignedIn() {
  return Boolean(getToken());
}

export { getToken };
