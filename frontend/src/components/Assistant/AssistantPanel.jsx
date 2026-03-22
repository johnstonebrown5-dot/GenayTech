import React from 'react'
import { useAssistant } from './AssistantContext'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import { parseIntent, bestFuzzy } from './intentParser'
import { useAuth } from '../../auth'
import helpContent from '../../content/helpContent.json'
import { useNotification } from '../NotificationContext'
import { X, Trash2, Loader2, Sparkles, ArrowDown } from 'lucide-react'

export default function AssistantPanel(){
  const { open, closePanel, memory, setMemory, pushIntent } = useAssistant()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [input, setInput] = React.useState('')
  const storageKey = React.useMemo(() => {
    const id = user?.id || user?.username || user?.email || 'anon'
    return `assistant_messages_v1:${id}`
  }, [user])
  const [messages, setMessages] = React.useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch {}
    const name = user?.first_name || user?.username || 'there'
    return [
      { role: 'assistant', text: `Hello ${name}! I can help you open pages and perform actions. Try: "open exams", "publish exam 42", "delete student 123", or "search students amina".` }
    ]
  })
  const [busy, setBusy] = React.useState(false)
  const [flow, setFlow] = React.useState(null)
  const [flowData, setFlowData] = React.useState({})
  const listRef = React.useRef(null)
  const [stickToBottom, setStickToBottom] = React.useState(true)

  const fmtTime = React.useCallback((d) => {
    try {
      const dt = d ? new Date(d) : new Date()
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [])

  // Persist messages
  React.useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(storageKey, JSON.stringify((messages || []).slice(-30)))
    } catch {}
  }, [messages, storageKey])

  // ESC closes
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closePanel])

  // Known routes and aliases across the app (tabs, page names, common words)
  const ROUTES = React.useMemo(() => {
    const role = (user?.role || '').toLowerCase()
    const base = [
      // Admin
      ['admin dashboard', '/admin'],
      ['students', '/admin/students'],
      ['teachers', '/admin/teachers'],
      ['classes', '/admin/classes'],
      ['exams', '/admin/exams'],
      ['results', '/admin/results'],
      ['fees', '/admin/fees'],
      ['subjects', '/admin/subjects'],
      ['reports', '/admin/reports'],
      ['events', '/admin/events'],
      ['timetable', '/admin/timetable'],
      ['admin messages', '/admin/messages'],
      ['calendar', '/admin/calendar'],
      ['school', '/admin/school'],
      ['users', '/admin/users'],
      ['curriculum', '/admin/curriculum'],
      ['cbc', '/admin/curriculum'],
      // Teacher
      ['teacher dashboard', '/teacher'],
      ['teacher classes', '/teacher/classes'],
      ['attendance', '/teacher/attendance'],
      ['lessons', '/teacher/lessons'],
      ['grades', '/teacher/grades'],
      ['teacher results', '/teacher/results'],
      ['analytics', '/teacher/analytics'],
      ['teacher profile', '/teacher/profile'],
      ['teacher timetable', '/teacher/timetable'],
      ['block timetable', '/teacher/block-timetable'],
      ['teacher events', '/teacher/events'],
      ['teacher messages', '/teacher/messages'],
      // Student
      ['student dashboard', '/student'],
      ['report card', '/student/report-card'],
      ['student messages', '/student/messages'],
      // Finance
      ['finance', '/finance'],
      ['expenses', '/finance/expenses'],
      ['invoices', '/finance/invoices'],
      ['payments', '/finance/payments'],
      ['finance reports', '/finance/reports'],
      ['settings', '/finance/settings'],
      ['pocket money', '/finance/pocket-money'],
      ['fee categories', '/finance/fee-categories'],
      ['class fees', '/finance/class-fees'],
      ['finance messages', '/finance/messages'],
      ['help', '/help'],
    ]
    // Generic keys based on active role
    if (role === 'teacher') base.push(['dashboard', '/teacher'], ['messages', '/teacher/messages'])
    else if (role === 'student') base.push(['dashboard', '/student'], ['messages', '/student/messages'])
    else if (role === 'finance') base.push(['dashboard', '/finance'], ['messages', '/finance/messages'])
    else base.push(['dashboard', '/admin'], ['messages', '/admin/messages'])
    return base
  }, [user])

  // Phrase templates to reduce monotony
  const pick = React.useCallback((arr) => arr[Math.floor(Math.random()*arr.length)], [])
  const phrases = React.useMemo(() => ({
    greet: [
      (n) => `Hello${n? ' ' + n : ''}! How can I help you today?`,
      (n) => `Hi${n? ' ' + n : ''}! What would you like to do?`,
      (n) => `Hey${n? ' ' + n : ''}! Ready when you are.`,
    ],
    opening: [
      (x) => `Opening ${x}...`,
      (x) => `Taking you to ${x}...`,
      (x) => `Navigating to ${x}...`,
    ],
    back: [
      () => 'Going back...',
      () => 'Back we go...',
      () => 'Returning to the previous page...'
    ],
    denied: [
      () => 'You do not have permission to open that page with your role.',
      () => "That page isn't available for your role.",
      () => 'Access denied for your role.'
    ],
    cancelled: [
      () => 'Cancelled.',
      () => 'Okay, not doing that.',
      () => 'Alright, I have cancelled it.'
    ],
    createExamIntro: [
      () => 'Creating an exam. Fill the form below and submit.',
      () => 'Let’s set up a new exam. Provide the details and submit.',
      () => 'Starting exam creation. Add details then click Create.'
    ],
    addStudentIntro: [
      () => 'Adding a student. Please provide Name, Admission Number, Date of Birth (YYYY-MM-DD), Gender, and optional Class.',
      () => 'Let’s add a new student. Enter name, admission no., DOB, gender, and optionally class.',
      () => 'New student entry: include name, admission no., DOB, gender, and class (optional).'
    ],
    unknown: [
      () => 'Sorry, I did not understand. Try: open exams, publish exam 42, delete exam 42, search students amina',
      () => 'I didn’t catch that. Examples: open teachers, search students amina, publish exam 42',
      () => 'Hmm, not sure what you meant. You can say: open classes, search exams 2025, delete student 123'
    ],
    noResults: [
      () => 'No results found.',
      () => 'I couldn’t find anything matching that.',
      () => 'Nothing turned up for that search.'
    ],
    topResults: [
      () => 'Top results:',
      () => 'Here are the top matches:',
      () => 'I found these:'
    ]
  }), [])
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

  // Check if the current user can access a given route path
  const canAccessPath = React.useCallback((path) => {
    // If user info isn't ready, optimistically allow and let route guards enforce
    if (!user || (!user.role && !user.is_superuser && !user.is_staff)) return true
    const role = (user?.role || '').toLowerCase()
    const isAdmin = user?.is_superuser || user?.is_staff || role === 'admin'
    // Help Center is allowed for all authenticated roles
    if (path === '/help') return true
    if (isAdmin) return true
    if (role === 'teacher'){
      if (path.startsWith('/teacher')) return true
      // Allow the class timetable page which is shared with teachers
      if (path === '/admin/timetable/class') return true
      return false
    }
    if (role === 'student'){
      return path.startsWith('/student')
    }
    if (role === 'finance'){
      return path.startsWith('/finance')
    }
    return false
  }, [user])

  const append = React.useCallback((role, text, suggestions=null) => {
    setMessages(m => [...m, { role, text, suggestions: Array.isArray(suggestions) ? suggestions : null, at: Date.now() }])
  }, [])

  const requestConfirm = React.useCallback((pendingConfirm, prompt) => {
    setMemory(prev => ({ ...prev, pendingConfirm }))
    append('assistant', prompt, [
      { type: 'confirm_yes', label: 'Confirm' },
      { type: 'confirm_no', label: 'Cancel' },
    ])
  }, [append, setMemory])

  const handleSubmit = React.useCallback(async () => {
    const q = input.trim()
    if (!q || busy) return
    append('user', q)
    setInput('')
    setBusy(true)
    try{
      const intent = parseIntent(q)
      pushIntent({ type: intent.type, raw: q })
      await executeIntent(intent, q)
    }catch(e){
      append('assistant', `Error: ${e?.response?.data?.detail || e?.message || 'Something went wrong'}`)
    }finally{
      setBusy(false)
    }
  }, [input, busy, append])

  const executeIntent = React.useCallback(async (intent, rawText) => {
    // If in a flow, interpret text as answers to the flow when possible
    if (flow === 'help_steps'){
      const t = (rawText||'').toLowerCase()
      if (/\b(next|forward|continue)\b/.test(t)) { setFlowData(d=>({ ...d, index: Math.min((d.index||0)+1, (d.steps?.length||1)-1) })); showHelpStep(); return }
      if (/\b(back|previous|prev)\b/.test(t)) { setFlowData(d=>({ ...d, index: Math.max((d.index||0)-1, 0) })); showHelpStep(true); return }
      if (/\b(done|finish|close|stop)\b/.test(t)) { append('assistant', 'Guide finished.'); setFlow(null); setFlowData({}); return }
      if (/\bopen\b/.test(t) && flowData?.deepLink) { navigate(flowData.deepLink); append('assistant', pick(phrases.opening)('page')); return }
      // fallthrough to normal handling otherwise
    }
    if (flow === 'create_exam'){
      // try to auto-fill fields from natural text like: "Mid Term for Grade 7 East on 2025-10-20, total 100"
      const name = (rawText.match(/^(.*?)(?:\s+for\s+|,| on |$)/i) || [])[1]
      const className = (rawText.match(/for\s+(.+?)(?:\s+on\s+|,|$)/i) || [])[1]
      const date = (rawText.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]
      const total = (rawText.match(/(?:total|out of)\s+(\d{1,4})/i) || [])[1]
      setFlowData(d => ({
        ...d,
        name: d.name || (name || '').trim(),
        className: d.className || (className || '').trim(),
        date: d.date || date || '',
        total_marks: d.total_marks || total || '',
      }))
      // If user says "submit" or "create" inside the flow
      if (/\b(create|submit|done|save)\b/i.test(rawText)){
        await submitCreateExam()
      }
      return
    }
    if (flow === 'add_student'){
      const name = (rawText.match(/^([a-zA-Z .'-]{3,})/) || [])[1]
      const className = (rawText.match(/class\s+(.+?)(?:\s|$)/i) || [])[1]
      const adm = (rawText.match(/(?:adm(?:ission)?(?:\s*no\.?| number)?\s*)([A-Za-z0-9\/-]+)\b/i) || [])[1]
      const dob = (rawText.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]
      const genderToken = (rawText.match(/\b(male|female|boy|girl|m|f)\b/i) || [])[1]
      const gender = genderToken ? (/^m(ale)?$/i.test(genderToken) || /boy/i.test(genderToken) ? 'male' : 'female') : undefined
      setFlowData(d => ({
        ...d,
        name: d.name || (name || '').trim(),
        className: d.className || (className || '').trim(),
        admission_no: d.admission_no || (adm || '').trim(),
        dob: d.dob || (dob || ''),
        gender: d.gender || (gender || ''),
      }))
      if (/\b(add|create|submit|done|save)\b/i.test(rawText)){
        await submitAddStudent()
      }
      return
    }
    switch(intent.type){
      case 'greet':
        {
          const name = user?.first_name || user?.username || ''
          append('assistant', pick(phrases.greet)(name))
        }
        return
      case 'back':
        navigate(-1)
        append('assistant', pick(phrases.back)())
        return
      case 'help':
        return handleHelp(rawText)
      case 'open':
        setMemory(prev => ({ ...prev, lastRoute: intent.target }))
        return handleOpen(intent.target)
      case 'publish_exam':
        return handlePublishExam(intent)
      case 'delete':
        return handleDelete(intent)
      case 'search':
        setMemory(prev => ({ ...prev, lastSearch: { scope: intent.scope, q: intent.q } }))
        return handleSearch(intent)
      case 'send_arrears':
        return handleSendArrears(intent)
      case 'create_exam':
        setFlowData({ name: intent?.name || '', className: intent?.klass || '', date: intent?.date || '', total_marks: '' })
        startCreateExam()
        return
      case 'add_student':
        setFlowData({ name: '', className: '' })
        startAddStudent()
        return
      case 'unknown':
      default:
        if (await handlePronounFallback(rawText)) return
        // If it's a single keyword like "settings" or "reports", try opening directly
        const single = rawText.trim()
        if (single && !(single.includes(' ') && !/\w+\s+\w+/.test(single))){
          const opened = await handleOpen(single)
          if (opened) return
        }
        append('assistant', 'Sorry, I did not understand. Try: open exams, publish exam 42, delete exam 42, search students amina')
        return
    }
  }, [append, navigate])

  const showHelpStep = React.useCallback((back=false) => {
    setTimeout(() => {
      setFlowData(d => {
        const idx = Math.max(0, Math.min(d.index||0, (d.steps?.length||1)-1))
        const total = d.steps?.length || 0
        const body = `${d.title ? d.title + '\n' : ''}${total ? `Step ${idx+1} of ${total}` : ''}${total ? '\n' : ''}${d.steps?.[idx] || ''}`
        const suggestions = [
          idx > 0 ? { type: 'help_back', label: 'Back' } : null,
          idx < total-1 ? { type: 'help_next', label: 'Next' } : { type: 'help_done', label: 'Done' },
          d.deepLink ? { type: 'open_link', label: 'Open Page', href: d.deepLink } : null,
          { type: 'open', value: 'help', label: 'Help Center' },
        ].filter(Boolean)
        append('assistant', body, suggestions)
        return d
      })
    }, 0)
  }, [append])

  const handleHelp = React.useCallback((rawText) => {
    const r = (user?.role || 'admin').toLowerCase()
    const pretty = (x) => {
      if (!x) return x
      const m = { admin: 'Admin', teacher: 'Teacher', student: 'Student', finance: 'Finance' }
      return m[x] || (x.charAt(0).toUpperCase() + x.slice(1))
    }
    const roleKey = pretty(r)
    const items = Array.isArray(helpContent?.[roleKey]) ? helpContent[roleKey] : []
    const t = (rawText || '').toLowerCase().trim()
    let q = t
    const stop = ['help', 'how to', 'guide', 'show', 'about']
    for (const s of stop){
      if (q.startsWith(s + ' ')) { q = q.slice(s.length).trim(); break }
      if (q === s) { q = '' }
    }
    if (q) {
      const norm = (s)=> String(s||'').toLowerCase()
      const sim = (a,b)=>{
        a = norm(a); b = norm(b); if(!a||!b) return 0
        const m = Array.from(new Set(a.split(/\s+/))).filter(Boolean)
        const n = Array.from(new Set(b.split(/\s+/))).filter(Boolean)
        const inter = m.filter(t => n.includes(t)).length
        const jacc = inter / Math.max(1, new Set([...m, ...n]).size)
        const substr = b.includes(a) ? 0.2 : 0
        return Math.min(1, jacc + substr)
      }
      const scored = items.map(it => {
        const hay = [it.title, it.description, Array.isArray(it.tags)? it.tags.join(' '): ''].join(' ')
        return { it, score: sim(q, hay) }
      }).sort((a,b)=> b.score - a.score)
      const best = scored[0]
      if (best && best.score > 0) {
        const it = best.it
        const steps = Array.isArray(it.steps) ? it.steps : []
        const body = [
          it.title,
          it.description || '',
          steps.length ? ('\n' + steps.map((s,i)=> `${i+1}. ${s}`).join('\n')) : ''
        ].filter(Boolean).join('\n')
        const suggestions = [
          it.deepLink ? { type: 'open_link', label: 'Open Page', href: it.deepLink } : null,
          { type: 'open', value: 'help', label: 'Help Center' },
        ].filter(Boolean)
        append('assistant', body, suggestions)
        return
      }
    }
    // Try to suggest a relevant page/tab and base response on it
    const PAGE_HINTS = {
      'attendance': 'Mark daily presence/absence for your assigned classes. You can set All Present/All Absent quickly then adjust per student.',
      'grades': 'Enter assessment marks for your classes and subjects. Save frequently and review before publishing.',
      'results': 'Review computed results, print or share report cards once finalized.',
      'messages': 'View system and school communications. Check the System tab for announcements.',
      'exams': 'Create exams, enter results and publish when ready.',
      'fees': 'Configure school fees, categories and class-specific amounts.',
      'payments': 'Record student payments and issue receipts.',
      'report card': 'View or download your current term performance.',
      'timetable': 'See or manage weekly lesson schedules.',
      'students': 'Manage student profiles, invoices and payments.',
      'teachers': 'Manage teacher profiles and assignments.',
      'classes': 'Manage class profiles, enrollment and related actions.'
    }
    const allKeys = ROUTES.map(([k]) => k)
    const norm = (s)=> String(s||'').toLowerCase()
    const bestKey = (() => {
      const term = norm(q)
      // direct includes first
      const direct = ROUTES
        .filter(([k]) => term.includes(k) || k.includes(term))
        .sort((a,b)=> b[0].length - a[0].length)[0]?.[0]
      if (direct) return direct
      // fallback fuzzy via bestFuzzy helper
      try { return bestFuzzy(term, allKeys, 0.55) } catch { return null }
    })()
    if (bestKey){
      const path = ROUTES.find(([k]) => k === bestKey)?.[1]
      const hintKey = Object.keys(PAGE_HINTS).find(h => bestKey.includes(h))
      const hint = hintKey ? PAGE_HINTS[hintKey] : `Open the ${bestKey} page to continue.`
      const actions = [{ type: 'open', value: 'help', label: 'Help Center' }]
      if (path && canAccessPath(path)) actions.unshift({ type: 'open', value: bestKey, label: `Open ${bestKey}` })
      append('assistant', hint, actions)
      return
    }
    append('assistant', 'I can guide you through procedures. Opening the Help Center may also help.', [
      { type: 'text', value: q || 'help', label: 'Ask this', autoSend: !!q },
      { type: 'open', value: 'help', label: 'Open Help Center' },
    ])
  }, [append, user, setFlow, setFlowData, showHelpStep])

  const handleOpen = React.useCallback(async (targetRaw) => {
    const target = (targetRaw || '').toLowerCase().trim()
    if (!target) { append('assistant', 'Tell me which page to open, e.g., "open exams" or "open students"'); return false }
    const keys = ROUTES.map(r => r[0])

    // 1) Prefer the longest key whose text is contained in the target or vice-versa
    const includeMatches = ROUTES
      .filter(([k]) => target.includes(k) || k.includes(target))
      .sort((a,b)=> b[0].length - a[0].length)

    // 2) If none, fuzzy match using first token and full phrase
    let found = includeMatches[0]
    if (!found){
      const token = (target.split(/\s+/)[0] || '')
      const key = bestFuzzy(target, keys, 0.6) || bestFuzzy(token, keys, 0.6)
      found = key ? ROUTES.find(([k]) => k === key) : null
    }

    // 3) If multiple candidates, boost those relevant to the current role path
    const role = (user?.role || '').toLowerCase()
    const boost = (path) => (role && path.startsWith('/' + role)) ? 0.5 : 0
    if (includeMatches.length > 1){
      found = includeMatches
        .map(([k,p]) => ({ k, p, score: k.length/100 + boost(p) }))
        .sort((a,b)=> b.score - a.score)[0]
      if (found) found = [found.k, found.p]
    }

    if (found){
      if (!canAccessPath(found[1])){
        append('assistant', pick(phrases.denied)())
        return false
      }
      navigate(found[1])
      append('assistant', pick(phrases.opening)(found[0]))
      return true
    }

    // 4) Suggestions with ranking: length, includes, fuzzy, role-boost
    const token = (target.split(/\s+/)[0] || '')
    const ranked = ROUTES.map(([k,p]) => {
      let score = 0
      if (k.includes(target)) score += 1.0
      if (target.includes(k)) score += 0.9
      if (k.includes(token)) score += 0.4
      const fuzzyFull = bestFuzzy(target, [k], 0) ? 0.5 : 0
      const fuzzyToken = bestFuzzy(token, [k], 0) ? 0.3 : 0
      score += Math.max(fuzzyFull, fuzzyToken)
      score += boost(p)
      score += Math.min(k.length, 30) / 300
      const allowed = canAccessPath(p)
      return { k, score, allowed }
    }).sort((a,b)=> b.score - a.score)
    const suggestions = ranked.filter(r => r.allowed && r.score >= 0.6).slice(0,5).map(r=>r.k)
    if (suggestions.length){
      append('assistant', `I couldn't find an exact match. Did you mean:`, suggestions.map(k => ({ type: 'open', value: k, label: cap(k) })))
    } else {
      append('assistant', 'Tell me which page to open, e.g., "open exams" or "open students"')
    }
    return false
  }, [append, navigate, ROUTES, user])

  const onSuggestionClick = React.useCallback(async (s) => {
    if (!s) return
    if (s.type === 'confirm_yes'){
      const pc = memory?.pendingConfirm
      if (!pc){ append('assistant', 'Nothing to confirm.'); return }
      setMemory(prev => ({ ...prev, pendingConfirm: null }))
      if (pc.action === 'publish') { await handlePublishExam(pc.payload || {}); return }
      if (pc.action === 'delete') { await handleDelete(pc.payload || {}); return }
      append('assistant', 'Unsupported confirmation action.')
      return
    }
    if (s.type === 'confirm_no'){
      setMemory(prev => ({ ...prev, pendingConfirm: null }))
      append('assistant', pick(phrases.cancelled)())
      return
    }
    if (s.type === 'open') { await handleOpen(s.value); return }
    if (s.type === 'open_link' && s.href) { navigate(s.href); append('assistant', pick(phrases.opening)('page')); return }
    if (s.type === 'intent') { await executeIntent(s.value, s.value?.raw || ''); return }
    if (s.type === 'text') { setInput(s.text || s.value || ''); if (s.autoSend) setTimeout(()=>{ handleSubmit() },0) }
    if (s.type === 'help_next') { setFlowData(d => ({ ...d, index: Math.min((d.index||0)+1, (d.steps?.length||1)-1) })); showHelpStep(); return }
    if (s.type === 'help_back') { setFlowData(d => ({ ...d, index: Math.max((d.index||0)-1, 0) })); showHelpStep(true); return }
    if (s.type === 'help_done') { append('assistant', 'Great! If you need anything else, just ask.'); setFlow(null); setFlowData({}); return }
  }, [handleOpen, executeIntent, handleSubmit])

  const handlePublishExam = React.useCallback(async ({ id, name, klass }) => {
    try{
      let examId = id
      if (!examId && name){
        // try resolve by name and class via backend helper
        const params = new URLSearchParams({ name })
        const { data } = await api.get(`/academics/exams/by-name?${params.toString()}`)
        let item = null
        if (Array.isArray(data?.items)){
          item = data.items.find(it => !klass || (it?.klass?.name || '').toLowerCase().includes(String(klass).toLowerCase())) || data.items[0]
        }
        examId = item?.id
      }
      if (!examId){
        append('assistant', 'I could not resolve the exam. Please specify an ID like "publish exam 42" or provide an exact name and class.')
        return
      }
      await api.post(`/academics/exams/${examId}/publish/`)
      append('assistant', `Exam ${examId} published.`)
      setMemory(prev => ({ ...prev, lastExamId: examId, lastResource: { type: 'exam', id: examId } }))
      navigate('/admin/exams')
    }catch(e){
      throw e
    }
  }, [append, navigate, setMemory])

  const resourceToPath = React.useCallback((resource) => {
    switch(resource){
      case 'student': return 'students'
      case 'exam': return 'exams'
      case 'teacher': return 'teachers'
      case 'class': return 'classes'
      case 'result': return 'exam_results'
      default: return null
    }
  }, [])

  const handleDelete = React.useCallback(async ({ resource, id }) => {
    const path = resourceToPath(resource)
    if (!path){ append('assistant', 'Unsupported resource to delete.'); return }
    try{
      await api.delete(`/academics/${path}/${id}/`)
      append('assistant', `${resource} ${id} deleted.`)
      setMemory(prev => ({ ...prev, lastResource: { type: resource, id } }))
    }catch(e){
      throw e
    }
  }, [append, resourceToPath, setMemory])

  const handlePronounFallback = React.useCallback(async (raw) => {
    const t = (raw || '').toLowerCase()
    // publish it / delete it referring to lastResource
    if (/\bpublish\b/.test(t) && /\bit\b/.test(t)){
      const last = memory?.lastExamId || (memory?.lastResource?.type === 'exam' ? memory.lastResource.id : null)
      if (last){
        requestConfirm({ action: 'publish', payload: { id: last } }, `Publish exam ${last}? This will make results visible.`)
        return true
      }
      append('assistant', 'I do not know which exam to publish. Try: "publish exam 42"')
      return true
    }
    if (/\bdelete\b/.test(t) && /\bit\b/.test(t)){
      const last = memory?.lastResource
      if (last){
        requestConfirm({ action: 'delete', payload: { resource: last.type, id: last.id } }, `Delete ${last.type} ${last.id}? This cannot be undone.`)
        return true
      }
      append('assistant', 'I do not know what to delete. Try: "delete exam 42"')
      return true
    }
    return false
  }, [memory, requestConfirm, append])

  const fetchAll = React.useCallback(async (endpoint) => {
    const { data } = await api.get(endpoint)
    return Array.isArray(data) ? data : (data?.results || data?.items || [])
  }, [])

  const resolveClassIdByName = React.useCallback(async (name) => {
    const items = await fetchAll('/academics/classes/')
    if (!name) return null
    const names = items.map(it => it.name || '')
    const best = bestFuzzy(String(name), names, 0.6)
    const idx = names.findIndex(n => n === best)
    if (idx >= 0) return items[idx]?.id || null
    const direct = items.find(it => String(it.name || '').toLowerCase() === String(name).toLowerCase())
    return direct ? direct.id : null
  }, [fetchAll])

  const startCreateExam = React.useCallback(() => {
    setFlow('create_exam')
    setFlowData({ name: '', className: '', date: '', total_marks: '', year: '', term: '' })
    append('assistant', pick(phrases.createExamIntro)())
  }, [append, pick, phrases])

  const submitCreateExam = React.useCallback(async () => {
    const { name, className, date, total_marks, year, term } = flowData
    if (!name || !className || !date) { append('assistant', 'Provide name, class and date.'); return }
    setBusy(true)
    try{
      const klass = await resolveClassIdByName(className)
      if (!klass) { append('assistant', 'I could not find that class.'); setBusy(false); return }
      const payload = { name, date, total_marks: total_marks ? Number(total_marks) : null, year: year ? Number(year) : null, term: term ? Number(term) : null, klass }
      await api.post('/academics/exams/', payload)
      append('assistant', 'Exam created.')
      setMemory(prev => ({ ...prev, lastResource: { type: 'exam' } }))
      setFlow(null); setFlowData({})
      navigate('/admin/exams')
    }catch(e){
      append('assistant', `Failed to create exam: ${e?.response?.data?.detail || e?.message || 'error'}`)
    }finally{
      setBusy(false)
    }
  }, [flowData, resolveClassIdByName, append, setMemory, navigate])

  const startAddStudent = React.useCallback(() => {
    setFlow('add_student')
    setFlowData({ name: '', admission_no: '', dob: '', gender: '', className: '' })
    append('assistant', pick(phrases.addStudentIntro)())
  }, [append, pick, phrases])

  const submitAddStudent = React.useCallback(async () => {
    const { name, admission_no, dob, gender, className } = flowData
    if (!name || !admission_no || !dob || !gender) {
      const missing = [!name && 'name', !admission_no && 'admission number', !dob && 'date of birth', !gender && 'gender'].filter(Boolean).join(', ')
      append('assistant', `Missing required field(s): ${missing}.`)
      return
    }
    setBusy(true)
    try{
      let klass = null
      if (className) klass = await resolveClassIdByName(className)
      const payload = { name, admission_no, dob, gender }
      if (klass) payload.klass = klass
      await api.post('/academics/students/', payload)
      append('assistant', 'Student created.')
      try { showSuccess('Student Added', `Student ${name} has been added successfully.`) } catch {}
      setMemory(prev => ({ ...prev, lastResource: { type: 'student' } }))
      setFlow(null); setFlowData({})
      navigate('/admin/students')
    }catch(e){
      const err = e?.response?.data
      let msg = e?.response?.data?.detail || e?.message || 'error'
      if (err && typeof err === 'object'){
        const parts = []
        Object.keys(err).forEach(k => { parts.push(`${k}: ${Array.isArray(err[k]) ? err[k].join(' ') : String(err[k])}`) })
        if (parts.length) msg = parts.join('; ')
      }
      append('assistant', `Failed to add student: ${msg}`)
      try { showError('Failed to Add Student', msg) } catch {}
    }finally{
      setBusy(false)
    }
  }, [flowData, resolveClassIdByName, append, setMemory, navigate, showSuccess, showError])

  const handleSearch = React.useCallback(async ({ scope, q }) => {
    const ql = (q || '').toLowerCase().trim()
    let endpoint = null
    if (scope.includes('student')) endpoint = '/academics/students/'
    else if (scope.includes('exam')) endpoint = '/academics/exams/'
    else if (scope.includes('teacher')) endpoint = '/academics/teachers/'
    else if (scope.includes('class')) endpoint = '/academics/classes/'
    else if (scope.includes('result')) endpoint = '/academics/exam_results/'
    if (!endpoint){ append('assistant', 'Unknown search scope'); return }
    const items = await fetchAll(endpoint)
    const filtered = items.filter(it => {
      const hay = JSON.stringify(it).toLowerCase()
      return ql ? hay.includes(ql) : true
    }).slice(0, 10)
    if (filtered.length === 0){
      append('assistant', pick(phrases.noResults)())
    } else {
      append('assistant', pick(phrases.topResults)() + '\n' + filtered.map(v => `- ${v.name || v.title || v.id}`).join('\n'))
    }
  }, [append, fetchAll])

  const handleSendArrears = React.useCallback(async ({ min_balance, klass, channels, message }) => {
    const role = (user?.role || '').toLowerCase()
    if (!(user?.is_superuser || user?.is_staff || role === 'admin' || role === 'finance')){
      append('assistant', 'Only admin or finance can send arrears notifications.')
      return
    }
    setBusy(true)
    try{
      let klassId = null
      if (klass) klassId = await resolveClassIdByName(klass)
      append('assistant', 'Queuing an arrears notification campaign...')
      const payload = {
        message: message || 'Dear Parent/Guardian, you have an outstanding fee balance. Kindly clear as soon as possible.',
        klass: klassId,
        min_balance: typeof min_balance === 'number' && !isNaN(min_balance) ? min_balance : 1,
        send_in_app: channels && (channels.inapp === true || (!channels.sms && !channels.email && channels.inapp !== false)),
        send_sms: !!(channels && channels.sms),
        send_email: !!(channels && channels.email),
        email_subject: 'Fee Balance Reminder'
      }
      const { data: created } = await api.post('/communications/arrears-campaigns/', payload)
      if (!created?.id){ append('assistant', 'Failed to create campaign.'); setBusy(false); return }
      await api.post(`/communications/arrears-campaigns/${created.id}/send/`)
      append('assistant', `Arrears notification campaign queued${klassId ? ' for the selected class' : ''}.`, [
        { type: 'open', value: 'messages', label: 'Open Messages' },
        { type: 'text', value: 'send fee notice via email', label: 'Send via Email', autoSend: true },
        { type: 'text', value: 'send fee notice via sms', label: 'Send via SMS', autoSend: true },
      ])
    }catch(e){
      const err = e?.response?.data
      let msg = e?.response?.data?.detail || e?.message || 'error'
      if (err && typeof err === 'object' && !Array.isArray(err)){
        const parts = []
        Object.keys(err).forEach(k => { parts.push(`${k}: ${Array.isArray(err[k]) ? err[k].join(' ') : String(err[k])}`) })
        if (parts.length) msg = parts.join('; ')
      }
      append('assistant', `Failed to queue campaign: ${msg}`)
    }finally{
      setBusy(false)
    }
  }, [append, resolveClassIdByName, user])

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  // Auto-scroll to the latest message when messages change or panel opens
  React.useEffect(() => {
    const el = listRef.current
    if (el) {
      if (stickToBottom) el.scrollTop = el.scrollHeight
    }
  }, [messages, open, stickToBottom])

  const onScrollList = React.useCallback((e) => {
    const el = e?.currentTarget
    if (!el) return
    const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 50
    setStickToBottom(nearBottom)
  }, [])

  // Listen for external ask events from other components (e.g., Help Center)
  React.useEffect(() => {
    const handler = (e) => {
      const q = (e?.detail?.q || '').trim()
      if (!q) return
      setInput('')
      append('user', q)
      setBusy(true)
      try {
        const intent = parseIntent(q)
        pushIntent({ type: intent.type, raw: q })
        executeIntent(intent, q)
      } catch (err) {
        append('assistant', `Error: ${err?.message || 'Something went wrong'}`)
      } finally {
        setBusy(false)
      }
    }
    window.addEventListener('assistant:ask', handler)
    return () => window.removeEventListener('assistant:ask', handler)
  }, [append, executeIntent, pushIntent])

  // Sizing + resizing handlers
  const [boxSize, setBoxSize] = React.useState({ width: 380, height: 520 })
  const resizingRef = React.useRef(false)
  // Small screen detection for responsive mobile layout
  const isSmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches
  const startResize = (e) => {
    e.preventDefault()
    resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: boxSize.width, startH: boxSize.height }
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', stopResize)
  }
  const onResizeMove = (e) => {
    const r = resizingRef.current
    if (!r) return
    const dw = e.clientX - r.startX
    const dh = e.clientY - r.startY
    const width = Math.max(300, Math.min(600, r.startW + dw))
    const height = Math.max(360, Math.min(720, r.startH + dh))
    setBoxSize({ width, height })
  }
  const stopResize = () => {
    resizingRef.current = false
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', stopResize)
  }

  return (
    <>
      {open && (
        <div
          onClick={isSmall ? closePanel : undefined}
          style={{
            position: 'fixed',
            inset: 0,
            background: isSmall ? 'rgba(15, 23, 42, 0.35)' : 'transparent',
            zIndex: 2100,
            pointerEvents: isSmall ? 'auto' : 'none',
          }}
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          style={{
            position: 'fixed',
            right: isSmall ? 0 : 20,
            left: isSmall ? 0 : 'auto',
            bottom: isSmall ? 0 : 86,
            width: isSmall ? '100vw' : boxSize.width,
            height: isSmall ? '65vh' : boxSize.height,
            background: 'white',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderBottomLeftRadius: isSmall ? 0 : 12,
            borderBottomRightRadius: isSmall ? 0 : 12,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2200,
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #f8fafc, #ffffff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <span style={{ width: 28, height: 28, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: 'white' }}>
                <Sparkles size={16} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 14 }}>Assistant</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{busy ? 'Working…' : 'Ready'}</span>
              </div>
              {busy && <Loader2 size={16} style={{ opacity: 0.7 }} className="animate-spin" />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isSmall && (
                <div title="Resize" onMouseDown={startResize} style={{ width: 16, height: 16, cursor: 'nwse-resize', opacity: 0.7 }}>
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 21h18M7 17h14M11 13h10M15 9h6M19 5h2" stroke="#64748b" fill="none" strokeWidth="2"/></svg>
                </div>
              )}
              <button
                onClick={() => setMessages([{ role: 'assistant', text: `Hello ${user?.first_name || user?.username || 'there'}! I can help you open pages and perform actions. Try: "open exams", "publish exam 42", "delete student 123", or "search students amina".` }])}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 10 }}
                title="Clear chat"
              >
                <Trash2 size={18} color="#64748b" />
              </button>
              <button onClick={closePanel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 10 }} title="Close">
                <X size={18} color="#64748b" />
              </button>
            </div>
          </div>
          <div
            ref={listRef}
            onScroll={onScrollList}
            style={{ padding: 12, flex: 1, overflow: 'auto', background: 'linear-gradient(180deg, #f1f5f9, #e2e8f0)' }}
          >
            {messages.map((m, i) => {
              const fromUser = m.role !== 'assistant'
              return (
                <div key={i} style={{ display: 'flex', justifyContent: fromUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    maxWidth: '80%',
                    background: fromUser ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#ffffff',
                    color: '#111827',
                    borderRadius: 16,
                    borderTopRightRadius: fromUser ? 4 : 16,
                    borderTopLeftRadius: fromUser ? 16 : 4,
                    padding: '10px 12px',
                    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                    border: fromUser ? '1px solid rgba(22, 163, 74, 0.25)' : '1px solid rgba(148, 163, 184, 0.35)'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.45, color: fromUser ? 'white' : '#0f172a' }}>{m.text}</div>
                    <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.75, textAlign: fromUser ? 'right' : 'left', color: fromUser ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                      {fmtTime(m.at)}
                    </div>
                    {!fromUser && Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {m.suggestions.map((s, si) => (
                          <button key={si} onClick={() => onSuggestionClick(s)} disabled={busy}
                            style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', borderRadius: 9999, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            {s.label || s.text || 'Option'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {!stickToBottom && (
              <button
                onClick={() => {
                  const el = listRef.current
                  if (el) el.scrollTop = el.scrollHeight
                  setStickToBottom(true)
                }}
                style={{
                  position: 'sticky',
                  bottom: 12,
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  color: '#0f172a',
                  borderRadius: 9999,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Jump to latest"
              >
                <ArrowDown size={14} />
                Latest
              </button>
            )}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #ffffff, #f8fafc)' }}>
            {flow === 'create_exam' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="Exam name" value={flowData.name || ''} onChange={e=>setFlowData(d=>({ ...d, name: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <input placeholder="Class (e.g., Grade 7 East)" value={flowData.className || ''} onChange={e=>setFlowData(d=>({ ...d, className: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <input placeholder="Date (YYYY-MM-DD)" value={flowData.date || ''} onChange={e=>setFlowData(d=>({ ...d, date: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input placeholder="Total marks" value={flowData.total_marks || ''} onChange={e=>setFlowData(d=>({ ...d, total_marks: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                  <input placeholder="Year (e.g., 2025)" value={flowData.year || ''} onChange={e=>setFlowData(d=>({ ...d, year: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                </div>
                <input placeholder="Term (1..3)" value={flowData.term || ''} onChange={e=>setFlowData(d=>({ ...d, term: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={()=>{ setFlow(null); setFlowData({}); }} disabled={busy} style={{ height: 36, padding: '0 12px' }}>Cancel</button>
                  <button onClick={submitCreateExam} disabled={busy} style={{ height: 36, padding: '0 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>Create Exam</button>
                </div>
              </div>
            )}
            {flow === 'add_student' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="Student full name" value={flowData.name || ''} onChange={e=>setFlowData(d=>({ ...d, name: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <input placeholder="Admission Number" value={flowData.admission_no || ''} onChange={e=>setFlowData(d=>({ ...d, admission_no: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input placeholder="Date of Birth (YYYY-MM-DD)" value={flowData.dob || ''} onChange={e=>setFlowData(d=>({ ...d, dob: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                  <select value={flowData.gender || ''} onChange={e=>setFlowData(d=>({ ...d, gender: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', background: 'white' }}>
                    <option value="" disabled>Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <input placeholder="Class (optional)" value={flowData.className || ''} onChange={e=>setFlowData(d=>({ ...d, className: e.target.value }))} style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={()=>{ setFlow(null); setFlowData({}); }} disabled={busy} style={{ height: 36, padding: '0 12px' }}>Cancel</button>
                  <button onClick={submitAddStudent} disabled={busy} style={{ height: 36, padding: '0 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>{busy ? 'Adding…' : 'Add Student'}</button>
                </div>
              </div>
            )}
            {flow === 'help_steps' && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#475569' }}>{flowData?.title || 'Procedure'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={()=> onSuggestionClick({ type: 'help_back' })} disabled={(flowData?.index||0)===0} style={{ height: 36, padding: '0 12px' }}>Back</button>
                  {flowData?.deepLink && (
                    <button onClick={()=> onSuggestionClick({ type: 'open_link', href: flowData.deepLink })} style={{ height: 36, padding: '0 12px' }}>Open Page</button>
                  )}
                  {(flowData?.steps?.length||0) > 0 && (flowData.index || 0) < (flowData.steps.length - 1) ? (
                    <button onClick={()=> onSuggestionClick({ type: 'help_next' })} style={{ height: 36, padding: '0 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>Next</button>
                  ) : (
                    <button onClick={()=> onSuggestionClick({ type: 'help_done' })} style={{ height: 36, padding: '0 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 6 }}>Done</button>
                  )}
                </div>
              </div>
            )}
            {!flow && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="What can I do for you?"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy}
                  style={{ flex: 1, height: 42, borderRadius: 9999, border: '1px solid #e2e8f0', padding: '0 14px', background: 'white', outline: 'none', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.06)' }}
                />
                <button onClick={handleSubmit} disabled={busy} style={{ height: 42, padding: '0 16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', border: 'none', borderRadius: 9999, fontWeight: 800, boxShadow: '0 10px 20px rgba(34, 197, 94, 0.25)', cursor: 'pointer' }}>Send</button>
              </div>
            )}
            {!flow && messages.length <= 2 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[
                  { label: 'Open Students', value: 'students' },
                  { label: 'Open Exams', value: 'exams' },
                  { label: 'Search Students', value: 'search students ' },
                  { label: 'Help', value: 'help' },
                ].map((x) => (
                  <button
                    key={x.label}
                    onClick={() => {
                      if (x.value.startsWith('search')) { setInput(x.value); return }
                      onSuggestionClick({ type: x.value === 'help' ? 'open' : 'open', value: x.value, label: x.label })
                    }}
                    disabled={busy}
                    style={{ border: '1px solid #e5e7eb', background: 'white', color: '#0f172a', borderRadius: 9999, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
