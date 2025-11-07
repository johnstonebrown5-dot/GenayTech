import React from 'react'
import { useAuth } from '../auth'
import { useLock, LockScreen } from '../components/LockProvider'

export default function LockPage(){
  const { user, logout } = useAuth()
  const { unlock } = useLock()
  // Render a centered lock screen on its own route
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <LockScreen onUnlock={unlock} onLogout={logout} user={user} lastActiveAt={new Date()} />
    </div>
  )
}
