import api, { isCanceledRequest } from '../api'

/** JSON object keys for subject ids may be strings; ensure numeric lookup works. */
export function normalizeComponentsMap(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, val] of Object.entries(raw)) {
    const n = Number(key)
    if (Number.isFinite(n)) out[n] = val
    out[key] = val
  }
  return out
}

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

function normalizeEnterPayload(data) {
  if (!data || typeof data !== 'object') return null
  return {
    exam: data.exam || null,
    klass: data.klass || null,
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    components_by_subject: normalizeComponentsMap(data.components_by_subject || {}),
    students: Array.isArray(data.students) ? data.students : [],
    existing_results: Array.isArray(data.existing_results) ? data.existing_results : [],
  }
}

/**
 * Build editable result rows from enter-data payload.
 * shouldContinue() allows aborting when the user navigates away (call every student loop).
 */
export function buildResultsRows(data, shouldContinue = () => true) {
  const rows = []
  const compsBySubject = data?.components_by_subject || {}
  const existing = data?.existing_results || []
  const indexKey = (r) => `${r?.student ?? r?.student_id}-${r?.subject ?? r?.subject_id}-${r?.component ?? r?.component_id ?? ''}`
  const existingMap = new Map()
  for (const r of existing) existingMap.set(indexKey(r), r)

  const preferredOut = new Map()
  for (const r of existing) {
    const sid = r?.subject ?? r?.subject_id
    const cid = r?.component ?? r?.component_id ?? ''
    const oo = Number(r?.out_of)
    const key = `${sid}-${cid}`
    if (sid && Number.isFinite(oo) && oo > 0 && !preferredOut.has(key)) {
      preferredOut.set(key, oo)
    }
  }

  const subj = data?.subjects || []
  const studentsList = data?.students || []

  for (const s of studentsList) {
    if (!shouldContinue()) return null
    for (const sub of subj) {
      if (!shouldContinue()) return null
      const comps = compsBySubject[sub.id] || compsBySubject[String(sub.id)] || []
      if (Array.isArray(comps) && comps.length > 0) {
        for (const c of comps) {
          const key = `${s.id}-${sub.id}-${c.id}`
          const found = existingMap.get(key)
          const mk = Number(found?.marks)
          const outOf = found && Number(found?.out_of)
          let marksVal = Number.isFinite(mk) ? mk : NaN
          const denom = Number.isFinite(outOf) && outOf > 0 ? outOf : Number(c?.max_marks)
          if (Number.isFinite(marksVal) && Number.isFinite(denom) && denom > 0 && marksVal <= 100 && marksVal > denom) {
            marksVal = Math.round((marksVal / 100) * denom)
          }
          const pref = preferredOut.get(`${sub.id}-${c.id}`)
          const rem = found && (found.remarks ?? found.remark)
          rows.push({
            student: s.id,
            subject: sub.id,
            component: c.id,
            marks: Number.isFinite(marksVal) ? marksVal : '',
            outOf: Number.isFinite(outOf) ? outOf : (Number.isFinite(pref) ? pref : undefined),
            remarks: rem != null ? String(rem) : '',
          })
        }
      } else {
        const key = `${s.id}-${sub.id}-`
        const found = existingMap.get(key)
        const mk = Number(found?.marks)
        const outOf = found && Number(found?.out_of)
        let marksVal = Number.isFinite(mk) ? mk : NaN
        const denom = Number.isFinite(outOf) && outOf > 0 ? outOf : Number(data?.exam?.total_marks ?? 100)
        if (Number.isFinite(marksVal) && Number.isFinite(denom) && denom > 0 && marksVal <= 100 && marksVal > denom) {
          marksVal = Math.round((marksVal / 100) * denom)
        }
        const pref = preferredOut.get(`${sub.id}-`)
        const rem = found && (found.remarks ?? found.remark)
        rows.push({
          student: s.id,
          subject: sub.id,
          component: null,
          marks: Number.isFinite(marksVal) ? marksVal : '',
          outOf: Number.isFinite(outOf) ? outOf : (Number.isFinite(pref) ? pref : undefined),
          remarks: rem != null ? String(rem) : '',
        })
      }
    }
  }
  return rows
}

async function fetchEnterDataFallback(examId) {
  const examRes = await api.get(`/academics/exams/${examId}/`, { timeout: 60000 })
  const exam = examRes?.data || {}
  const klassId = exam.klass ?? exam.klass_id
  if (!klassId) throw new Error('Exam has no class assigned.')

  const [klassRes, studentsRes, resultsRes] = await Promise.all([
    api.get(`/academics/classes/${klassId}/`, { timeout: 60000 }),
    api.get('/academics/students/', {
      params: { klass: klassId, is_active: true, page_size: 500 },
      timeout: 60000,
    }),
    api.get('/academics/exam_results/', {
      params: { exam: examId, page_size: 5000 },
      timeout: 60000,
    }),
  ])

  const klass = klassRes?.data || { id: klassId }
  let subjects = normalizeList(klass?.subjects)
  if (!subjects.length) {
    const allSubj = normalizeList((await api.get('/academics/subjects/', { timeout: 60000 }))?.data)
    const klassSubjectIds = new Set(
      (Array.isArray(klass?.subject_ids) ? klass.subject_ids : []).map(Number).filter(Number.isFinite)
    )
    if (klassSubjectIds.size) {
      subjects = allSubj.filter((s) => klassSubjectIds.has(Number(s.id)))
    }
  }
  subjects = subjects.filter((s) => s?.is_examinable !== false)
  if (!subjects.length && Array.isArray(klass?.subjects)) {
    subjects = klass.subjects
  }

  const subjectIds = subjects.map((s) => s.id).filter((id) => id != null)
  const componentsBySubject = {}
  if (subjectIds.length) {
    const compLists = await Promise.all(
      subjectIds.map((sid) =>
        api
          .get('/academics/subject_components/', { params: { subject: sid }, timeout: 30000 })
          .then((r) => ({ sid, list: normalizeList(r?.data) }))
          .catch(() => ({ sid, list: [] }))
      )
    )
    for (const { sid, list } of compLists) {
      if (list.length) componentsBySubject[sid] = list
    }
  }

  const students = normalizeList(studentsRes?.data).map((s) => ({
    id: s.id,
    name: s.name,
    admission_no: s.admission_no,
  }))

  const existing_results = normalizeList(resultsRes?.data).map((r) => ({
    id: r.id,
    student_id: r.student ?? r.student_id,
    subject_id: r.subject ?? r.subject_id,
    component_id: r.component ?? r.component_id ?? null,
    marks: r.marks,
    out_of: r.out_of,
    remarks: r.remarks ?? r.remark,
  }))

  return normalizeEnterPayload({
    exam: {
      id: exam.id,
      name: exam.name,
      year: exam.year,
      term: exam.term,
      date: exam.date,
      total_marks: exam.total_marks,
      published: exam.published,
    },
    klass: {
      id: klass.id,
      name: klass.name,
      grade_level: klass.grade_level,
    },
    subjects: subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
    })),
    components_by_subject: componentsBySubject,
    students,
    existing_results,
  })
}

/**
 * Load marks entry payload; tries optimized endpoint first, then legacy multi-call fallback.
 */
export async function fetchEnterResultsData(examId, reloadKey = 0, extraParams = {}) {
  try {
    const res = await api.get(`/academics/exams/${examId}/enter-data/`, {
      params: { ...extraParams, _: reloadKey },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      timeout: 90000,
      _noDedupe: reloadKey > 0,
    })
    const payload = normalizeEnterPayload(res?.data)
    if (payload) return { payload, source: 'enter-data' }
  } catch (primaryErr) {
    if (isCanceledRequest(primaryErr)) throw primaryErr
    console.warn('enter-data failed, using fallback loader:', primaryErr)
    try {
      const payload = await fetchEnterDataFallback(examId)
      if (payload) return { payload, source: 'fallback', primaryError: primaryErr }
    } catch (fallbackErr) {
      if (isCanceledRequest(fallbackErr)) throw fallbackErr
      throw fallbackErr
    }
    throw primaryErr
  }
  throw new Error('No data returned from server')
}
