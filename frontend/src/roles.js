export const ROLE_LABEL_KEYS = {
  STUDENT: 'roleLabels.STUDENT',
  PARENT: 'roleLabels.PARENT',
  TEACHER: 'roleLabels.TEACHER',
  SCHOOL_DIRECTOR: 'roleLabels.SCHOOL_DIRECTOR',
  ADMIN: 'roleLabels.ADMIN',
  SUPER_ADMIN: 'roleLabels.SUPER_ADMIN'
};

export function roleLabel(t, role) {
  return ROLE_LABEL_KEYS[role] ? t(ROLE_LABEL_KEYS[role]) : role;
}

export const ACCOUNT_STATUS_LABEL_KEYS = {
  PENDING_APPROVAL: 'accountStatusLabels.PENDING_APPROVAL',
  PENDING_PAYMENT: 'accountStatusLabels.PENDING_PAYMENT',
  ACTIVE: 'accountStatusLabels.ACTIVE',
  SUSPENDED: 'accountStatusLabels.SUSPENDED',
  EXPIRED: 'accountStatusLabels.EXPIRED'
};

export function accountStatusLabel(t, status) {
  return ACCOUNT_STATUS_LABEL_KEYS[status] ? t(ACCOUNT_STATUS_LABEL_KEYS[status]) : status;
}

export const REQUEST_STATUS_LABEL_KEYS = {
  PENDING_APPROVAL: 'requestStatusLabels.PENDING_APPROVAL',
  REJECTED: 'requestStatusLabels.REJECTED',
  CANCELLED: 'requestStatusLabels.CANCELLED',
  PENDING_PAYMENT: 'requestStatusLabels.PENDING_PAYMENT',
  ACTIVE: 'requestStatusLabels.ACTIVE',
  SUSPENDED: 'requestStatusLabels.SUSPENDED',
  EXPIRED: 'requestStatusLabels.EXPIRED'
};

export function requestStatusLabel(t, status) {
  return REQUEST_STATUS_LABEL_KEYS[status] ? t(REQUEST_STATUS_LABEL_KEYS[status]) : status;
}

export const HELP_STATUS_LABEL_KEYS = {
  PENDING: 'helpStatusLabels.PENDING',
  PROCESSING: 'helpStatusLabels.PROCESSING',
  VALIDATED: 'helpStatusLabels.VALIDATED',
  REJECTED: 'helpStatusLabels.REJECTED'
};

export function helpStatusLabel(t, status) {
  return HELP_STATUS_LABEL_KEYS[status] ? t(HELP_STATUS_LABEL_KEYS[status]) : status;
}

export function statusBadgeClass(status) {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'pending';
    case 'PENDING_PAYMENT':
      return 'processing';
    case 'ACTIVE':
      return 'approved';
    case 'SUSPENDED':
    case 'REJECTED':
      return 'rejected';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'warn';
    default:
      return 'pending';
  }
}

export const DOC_STATUS_LABEL_KEYS = {
  PENDING: 'docStatusLabels.PENDING',
  UNDER_REVIEW: 'docStatusLabels.UNDER_REVIEW',
  APPROVED: 'docStatusLabels.APPROVED',
  REJECTED: 'docStatusLabels.REJECTED'
};

export function docStatusLabel(t, status) {
  return DOC_STATUS_LABEL_KEYS[status] ? t(DOC_STATUS_LABEL_KEYS[status]) : status;
}

export function docStatusBadgeClass(status) {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'UNDER_REVIEW':
      return 'processing';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'pending';
  }
}

export const CALENDAR_TYPE_KEYS = ['HOLIDAY', 'EXAM', 'MEETING', 'ACTIVITY', 'OTHER'];

export const CALENDAR_TYPE_LABEL_KEYS = {
  HOLIDAY: 'calendarTypeLabels.HOLIDAY',
  EXAM: 'calendarTypeLabels.EXAM',
  MEETING: 'calendarTypeLabels.MEETING',
  ACTIVITY: 'calendarTypeLabels.ACTIVITY',
  OTHER: 'calendarTypeLabels.OTHER'
};

export function calendarTypeLabel(t, type) {
  return CALENDAR_TYPE_LABEL_KEYS[type] ? t(CALENDAR_TYPE_LABEL_KEYS[type]) : type;
}

export const CALENDAR_TYPE_ICONS = {
  HOLIDAY: 'beach_access',
  EXAM: 'fact_check',
  MEETING: 'groups',
  ACTIVITY: 'celebration',
  OTHER: 'event'
};

export const CALENDAR_AUDIENCE_KEYS = ['ALL', 'STUDENT', 'PARENT', 'TEACHER', 'DIRECTOR'];

export const CALENDAR_AUDIENCE_LABEL_KEYS = {
  ALL: 'calendarAudienceLabels.ALL',
  STUDENT: 'calendarAudienceLabels.STUDENT',
  PARENT: 'calendarAudienceLabels.PARENT',
  TEACHER: 'calendarAudienceLabels.TEACHER',
  DIRECTOR: 'calendarAudienceLabels.DIRECTOR'
};

export function calendarAudienceLabel(t, audience) {
  return CALENDAR_AUDIENCE_LABEL_KEYS[audience] ? t(CALENDAR_AUDIENCE_LABEL_KEYS[audience]) : audience;
}

export function canManage(user) {
  return user && ['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(user.role);
}

export function canApproveRequests(user) {
  return user && user.role === 'SCHOOL_DIRECTOR';
}

export function canManageFinance(user) {
  return user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
}

export function isSuperAdmin(user) {
  return user && user.role === 'SUPER_ADMIN';
}

export function isTeacher(user) {
  return user && user.role === 'TEACHER';
}

export function isStudent(user) {
  return user && user.role === 'STUDENT';
}

export function isParent(user) {
  return user && user.role === 'PARENT';
}

export function getHomePath(user) {
  if (!user) return '/';
  switch (user.role) {
    case 'TEACHER':
      return '/teacher';
    case 'STUDENT':
      return '/student-space';
    case 'PARENT':
      return '/parent';
    case 'SCHOOL_DIRECTOR':
    case 'ADMIN':
      return '/director';
    case 'SUPER_ADMIN':
      return '/superadmin';
    default:
      return '/dashboard';
  }
}
