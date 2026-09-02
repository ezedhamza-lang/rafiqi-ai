import prisma from '../db.js';
import { logger } from '../utils/logger.js';

export async function audit({ actorId = null, actorRole = null, action, resource = null, resourceId = null, ip = null, userAgent = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action,
        resource,
        resourceId,
        ip: ip || null,
        userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
        metadata: metadata || null
      }
    });
  } catch (err) {
    logger.error({ err }, '[AuditLogError]');
  }
}

export function requestContext(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null
  };
}
