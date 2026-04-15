export function getAdminDetailSeedData<T>(remoteReady: boolean, fallbackData: T): T | null {
  return remoteReady ? null : fallbackData
}
