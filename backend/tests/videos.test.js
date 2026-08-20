import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateVideoEntry,
  buildEmbedUrl,
  buildThumbnail,
  formatDuration,
  toPublicVideo,
  listVideos,
  getVideo
} from '../src/services/videoCatalogService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../content/videos/video-catalog.json');

let app;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
});

const VALID = {
  youtube: { id: 'v-youtube', title: 'شرح درس', provider: 'youtube', videoId: 'dQw4w9WgXcQ', durationSeconds: 240, source: 'قناة رسمية' },
  dailymotion: { id: 'v-dm', title: 'فيديو', provider: 'dailymotion', videoId: 'x8abcdef', durationSeconds: 300 },
  vimeo: { id: 'v-vimeo', title: 'فيديو', provider: 'vimeo', videoId: '123456', durationSeconds: 180 },
  direct: { id: 'v-direct', title: 'فيديو مباشر', provider: 'direct', url: 'https://example.com/lesson.mp4', durationSeconds: 240 }
};

describe('المرحلة 6.4 — كتالوج الفيديوهات القصيرة (المصادر الخارجية)', () => {
  describe('ملف الكتالوج', () => {
    it('ملف الكتالوج موجود وصالح JSON ويحمل بنية قائمة videos', () => {
      expect(fs.existsSync(CATALOG_PATH)).toBe(true);
      const data = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      expect(data).toBeTruthy();
      expect(Array.isArray(data.videos)).toBe(true);
      expect(data._meta).toBeTruthy();
      expect(data._meta.schema).toBeTruthy();
    });
  });

  describe('التحقق من العناصر (لا يُقبل أي رابط مختلق أو غير آمن)', () => {
    it('يقبل العناصر الصالحة لكل المزوّدين', () => {
      for (const entry of Object.values(VALID)) {
        const check = validateVideoEntry(entry);
        expect(check.ok, `${entry.provider}: ${check.errors.join('، ')}`).toBe(true);
      }
    });

    it('يرفض المزوّد غير المدعوم', () => {
      const check = validateVideoEntry({ id: 'x', title: 'x', provider: 'vimeo2', videoId: '1' });
      expect(check.ok).toBe(false);
      expect(check.errors.some((e) => e.includes('provider'))).toBe(true);
    });

    it('يرفض رابط http غير آمن للملفات المباشرة', () => {
      const check = validateVideoEntry({ id: 'x', title: 'x', provider: 'direct', url: 'http://example.com/lesson.mp4' });
      expect(check.ok).toBe(false);
      expect(check.errors.some((e) => e.includes('https'))).toBe(true);
    });

    it('يرفض الملفات غير المباشرة للمزوّد direct', () => {
      const check = validateVideoEntry({ id: 'x', title: 'x', provider: 'direct', url: 'https://example.com/page.html' });
      expect(check.ok).toBe(false);
      expect(check.errors.some((e) => e.includes('ملف فيديو'))).toBe(true);
    });

    it('يرفض نقص videoId للمزوّدات المدمجة', () => {
      const check = validateVideoEntry({ id: 'x', title: 'x', provider: 'youtube' });
      expect(check.ok).toBe(false);
      expect(check.errors.some((e) => e.includes('videoId'))).toBe(true);
    });

    it('يرفض المدة السالبة وصورة مصغّرة غير https', () => {
      const badDuration = validateVideoEntry({ ...VALID.youtube, durationSeconds: -3 });
      expect(badDuration.ok).toBe(false);
      const badThumb = validateVideoEntry({ ...VALID.youtube, thumbnail: 'http://img/1.jpg' });
      expect(badThumb.ok).toBe(false);
    });
  });

  describe('بناء روابط التضمين (embed URLs)', () => {
    it('يولّد روابط https صحيحة لكل المزوّدين المدمجين', () => {
      expect(buildEmbedUrl(VALID.youtube)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(buildEmbedUrl(VALID.dailymotion)).toBe('https://www.dailymotion.com/embed/video/x8abcdef');
      expect(buildEmbedUrl(VALID.vimeo)).toBe('https://player.vimeo.com/video/123456');
      expect(buildEmbedUrl(VALID.direct)).toBe('https://example.com/lesson.mp4');
    });

    it('يستعمل مصغّرات مشتقة من المزوّد عند غيابها', () => {
      expect(buildThumbnail(VALID.youtube)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(buildThumbnail(VALID.direct)).toBeNull();
    });

    it('toPublicVideo لا ينتج عنصراً بلا رابط قابل للتضمين', () => {
      expect(toPublicVideo({ id: 'x', title: 'x', provider: 'direct', url: 'http://bad' })).toBeNull();
      const pub = toPublicVideo(VALID.youtube);
      expect(pub).toBeTruthy();
      expect(pub.embedUrl).toMatch(/^https:\/\//);
      expect(pub.durationLabel).toBe('4 دقيقة');
      expect(pub.providerLabel).toBe('يوتيوب');
    });

    it('formatDuration يغطي الدقائق والساعات', () => {
      expect(formatDuration(180)).toBe('3 دقيقة');
      expect(formatDuration(3660)).toBe('1 س و 1 د');
      expect(formatDuration(0)).toBeNull();
      expect(formatDuration('x')).toBeNull();
    });
  });

  describe('فلترة الكتالوج بمصادر اختبارية (لا اختلاق في البنك الفعلي)', () => {
    const FIXTURE = [
      { id: 'm1', title: 'رياضيات', provider: 'youtube', videoId: 'a', gradeId: 'year1', subjectId: 'math' },
      { id: 'm2', title: 'رياضيات عام', provider: 'dailymotion', videoId: 'b', subjectId: 'math' },
      { id: 's1', title: 'إيقاظ', provider: 'vimeo', videoId: 'c', gradeId: 'year1', subjectId: 'science' },
      { id: 'g1', title: 'فيديو عام', provider: 'youtube', videoId: 'd' }
    ];

    it('يفلتر حسب السنة والمادة والوحدة مع إبقاء الفيديوهات العامة', () => {
      expect(listVideos({ gradeId: 'year1', subjectId: 'math' }, FIXTURE).map((v) => v.id)).toEqual(['m1', 'm2', 'g1']);
      expect(listVideos({ subjectId: 'math' }, FIXTURE).map((v) => v.id)).toEqual(['m1', 'm2', 'g1']);
      expect(listVideos({ subjectId: 'science' }, FIXTURE).map((v) => v.id)).toEqual(['s1', 'g1']);
      expect(listVideos({}, FIXTURE).length).toBe(4);
    });

    it('getVideo يعيد عنصراً واحداً أو null', () => {
      expect(getVideo('m1', FIXTURE)?.title).toBe('رياضيات');
      expect(getVideo('missing', FIXTURE)).toBeNull();
    });
  });

  describe('نقاط نهاية API', () => {
    it('قائمة الفيديوهات العمومية تُرجع 200 بقائمة فارغة حالياً (بنك بلا محتوى مختلق)', async () => {
      const res = await request(app).get('/api/public/videos').send();
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('فلترة قائمة الفيديوهات تعمل حتى مع كتالوج فارغ', async () => {
      const res = await request(app).get('/api/public/videos?gradeId=year1&subjectId=math').send();
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('فيديو غير موجود → 404', async () => {
      const res = await request(app).get('/api/public/videos/nonexistent').send();
      expect(res.status).toBe(404);
    });

    it('فيديوهات كتاب (س1 رياضيات) تُرجع قائمة فارغة بحالة 200', async () => {
      const res = await request(app).get('/api/public/curriculum/books/year1/math/videos').send();
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
