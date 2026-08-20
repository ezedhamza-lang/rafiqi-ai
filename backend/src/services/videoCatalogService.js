import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../../content/videos/video-catalog.json');

export const VIDEO_PROVIDERS = {
  youtube: 'youtube',
  dailymotion: 'dailymotion',
  vimeo: 'vimeo',
  direct: 'direct'
};

export const VIDEO_PROVIDER_LABELS = {
  youtube: 'يوتيوب',
  dailymotion: 'Dailymotion',
  vimeo: 'Vimeo',
  direct: 'ملف مباشر'
};

const EMBED_TEMPLATES = {
  youtube: (videoId) => `https://www.youtube-nocookie.com/embed/${videoId}`,
  dailymotion: (videoId) => `https://www.dailymotion.com/embed/video/${videoId}`,
  vimeo: (videoId) => `https://player.vimeo.com/video/${videoId}`
};

const THUMBNAIL_TEMPLATES = {
  youtube: (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  dailymotion: (videoId) => `https://www.dailymotion.com/thumbnail/video/${videoId}`,
  vimeo: () => null
};

function readJson(abs) {
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeHttpsUrl(url) {
  const value = String(url || '').trim();
  if (!/^https:\/\//i.test(value)) return null;
  return value;
}

function isDirectVideoUrl(url) {
  const value = normalizeHttpsUrl(url);
  if (!value) return false;
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(value);
}

export function validateVideoEntry(entry) {
  if (!entry || typeof entry !== 'object') return { ok: false, errors: ['العنصر فارغ'] };
  const errors = [];
  const id = String(entry.id || '').trim();
  if (!id) errors.push('id مطلوب');
  if (!String(entry.title || '').trim()) errors.push('title مطلوب');

  const provider = String(entry.provider || '').trim().toLowerCase();
  if (!VIDEO_PROVIDERS[provider]) errors.push(`provider غير مدعوم (المسموح: ${Object.keys(VIDEO_PROVIDERS).join(', ')})`);

  if (provider === 'direct') {
    const url = normalizeHttpsUrl(entry.url);
    if (!url) errors.push('url مطلوب ببروتوكول https للمزوّد direct');
    else if (!isDirectVideoUrl(url)) errors.push('url يجب أن يكون ملف فيديو مباشر (mp4/webm/ogv...)');
  } else if (provider && VIDEO_PROVIDERS[provider]) {
    if (!String(entry.videoId || '').trim()) errors.push(`videoId مطلوب للمزوّد ${provider}`);
    const url = entry.url;
    if (url !== undefined && url !== null && !normalizeHttpsUrl(url)) errors.push('url (إن وُجد) يجب أن يكون https');
  }

  if (entry.durationSeconds !== undefined && entry.durationSeconds !== null) {
    const n = Number(entry.durationSeconds);
    if (!Number.isFinite(n) || n < 0) errors.push('durationSeconds يجب أن يكون رقماً غير سالب');
  }
  if (entry.thumbnail !== undefined && entry.thumbnail !== null && entry.thumbnail !== '' && !normalizeHttpsUrl(entry.thumbnail)) {
    errors.push('thumbnail يجب أن يكون رابطاً https');
  }
  if (entry.status !== undefined && entry.status !== null && entry.status !== 'active') {
    errors.push('status غير مدعوم — استعمل active فقط');
  }
  return { ok: errors.length === 0, errors };
}

export function buildEmbedUrl(entry) {
  const provider = String(entry.provider || '').toLowerCase();
  const template = EMBED_TEMPLATES[provider];
  if (template) {
    const videoId = String(entry.videoId || '').trim();
    if (!videoId) return null;
    return template(videoId);
  }
  if (provider === VIDEO_PROVIDERS.direct) {
    return isDirectVideoUrl(entry.url) ? entry.url : null;
  }
  return null;
}

export function buildThumbnail(entry) {
  if (entry.thumbnail && normalizeHttpsUrl(entry.thumbnail)) return entry.thumbnail;
  const provider = String(entry.provider || '').toLowerCase();
  const template = THUMBNAIL_TEMPLATES[provider];
  if (!template) return null;
  const videoId = String(entry.videoId || '').trim();
  if (!videoId) return null;
  return template(videoId);
}

export function formatDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = Math.round(n / 60);
  if (m >= 60) return `${Math.floor(m / 60)} س و ${m % 60} د`;
  return `${m} دقيقة`;
}

export function toPublicVideo(entry) {
  const embedUrl = buildEmbedUrl(entry);
  if (!embedUrl) return null;
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description || '',
    provider: String(entry.provider || '').toLowerCase(),
    providerLabel: VIDEO_PROVIDER_LABELS[String(entry.provider || '').toLowerCase()] || entry.provider,
    embedUrl,
    url: String(entry.url || '').trim() || null,
    thumbnail: buildThumbnail(entry),
    durationSeconds: entry.durationSeconds !== undefined ? Number(entry.durationSeconds) : null,
    durationLabel: formatDuration(entry.durationSeconds),
    source: entry.source || '',
    gradeId: entry.gradeId || null,
    subjectId: entry.subjectId || null,
    unitId: entry.unitId || null,
    lessonId: entry.lessonId || null
  };
}

export function loadVideoCatalog() {
  const data = readJson(CATALOG_PATH);
  const raw = Array.isArray(data) ? data : Array.isArray(data?.videos) ? data.videos : [];
  const videos = [];
  const rejected = [];
  for (const entry of raw) {
    const check = validateVideoEntry(entry);
    if (!check.ok) {
      rejected.push({ id: entry?.id || '(بدون معرّف)', errors: check.errors });
      continue;
    }
    videos.push(entry);
  }
  return { videos, rejected, total: raw.length };
}

function filterVideos(list, { gradeId, subjectId, unitId } = {}) {
  let out = list;
  if (gradeId) out = out.filter((v) => !v.gradeId || v.gradeId === gradeId);
  if (subjectId) out = out.filter((v) => !v.subjectId || v.subjectId === subjectId);
  if (unitId) out = out.filter((v) => !v.unitId || v.unitId === unitId);
  return out;
}

export function listVideos(filters = {}, catalogOverride) {
  const catalog = catalogOverride || loadVideoCatalog().videos;
  const matched = filterVideos(catalog, filters);
  return matched.map(toPublicVideo).filter(Boolean);
}

export function getVideo(id, catalogOverride) {
  const catalog = catalogOverride || loadVideoCatalog().videos;
  const entry = catalog.find((v) => String(v.id) === String(id));
  return entry ? toPublicVideo(entry) : null;
}

export function listVideoSubjects(catalogOverride) {
  const catalog = catalogOverride || loadVideoCatalog().videos;
  const seen = new Set();
  const subjects = [];
  for (const v of catalog) {
    if (v.subjectId && !seen.has(v.subjectId)) {
      seen.add(v.subjectId);
      subjects.push({ id: v.subjectId });
    }
  }
  return subjects;
}

export function listVideoGrades(catalogOverride) {
  const catalog = catalogOverride || loadVideoCatalog().videos;
  const seen = new Set();
  const grades = [];
  for (const v of catalog) {
    if (v.gradeId && !seen.has(v.gradeId)) {
      seen.add(v.gradeId);
      grades.push({ id: v.gradeId });
    }
  }
  return grades;
}
