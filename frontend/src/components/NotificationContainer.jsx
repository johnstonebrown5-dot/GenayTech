import React from 'react'
import { useNotification } from './NotificationContext'
import { useNavigate } from 'react-router-dom'

const NotificationItem = ({ notification, onClose, onActivate }) => {
  const getNotificationStyles = (type) => {
    const baseStyles = "flex items-start gap-3 p-4 rounded-lg shadow-lg border-l-4 min-w-[320px] max-w-[400px] bg-white/90 backdrop-blur-sm"

    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-500 text-green-800`
      case 'error':
        return `${baseStyles} bg-red-50 border-red-500 text-red-800`
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-500 text-yellow-800`
      case 'info':
      default:
        return `${baseStyles} bg-blue-50 border-blue-500 text-blue-800`
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'info':
      default:
        return (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  const durationMs = notification.duration || 4000

  return (
    <div className={getNotificationStyles(notification.type)}>
      {getIcon(notification.type)}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div
          className={`flex-1 min-w-0 ${notification.route || notification.onClick ? 'cursor-pointer':''}`}
          onClick={()=>{ if(onActivate){ onActivate(notification) } }}
          role={notification.route || notification.onClick ? 'button' : undefined}
          tabIndex={notification.route || notification.onClick ? 0 : undefined}
        >
          {notification.title && (
            <div className="font-semibold text-sm mb-1">
              {notification.title}
            </div>
          )}
          {notification.message && (
            <div className="text-sm leading-relaxed">
              {notification.message}
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-1 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-current notification-progress-bar"
            style={{ animationDuration: `${durationMs}ms` }}
            onAnimationEnd={() => onClose(notification.id)}
          />
        </div>
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotification()
  const navigate = useNavigate()

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 inset-x-0 z-50 space-y-2 max-h-screen overflow-y-auto px-4 flex flex-col items-center sm:top-auto sm:bottom-4 sm:right-4 sm:inset-x-auto sm:items-end">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className="animate-slideIn"
          style={{
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'both'
          }}
        >
          <NotificationItem
            notification={notification}
            onClose={removeNotification}
            onActivate={(n)=>{
              try{
                if(typeof n.onClick === 'function'){
                  n.onClick()
                } else if(n.route){
                  navigate(n.route)
                }
              } finally {
                removeNotification(n.id)
              }
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideInFromTop 0.3s ease-out forwards;
        }
        @media (min-width: 640px) {
          .animate-slideIn {
            animation-name: slideInFromRight;
          }
        }

        @keyframes notificationProgress {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }
        .notification-progress-bar {
          width: 100%;
          animation-name: notificationProgress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  )
}
