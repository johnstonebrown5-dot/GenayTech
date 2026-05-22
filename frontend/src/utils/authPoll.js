import { clearAuthStorage, isSessionExpired, isUnauthorizedError, markSessionExpired } from '../api'

/** Whether background polls (messages, alerts) should run. */
export function canRunAuthenticatedPoll(user, locked = false) {
  if (!user?.id || locked) return false
  if (isSessionExpired()) return false
  try {
    return Boolean(localStorage.getItem('access') || localStorage.getItem('refresh'))
  } catch {
    return false
  }
}

/** Stop polling and clear session when refresh token is dead. Returns true if handled. */
export function handlePollAuthError(err, onStop) {
  if (!isUnauthorizedError(err)) return false
  markSessionExpired()
  clearAuthStorage()
  try { onStop?.() } catch {}
  return true
}
