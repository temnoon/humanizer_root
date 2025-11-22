export interface TierLimits {
  sessions: number;
  buffersPerSession: number;
}

export const SESSION_LIMITS: Record<string, TierLimits> = {
  free: { sessions: 10, buffersPerSession: 10 },
  pro: { sessions: 100, buffersPerSession: 100 },
  premium: { sessions: 1000, buffersPerSession: 1000 },
  admin: { sessions: 1000, buffersPerSession: 1000 }
};

export function getSessionLimit(tier: string): TierLimits {
  return SESSION_LIMITS[tier] || SESSION_LIMITS.free;
}
