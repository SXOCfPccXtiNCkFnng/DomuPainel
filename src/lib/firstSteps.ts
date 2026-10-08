function tenantKey(tenantId: string, suffix: string) {
  return `domu_first_steps_${suffix}_${tenantId || 'local'}`;
}

export function isFirstStepsDismissed(tenantId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(tenantKey(tenantId, 'hidden')) === '1';
}

export function isFirstStepsForced(tenantId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(tenantKey(tenantId, 'force')) === '1';
}

export function dismissFirstSteps(tenantId: string) {
  localStorage.setItem(tenantKey(tenantId, 'hidden'), '1');
  localStorage.removeItem(tenantKey(tenantId, 'force'));
}

export function reopenFirstSteps(tenantId: string) {
  localStorage.removeItem(tenantKey(tenantId, 'hidden'));
  localStorage.setItem(tenantKey(tenantId, 'force'), '1');
}
