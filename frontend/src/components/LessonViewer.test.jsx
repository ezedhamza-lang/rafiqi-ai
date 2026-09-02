import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// عزل الشبكة: افتراضياً لا تقدم ولا دروس؛ كل اختبار يحدد درسه
vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(), post: vi.fn(() => Promise.resolve({})) }
}));

import { api } from '../api/client.js';
import LessonViewer from './LessonViewer.jsx';

function mockLessons(lesson) {
  api.get.mockImplementation((url) => {
    if (url.includes('/lessons')) return Promise.resolve([lesson]);
    if (url.includes('/progress')) return Promise.resolve({ lessons: [] });
    return Promise.resolve([]);
  });
}

const mount = () =>
  render(
    <MemoryRouter>
      <LessonViewer book={{ gradeId: 'year1', subjectId: 'math' }} onClose={() => {}} />
    </MemoryRouter>
  );

describe('LessonViewer — أنواع الأسئلة التفاعلية', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MCQ: الاختيار الصحيح يظهر ✓', async () => {
    mockLessons({
      id: 'test-1',
      title: 'درس تجريبي',
      blocks: [
        { kind: 'question', type: 'mcq', title: 'كم 2+2؟', options: ['3', '4', '5'], answer: 1 }
      ]
    });
    mount();
    await waitFor(() => expect(screen.getByText('كم 2+2؟')).toBeInTheDocument());
    fireEvent.click(screen.getByText('4'));
    fireEvent.click(screen.getByText('تحقّق'));
    expect(screen.getByText(/✓ صحيح/)).toBeInTheDocument();
  });

  it('imgchoice: خيارات بالإيموجي تُعرض وتُصحَّح', async () => {
    mockLessons({
      id: 'test-2',
      title: 'حرف الميم',
      blocks: [
        {
          kind: 'question',
          type: 'imgchoice',
          title: 'اختر الصورة المناسبة.',
          options: [
            { caption: 'كرة', emoji: '⚽' },
            { caption: 'مِقَصٌّ', emoji: '✂️' }
          ],
          answer: 1
        }
      ]
    });
    mount();
    await waitFor(() => expect(screen.getByText('⚽')).toBeInTheDocument());
    fireEvent.click(screen.getByText('✂️'));
    fireEvent.click(screen.getByText('تحقّق'));
    expect(screen.getByText(/✓ صحيح/)).toBeInTheDocument();
  });

  it('order: الترتيب الصحيح يقبل', async () => {
    mockLessons({
      id: 'test-3',
      title: 'ترتيب',
      blocks: [
        { kind: 'question', type: 'order', title: 'أُرَتِّبُ الكَلِمَاتِ.', items: ['ب', 'أ'], answer: [1, 0] }
      ]
    });
    mount();
    await waitFor(() => expect(screen.getByText('أ')).toBeInTheDocument());
    fireEvent.click(screen.getByText('أ'));
    fireEvent.click(screen.getByText('ب'));
    fireEvent.click(screen.getByText('تحقّق'));
    expect(screen.getByText(/✓ صحيح/)).toBeInTheDocument();
  });

  it('النص لا يتكرر عندما يساوي العنوان (إصلاح ازدواج القراءة)', async () => {
    mockLessons({
      id: 'test-4',
      title: 'قراءة',
      blocks: [
        { kind: 'question', type: 'mcq', title: 'سؤال واحد فقط', text: 'سؤال واحد فقط', options: ['أ', 'ب'], answer: 0 }
      ]
    });
    mount();
    await waitFor(() => expect(screen.getAllByText('سؤال واحد فقط').length).toBeGreaterThan(0));
    expect(screen.getAllByText('سؤال واحد فقط').length).toBe(1);
  });
});