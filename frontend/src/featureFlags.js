// Central place to temporarily disable features by path.
// Match rules:
// - Exact path: '/teacher/lessons'
// - Prefix match: '/admin/fees*' (disables any path starting with '/admin/fees')

export const disabledPaths = [
  '/teacher/lessons',
]

// Optional custom messages per path. Use '*' for a global default.
export const disabledMessages = {
  '/teacher/lessons': 'This feature is currently unavailable. Please visit the Help Center for assistance.',
  '*': 'This feature is currently unavailable. Please check back later.'
}

// Global maintenance switch: when true, the app renders a blank page with an
// "unavailable" message and a link to the Help Center. This overrides all pages.
export const maintenanceEnabled = false
export const maintenanceMessage = 'This feature is currently unavailable. Please visit the Help Center for assistance.'
export const helpCenterPath = '/help'
