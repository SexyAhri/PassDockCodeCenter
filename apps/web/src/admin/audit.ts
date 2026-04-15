export function getAuditTimestamp() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function createAdminAuditLog(
  module: string,
  action: string,
  targetId: string,
  operator: string,
) {
  return {
    key: `audit_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    operator,
    module,
    action,
    targetId,
    createdAt: getAuditTimestamp(),
  }
}
