import api from '../api'

const isAbsUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u)

const toApiRelative = (nextUrl) => {
  if (!nextUrl) return null
  if (!isAbsUrl(nextUrl)) return nextUrl
  try {
    const u = new URL(nextUrl)
    const path = (u.pathname || '') + (u.search || '')
    return path.startsWith('/api/') ? path.replace('/api/', '/') : path
  } catch {
    return null
  }
}

const listFrom = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

const fetchAllPages = async (url, { maxPages = 50 } = {}) => {
  let out = []
  let next = url
  let guard = 0
  while (next && guard < maxPages) {
    const res = await api.get(next)
    const data = res?.data
    if (Array.isArray(data)) return data
    out = out.concat(listFrom(data))
    next = toApiRelative(data?.next)
    guard += 1
  }
  return out
}

const computeUnread = (arr, myId) => {
  if (!Array.isArray(arr) || !myId) return 0
  return arr.reduce((acc, m) => {
    const rec = Array.isArray(m?.recipients) ? m.recipients : []
    const mine = rec.find(r => r?.user === myId)
    return acc + (mine && !mine.read ? 1 : 0)
  }, 0)
}

export const teacherQueries = {
  toApiRelative,
  listFrom,
  fetchAllPages,

  getMe: () => api.get('/auth/me/'),
  getSchoolInfo: () => api.get('/auth/school/info/'),

  getMyClasses: async () => {
    try {
      const r = await api.get('/academics/classes/mine/')
      const arr = listFrom(r?.data)
      if (arr.length) return arr
    } catch {}
    try {
      const r2 = await api.get('/academics/classes/')
      return listFrom(r2?.data)
    } catch {}
    return []
  },

  getClassStudents: async (classId) => {
    const cid = String(classId || '').trim()
    if (!cid) return []
    const urls = [
      `/academics/students/?klass=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?class=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?klass_id=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?class_id=${encodeURIComponent(cid)}&page_size=200`,
    ]
    for (const u of urls) {
      try {
        const arr = await fetchAllPages(u)
        if (arr.length) return arr
      } catch {}
    }
    return []
  },

  getUnreadMessageInfo: async (userId) => {
    const myId = Number(userId)
    const [inb, sys] = await Promise.allSettled([
      api.get('/communications/messages/'),
      api.get('/communications/messages/system/'),
    ])
    const inboxList = inb.status === 'fulfilled' ? listFrom(inb.value?.data) : []
    const sysList = sys.status === 'fulfilled' ? listFrom(sys.value?.data) : []
    const totalUnread = computeUnread(inboxList, myId) + computeUnread(sysList, myId)
    const broadcastOnly = Array.isArray(sysList) ? sysList.filter(m => m?.is_broadcast) : []
    const broadcastUnread = computeUnread(broadcastOnly, myId)
    const latestBroadcast = broadcastOnly.length ? broadcastOnly[0] : null
    return { totalUnread, broadcastUnread, latestBroadcast, inboxList, sysList }
  },

  getCurrentAcademicYear: async () => {
    try {
      const r = await api.get('/academics/academic_years/current/')
      if (r?.data) return r.data
    } catch {}
    try {
      const r = await api.get('/academics/academic_years/mine/')
      const arr = listFrom(r?.data)
      return arr[0] || null
    } catch {}
    return null
  },

  getCurrentTerm: async () => {
    try {
      const r = await api.get('/academics/terms/current/')
      if (r?.data) return r.data
    } catch {}
    try {
      const r = await api.get('/academics/terms/of-current-year/')
      const arr = listFrom(r?.data)
      return arr.find(x => x?.is_current) || arr.sort((a, b) => (a?.number || 0) - (b?.number || 0))[0] || null
    } catch {}
    return null
  },

  getExamSummary: (examId) => api.get(`/academics/exams/${examId}/summary/`),

  getUnpublishedExams: async () => {
    const list = await fetchAllPages('/academics/exams/?include_history=true&page_size=1000')
    const isUnpub = (e) => {
      if (typeof e?.published === 'boolean') return e.published === false
      if (typeof e?.is_published === 'boolean') return e.is_published === false
      const s = String(e?.status || '').toLowerCase()
      if (s) return s !== 'published' && s !== 'final' && s !== 'complete'
      if (e?.published_at) return false
      return true
    }
    return (list || []).filter(isUnpub)
  },
}

export default teacherQueries
