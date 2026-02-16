import api from '../api'

const _cache = new Map()

const _now = () => Date.now()

const _cacheGet = (key) => {
  const hit = _cache.get(key)
  if (!hit) return null
  if (hit.expiresAt && hit.expiresAt <= _now()) {
    _cache.delete(key)
    return null
  }
  return hit
}

const _setCache = (key, value, { ttlMs = 30000 } = {}) => {
  const expiresAt = ttlMs ? _now() + ttlMs : 0
  _cache.set(key, { value, expiresAt })
  return value
}

const cached = async (key, fetcher, { ttlMs = 30000 } = {}) => {
  const hit = _cacheGet(key)
  if (hit && hit.value !== undefined) return hit.value
  if (hit && hit.promise) return hit.promise

  const p = (async () => {
    try {
      const v = await fetcher()
      _setCache(key, v, { ttlMs })
      return v
    } finally {
      const cur = _cache.get(key)
      if (cur && cur.promise) _cache.set(key, { value: cur.value, expiresAt: cur.expiresAt })
    }
  })()

  _cache.set(key, { promise: p, value: hit?.value, expiresAt: hit?.expiresAt || 0 })
  return p
}

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

  cache: {
    get: (key) => _cacheGet(String(key || ''))?.value,
    set: (key, value, opts) => _setCache(String(key || ''), value, opts),
    clear: (key) => { if (key) _cache.delete(String(key)); else _cache.clear() },
  },

  getMe: () => cached('me', () => api.get('/auth/me/'), { ttlMs: 60 * 1000 }),
  getSchoolInfo: () => cached('school_info', () => api.get('/auth/school/info/'), { ttlMs: 10 * 60 * 1000 }),

  getMyClasses: async () => cached('my_classes', async () => {
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
  }, { ttlMs: 5 * 60 * 1000 }),

  getClassStudents: async (classId) => {
    const cid = String(classId || '').trim()
    if (!cid) return []
    const key = `class_students:${cid}`
    const urls = [
      `/academics/students/?klass=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?class=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?klass_id=${encodeURIComponent(cid)}&page_size=200`,
      `/academics/students/?class_id=${encodeURIComponent(cid)}&page_size=200`,
    ]
    return cached(key, async () => {
      for (const u of urls) {
        try {
          const arr = await fetchAllPages(u)
          if (arr.length) return arr
        } catch {}
      }
      return []
    }, { ttlMs: 2 * 60 * 1000 })
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

  getCurrentAcademicYear: async () => cached('current_year', async () => {
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
  }, { ttlMs: 5 * 60 * 1000 }),

  getCurrentTerm: async () => cached('current_term', async () => {
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
  }, { ttlMs: 5 * 60 * 1000 }),

  getExamSummary: (examId) => {
    const id = String(examId || '').trim()
    if (!id) return Promise.reject(new Error('Missing exam id'))
    return cached(`exam_summary:${id}`, () => api.get(`/academics/exams/${id}/summary/`), { ttlMs: 60 * 1000 })
  },

  getUnpublishedExams: async () => cached('unpublished_exams', async () => {
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
  }, { ttlMs: 60 * 1000 }),

  prefetchTeacherBootstrap: async (userId) => {
    const uid = userId == null ? '' : String(userId)
    const tasks = [
      teacherQueries.getMe().catch(()=>null),
      teacherQueries.getSchoolInfo().catch(()=>null),
      teacherQueries.getMyClasses().catch(()=>[]),
      teacherQueries.getCurrentAcademicYear().catch(()=>null),
      teacherQueries.getCurrentTerm().catch(()=>null),
      teacherQueries.getUnpublishedExams().catch(()=>[]),
    ]
    if (uid) tasks.push(cached(`unread_info:${uid}`, () => teacherQueries.getUnreadMessageInfo(uid), { ttlMs: 10 * 1000 }).catch(()=>null))
    await Promise.allSettled(tasks)
    return true
  },
}

export default teacherQueries
