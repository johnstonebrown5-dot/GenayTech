import React, { createContext, useContext, useState, useCallback } from 'react'

export const NotificationContext = createContext()

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random()
    const newNotification = {
      id,
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      // Force a consistent 5s auto-dismiss
      duration: 5000,
      timestamp: new Date(),
      ...notification
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-remove notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    // Mirror to desktop notification when allowed
    try {
      const allowBrowser = notification.browser !== false
      if (allowBrowser && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = newNotification.title || 'Notification'
        const options = {
          body: newNotification.message || '',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          data: { url: newNotification.route || '/' },
          tag: `edu-track-${newNotification.type}`,
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg && reg.showNotification) {
              reg.showNotification(title, options)
            } else {
              // Fallback to direct Notification
              // eslint-disable-next-line no-new
              new Notification(title, options)
            }
          }).catch(() => {
            // eslint-disable-next-line no-new
            new Notification(title, options)
          })
        } else {
          // eslint-disable-next-line no-new
          new Notification(title, options)
        }
      }
    } catch {}

    return id
  }, [])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Convenience methods for different notification types
  const showSuccess = useCallback((title, message, duration) => {
    return addNotification({ type: 'success', title, message, duration })
  }, [addNotification])

  const showError = useCallback((title, message, duration) => {
    return addNotification({ type: 'error', title, message, duration })
  }, [addNotification])

  const showWarning = useCallback((title, message, duration) => {
    return addNotification({ type: 'warning', title, message, duration })
  }, [addNotification])

  const showInfo = useCallback((title, message, duration) => {
    return addNotification({ type: 'info', title, message, duration })
  }, [addNotification])

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
