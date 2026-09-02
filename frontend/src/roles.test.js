import { describe, it, expect } from 'vitest';
import { canManageFinance, canApproveRequests, isParent, isStudent, isTeacher, getHomePath } from './roles.js';

describe('roles.js — صلاحيات الأدوار', () => {
  it('canManageFinance: للأدمن والسوبر أدمن فقط (المدير لا يدير المال)', () => {
    expect(canManageFinance({ role: 'ADMIN' })).toBe(true);
    expect(canManageFinance({ role: 'SUPER_ADMIN' })).toBe(true);
    expect(canManageFinance({ role: 'SCHOOL_DIRECTOR' })).toBe(false);
    expect(canManageFinance({ role: 'TEACHER' })).toBe(false);
    expect(canManageFinance({ role: 'STUDENT' })).toBe(false);
    expect(canManageFinance(null)).toBeFalsy();
  });

  it('canApproveRequests: مدير المدرسة حصراً', () => {
    expect(canApproveRequests({ role: 'SCHOOL_DIRECTOR' })).toBe(true);
    expect(canApproveRequests({ role: 'ADMIN' })).toBe(false);
    expect(canApproveRequests({ role: 'PARENT' })).toBe(false);
    expect(canApproveRequests({ role: 'TEACHER' })).toBe(false);
    expect(canApproveRequests(null)).toBeFalsy();
  });

  it('متحقات الأدوار', () => {
    expect(isParent({ role: 'PARENT' })).toBe(true);
    expect(isStudent({ role: 'STUDENT' })).toBe(true);
    expect(isTeacher({ role: 'TEACHER' })).toBe(true);
    expect(isStudent({ role: 'PARENT' })).toBe(false);
    expect(isParent(null)).toBeFalsy();
  });

  it('getHomePath: كل دور يذهب لفضائه', () => {
    expect(getHomePath({ role: 'TEACHER' })).toBe('/teacher');
    expect(getHomePath({ role: 'STUDENT' })).toBe('/student-space');
    expect(getHomePath({ role: 'PARENT' })).toBe('/parent');
    expect(getHomePath({ role: 'ADMIN' })).toBe('/director');
    expect(getHomePath({ role: 'SUPER_ADMIN' })).toBe('/superadmin');
    expect(getHomePath(null)).toBe('/');
  });
});