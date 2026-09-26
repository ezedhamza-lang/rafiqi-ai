/**
 * واجهة المستخدم — all DOM screens for the game.
 *
 * Kept apart from the 3D engine so the render loop never touches layout code.
 * Every screen is RTL-first and sized for a child's touch.
 */
import { WORLD_THEMES, COSMETICS, COSMETIC_LABELS, COSMETIC_DEFAULTS } from '../config.js';
import { WORLD_INFO, LEVELS_PER_WORLD, BEAT_LABELS } from '../data/levels.js';
import { ALL_LEVELS } from '../data/levels.js';
import { STREAK_MESSAGES, describeSkill } from '../engine/mastery.js';
import { audio } from '../engine/audio.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const SCREENS = ['kg-title', 'kg-map', 'kg-intro', 'kg-results', 'kg-pause', 'kg-daily', 'kg-skills', 'kg-wardrobe', 'kg-badges'];

export class UI {
  constructor() {
    this.current = 'kg-title';
    this.onPickLevel = null;      // (levelId) => void
    this.onStart = null;          // (levelId) => void
    this.onDaily = null;
    this.onAppearance = null;     // (appearance) => void
    this.save = null;
  }

  /** Show exactly one screen (or none when `id` is null). */
  show(id) {
    for (const s of SCREENS) $(s)?.classList.toggle('hidden', s !== id);
    this.current = id;
  }

  hideAll() { this.show(null); }

  // ============================================================ title

  /**
   * @param {object} save   the player's progress
   * @param {object} badges server-known badge list
   */
  renderTitle(save, badges = []) {
    const p = save.profile;
    const stats = $('kg-title-stats');
    stats.innerHTML = '';

    if (p.stars > 0) {
      stats.append(
        el('span', null, `⭐ ${p.stars} نجمة`),
        el('span', null, `💎 ${p.gems} جوهرة`),
        el('span', null, `🏆 ${badges.length} شارة`)
      );
    } else {
      stats.append(el('span', null, '🌱 أول مغامرة — لنبدأ رحلتك!'));
    }

    // "Continue" appears only when there is real progress to resume.
    const hasProgress = Object.values(save.levelResults || {}).some((r) => (r?.stars ?? 0) > 0);
    const cont = $('kg-continue');
    cont.classList.toggle('hidden', !hasProgress);
    if (hasProgress) cont.textContent = `متابعة: ${WORLD_INFO[p.currentWorldId]?.name ?? ''}`;
  }

  // ============================================================ world map

  /**
   * The map is the long-term motivation: every world shows its own progress
   * bar, and every level shows ✅ completed / 🔓 unlocked / 🔒 locked.
   */
  renderMap(save) {
    const results = save.levelResults || {};
    const worlds = $('kg-worlds');
    worlds.innerHTML = '';

    // A world is unlocked once the previous one is fully cleared.
    let previousCleared = true;
    let worldsCleared = 0;

    for (const worldId of Object.keys(WORLD_THEMES)) {
      const theme = WORLD_THEMES[worldId];
      const info = WORLD_INFO[worldId] || { name: theme.name, emoji: theme.emoji };
      const levels = ALL_LEVELS.filter((l) => l.worldId === worldId);
      const done = levels.filter((l) => (results[l.id]?.stars ?? 0) > 0);
      const percent = Math.round((done.length / levels.length) * 100);
      const cleared = done.length === levels.length;
      if (cleared) worldsCleared++;

      const unlocked = previousCleared;
      const row = el('div', `kg-world${unlocked ? '' : ' kg-world--locked'}${cleared ? ' kg-world--cleared' : ''}`);

      row.append(el('div', 'kg-world__emoji', info.emoji));

      const body = el('div');
      body.append(el('div', 'kg-world__name', info.name));
      body.append(el('div', 'kg-world__blurb', theme.blurb));

      // Level buttons with explicit lock state.
      const levelRow = el('div', 'kg-world__levels');
      for (const lv of levels) {
        const stars = results[lv.id]?.stars ?? 0;
        const cls = ['kg-lvl'];
        if (stars > 0) cls.push('kg-lvl--done');
        if (lv.isBoss) cls.push('kg-lvl--boss');
        if (!unlocked) cls.push('kg-lvl--locked');
        const label = lv.isBoss
          ? (stars > 0 ? '👑' : '👾')
          : (stars > 0 ? '⭐'.repeat(stars) : String(lv.indexInWorld));
        const btn = el('button', cls.join(' '), label);
        btn.title = lv.name;
        if (unlocked) btn.addEventListener('click', () => { audio.ui(); this.onPickLevel?.(lv.id); });
        else btn.disabled = true;
        levelRow.append(btn);
      }
      body.append(levelRow);

      const bar = el('div', 'kg-world__bar');
      const fill = el('i');
      fill.style.width = `${percent}%`;
      bar.append(fill);
      const wrap = el('div');
      wrap.append(body, bar);
      row.append(wrap);

      if (unlocked) {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.kg-lvl')) return;
          audio.ui();
          const firstOpen = levels.find((l) => (results[l.id]?.stars ?? 0) === 0) || levels[0];
          this.onPickLevel?.(firstOpen.id);
        });
      }

      worlds.append(row);
      previousCleared = cleared;
    }

    const p = save.profile;
    $('kg-map-stars').textContent = p.stars;
    $('kg-map-gems').textContent = p.gems;
    $('kg-map-keys').textContent = p.keys;
    void worldsCleared;
  }

  // ============================================================ level intro

  /**
   * Introduce the level before playing: what the world is, and the beats ahead.
   * @param {object} level  the level descriptor
   * @param {object} brief  server adaptivity brief (practice skills, hints)
   */
  renderIntro(level, brief = {}) {
    const info = WORLD_INFO[level.worldId] || {};
    $('kg-intro-emoji').textContent = info.emoji || WORLD_THEMES[level.worldId]?.emoji || '🌱';
    $('kg-intro-title').textContent = level.isBoss
      ? `${info.emoji} ${level.boss.icon} ${level.boss.name}`
      : `${info.emoji} ${info.name} — المرحلة ${level.indexInWorld}`;

    // Extra practice is announced up front so it feels like help, not a test.
    const practice = brief.practiceSkills || [];
    const introText = level.isBoss
      ? `${info.intro} الزعيم ${level.boss.name} يختبر ${level.challengeCount} تحدياً.`
      : info.intro;
    $('kg-intro-text').textContent = practice.length
      ? `${introText} سأعطيك تدريباً إضافياً على ${practice.length} مهارة تحتاج مراجعة.`
      : introText;

    const list = $('kg-intro-beats');
    list.innerHTML = '';
    for (const beat of level.beats) {
      const label = BEAT_LABELS[beat.beatId] || beat.beatId;
      const detail = beat.platformOnly
        ? 'اقفز واجمع النجوم ⭐'
        : beat.timed
          ? 'تحدٍّ سريع 💨'
          : 'تحدٍّ تعليمي 📚';
      list.append(el('li', null, `<b>${label}</b><span>${detail}</span>`));
    }
  }

  // ============================================================ HUD

  /** Update the live HUD from the current run. */
  updateHud({ levelName, done, total, stars, gems, streak }) {
    $('kg-level-name').textContent = levelName;
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    $('kg-progress-bar').style.width = `${pct}%`;
    $('kg-progress-text').textContent = `${done} / ${total}`;
    $('kg-stars').textContent = stars;
    $('kg-gems').textContent = gems;
    $('kg-streak-count').textContent = streak;
    $('kg-streak').classList.toggle('is-hot', streak >= 3);
  }

  /**
   * Show the current objective.
   * Ordered challenges get empty slots that fill in as the child collects,
   * so the shape of the word is visible while it is being built.
   */
  updateObjective({ beatLabel, challenge, collected = [], slots = null }) {
    const box = $('kg-objective');
    if (!challenge) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');

    $('kg-beat-label').textContent = beatLabel || 'التحدي';
    $('kg-prompt').textContent = challenge.prompt || '';

    // Show the picture, the pattern, or the target letter/word.
    const target = $('kg-target');
    if (challenge.emoji) target.textContent = `${challenge.emoji} ${challenge.target ?? ''}`.trim();
    else target.textContent = challenge.target ?? '';

    const slotBox = $('kg-slots');
    slotBox.innerHTML = '';
    if (challenge.ordered && slots) {
      slots.forEach((value, i) => {
        const filled = i < collected.length;
        slotBox.append(el('div', `kg-slot${filled ? ' kg-slot--filled' : ''}`, filled ? value : '؟'));
      });
    }
  }

  /** Show feedback after an answer. Auto-hides. */
  feedback(text, good = true, ms = 1500) {
    const box = $('kg-feedback');
    if (!text) { box.classList.remove('is-shown'); return; }
    box.textContent = text;
    box.className = `kg-feedback is-shown ${good ? 'kg-feedback--good' : 'kg-feedback--bad'}`;
    clearTimeout(this._fbTimer);
    this._fbTimer = setTimeout(() => box.classList.remove('is-shown'), ms);
  }

  /** Celebrate a streak milestone. */
  streakBurst(streak) {
    const msg = STREAK_MESSAGES.filter((m) => m.at === streak).pop();
    if (!msg) return;
    this.feedback(msg.text, true, 1400);
    audio.streak();
  }

  // ============================================================ results

  /**
   * End-of-level screen.
   * The stars, score and rewards all come from the server response — the
   * client never invents them.
   */
  renderResults({ run, server, isBoss, nextLevelId }) {
    const result = server?.result;
    const stars = result?.stars ?? 0;

    $('kg-results-title').textContent = isBoss
      ? (stars > 0 ? '🏆 هزمت الزعيم!' : '💪 الزعيم انتظرتك — جرّب مرة أخرى')
      : (stars >= 3 ? '🎉 أحسنت! عمل رائع' : stars >= 2 ? '👍 أحسنت!' : '🌱 بداية جميلة');

    // Show the earned stars, greyed-out for the rest.
    const starBox = $('kg-results-stars');
    starBox.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      starBox.append(el('span', i < stars ? '' : 'is-off', '⭐'));
    }

    // Core stats.
    const grid = $('kg-results-grid');
    grid.innerHTML = '';
    const cells = [
      ['النقاط', result?.score ?? 0],
      ['الإجابات الصحيحة', result?.correct ?? run.correct],
      ['محاولات أخرى', result?.wrong ?? run.wrong],
      ['الوقت', `${result?.timeSec ?? Math.round(run.elapsed)} ثانية`],
      ['الدقة', `${result?.accuracyPercent ?? 0}%`],
      ['أطول سلسلة', `🔥 ${run.bestStreak}`]
    ];
    for (const [label, value] of cells) {
      grid.append(el('div', 'kg-result-cell', `<b>${value}</b><span>${label}</span>`));
    }

    // Mastered skills — the educational headline of the screen.
    const skillList = $('kg-results-skills');
    skillList.innerHTML = '';
    const skills = (server?.skills || []).map(describeSkill);
    const mastered = skills.filter((s) => s.status === 'MASTERED');
    if (mastered.length) {
      skillList.append(el('li', null, `<span>🎓 أتقنت ${mastered.length} مهارة</span><span>✅</span>`));
      for (const s of mastered.slice(0, 8)) {
        skillList.append(el('li', null, `<span>${s.label}</span><span>${s.mastery}% · ${s.statusAr}</span>`));
      }
    } else {
      skillList.append(el('li', null, '<span>لا بأس! كل محاولة تقرّبك من الإتقان</span><span>🌱</span>'));
    }

    // Rewards + anything newly unlocked.
    const rewards = $('kg-results-rewards');
    rewards.innerHTML = '';
    const r = server?.rewards;
    if (r?.stars > 0) rewards.append(el('span', 'kg-reward-chip', `⭐ +${r.stars}`));
    if (r?.gems > 0) rewards.append(el('span', 'kg-reward-chip', `💎 +${r.gems}`));
    if (r?.keys > 0) rewards.append(el('span', 'kg-reward-chip', `🔑 +${r.keys}`));
    if (r?.xp > 0) rewards.append(el('span', 'kg-reward-chip', `✨ +${r.xp} خبرة`));
    for (const c of server?.unlockedCosmetics || []) {
      rewards.append(el('span', 'kg-reward-chip', `🎽 عنصر جديد: ${c.label}`));
    }
    for (const b of server?.newBadges || []) {
      rewards.append(el('span', 'kg-reward-chip', `🏆 ${b.icon} ${b.name}`));
    }
    if (!rewards.childNodes.length) {
      rewards.append(el('span', 'kg-reward-chip', 'استمر — لا تنقص نقاطك أبداً'));
    }

    // The next-level button is hidden on the last level of the game.
    const next = $('kg-next');
    next.classList.toggle('hidden', !nextLevelId);
  }

  // ============================================================ daily

  /**
   * Daily challenge panel. Shows the five dots and whether today is done.
   * Completion is enforced server-side, so the button disables after use.
   */
  renderDaily(save) {
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    $('kg-daily-date').textContent = now.toLocaleDateString('ar-TN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const doneToday = (save.daily || []).find((d) => d.dayKey === dayKey);
    const box = $('kg-daily-progress');
    box.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      box.append(el('div', `kg-daily__dot${doneToday ? ' kg-daily__dot--done' : ''}`, doneToday ? '✅' : String(i + 1)));
    }

    const start = $('kg-daily-start');
    start.disabled = Boolean(doneToday);
    start.textContent = doneToday ? 'تم الإنجاز اليوم ✓ — عد غداً' : 'ابدأ التحدي';
    return dayKey;
  }

  // ============================================================ skills

  /**
   * The mastery dashboard. This is what makes learning visible: every skill
   * shows its stage, its percentage and whether it needs more practice.
   */
  renderSkills(save) {
    const box = $('kg-skills-list');
    box.innerHTML = '';
    const skills = save.skills || [];

    if (!skills.length) {
      box.append(el('p', 'kg-panel__hint', 'لم تبدأ أي تحدٍّ بعد — العب أول مرحلة وستظهر مهاراتك هنا.'));
      return;
    }

    const sorted = [...skills].sort((a, b) => b.mastery - a.mastery);
    for (const raw of sorted.slice(0, 40)) {
      const s = describeSkill(raw);
      const color = s.status === 'MASTERED' ? '#10b981' : s.status === 'PRACTICING' ? '#e8a317' : '#ef4444';
      const row = el('div', 'kg-skill-row');
      row.append(el('div', 'kg-skill-row__top', `<span>${s.label}</span><span style="color:${color}">${s.statusAr}</span>`));
      const meter = el('div', 'kg-skill-row__meter');
      const fill = el('i');
      fill.style.width = `${s.mastery}%`;
      fill.style.background = color;
      meter.append(fill);
      row.append(meter);
      row.append(el('div', 'kg-skill-row__meta',
        `المرحلة: ${s.stageAr} · ${s.correct} صحيحة من ${s.attempts} محاولة`));
      box.append(row);
    }
  }

  // ============================================================ wardrobe

  /**
   * Cosmetics are earned, never bought. Locked items show their unlock
   * requirement so the child has something to aim for.
   */
  renderWardrobe(save, onPick) {
    const box = $('kg-wardrobe-list');
    box.innerHTML = '';
    const unlocked = save.profile?.unlocked || {};
    const current = { ...COSMETIC_DEFAULTS, ...(save.profile?.appearance || {}) };
    const rules = save.cosmetics || [];

    for (const [kind, items] of Object.entries(COSMETICS)) {
      const group = el('div', 'kg-wardrobe__group');
      group.append(el('h3', null, COSMETIC_LABELS[kind] || kind));

      const row = el('div', 'kg-wardrobe__items');
      for (const item of items) {
        // The server is the source of truth for what has been unlocked.
        const isUnlocked = !item.ruleKey || Boolean(unlocked[item.ruleKey]);
        const rule = item.ruleKey ? rules.find((r) => r.key === item.ruleKey) : null;
        const isActive = current[kind] === item.id;

        const btn = el('button',
          `kg-cosmetic${isActive ? ' kg-cosmetic--active' : ''}${isUnlocked ? '' : ' kg-cosmetic--locked'}`,
          isUnlocked ? item.label : `🔒 ${item.label}`);
        if (!isUnlocked) {
          btn.disabled = true;
          // Show what achievement opens it — a goal, not a tease.
          const req = rule?.requires || {};
          const parts = [];
          if (req.stars != null) parts.push(`${req.stars} نجمة`);
          if (req.mastered != null) parts.push(`${req.mastered} مهارة متقنة`);
          if (req.worldsCleared != null) parts.push(`${req.worldsCleared} عالم مكتمل`);
          if (req.streak != null) parts.push(`سلسلة ${req.streak}`);
          btn.title = parts.length ? `يُفتح بـ: ${parts.join(' + ')}` : 'مقفل';
        } else {
          btn.addEventListener('click', () => { audio.ui(); onPick?.(kind, item.id); });
        }
        row.append(btn);
      }
      group.append(row);
      box.append(group);
    }
  }

  // ============================================================ badges

  renderBadges(save) {
    const box = $('kg-badges-list');
    box.innerHTML = '';
    const earned = new Map((save.badges || []).map((b) => [b.key, b]));

    for (const boss of save.bosses || []) {
      const isEarned = earned.has(boss.key);
      const card = el('div', `kg-badge${isEarned ? '' : ' kg-badge--locked'}`);
      card.append(el('div', 'kg-badge__icon', isEarned ? boss.icon : '🔒'));
      card.append(el('div', 'kg-badge__name', isEarned ? boss.name : `${boss.name} (زعيم)`));
      box.append(card);
    }
    for (const b of earned.values()) {
      const card = el('div', 'kg-badge');
      card.append(el('div', 'kg-badge__icon', b.icon));
      card.append(el('div', 'kg-badge__name', b.name));
      box.append(card);
    }
    if (!box.childNodes.length) {
      box.append(el('p', 'kg-panel__hint', 'الشارات تُكتسب بالتعلّم — ابدأ أول مرحلة!'));
    }
  }
}

export { $, el };
