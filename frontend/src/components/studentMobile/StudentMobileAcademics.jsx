import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudentMobileHeader from './StudentMobileHeader'
import StudentMobileTabs from './StudentMobileTabs'
import { DonutChart, ProgressBar, MiniLineChart } from './StudentMobileCharts'

function marksToGrade(marks) {
  const m = Number(marks)
  if (m >= 80) return 'A'
  if (m >= 75) return 'A-'
  if (m >= 70) return 'B+'
  if (m >= 65) return 'B'
  if (m >= 60) return 'B-'
  if (m >= 55) return 'C+'
  if (m >= 50) return 'C'
  return 'D'
}

function marksToGpa(marks) {
  const m = Number(marks)
  if (m >= 80) return 4.0
  if (m >= 75) return 3.7
  if (m >= 70) return 3.3
  if (m >= 65) return 3.0
  if (m >= 60) return 2.7
  if (m >= 55) return 2.3
  if (m >= 50) return 2.0
  return 1.0
}

export default function StudentMobileAcademics({
  student,
  assessments = [],
  examResults = [],
  calendarYear,
  calendarTerm,
  attendance = [],
  isLoading = false,
  onRefresh,
  refreshing = false,
}) {
  const navigate = useNavigate()
  const [subTab, setSubTab] = useState('overview')
  const [reportsSubTab, setReportsSubTab] = useState('academic')

  const termLabel = useMemo(() => {
    const year = calendarYear?.label || calendarYear?.name || '2024/2025'
    const term = calendarTerm?.name || (calendarTerm?.number ? `Term ${calendarTerm.number}` : 'Term 2')
    return `${year} - ${term}`
  }, [calendarYear, calendarTerm])

  const groupedExams = useMemo(() => {
    const m = new Map()
    for (const r of examResults || []) {
      const name = r.exam_detail?.name || r.exam || 'Exam'
      if (!m.has(name)) m.set(name, [])
      m.get(name).push(r)
    }
    return Array.from(m.entries())
  }, [examResults])

  const courses = useMemo(() => {
    const bySubject = new Map()
    for (const r of examResults || []) {
      const subj = r.subject_detail
      const key = subj?.id || subj?.name || r.subject || 'Unknown'
      const name = subj?.name || String(r.subject || 'Subject')
      const code = subj?.code || ''
      if (!bySubject.has(key)) {
        bySubject.set(key, { name, code, marks: [], assessments: 0, completed: 0 })
      }
      const entry = bySubject.get(key)
      entry.marks.push(Number(r.marks || 0))
    }
    for (const a of assessments || []) {
      const subj = a.subject_detail || a.subject
      const key = subj?.id || subj?.name || a.subject || 'misc'
      if (!bySubject.has(key)) {
        bySubject.set(key, {
          name: subj?.name || 'Subject',
          code: subj?.code || '',
          marks: [],
          assessments: 0,
          completed: 0,
        })
      }
      const entry = bySubject.get(key)
      entry.assessments += 1
      if (a.status === 'completed' || a.score != null || a.marks != null) entry.completed += 1
    }
    return Array.from(bySubject.values()).map(c => {
      const avg = c.marks.length ? c.marks.reduce((s, m) => s + m, 0) / c.marks.length : 0
      const progress = c.assessments > 0 ? (c.completed / c.assessments) * 100 : avg
      return { ...c, avg, progress: Math.min(100, Math.round(progress || avg)) }
    })
  }, [examResults, assessments])

  const gpa = useMemo(() => {
    if (!examResults?.length) return 0
    const gpas = examResults.map(r => marksToGpa(r.marks))
    return gpas.reduce((s, g) => s + g, 0) / gpas.length
  }, [examResults])

  const overallPercent = useMemo(() => {
    if (!examResults?.length) return 0
    const avg = examResults.reduce((s, r) => s + Number(r.marks || 0), 0) / examResults.length
    return Math.round(avg)
  }, [examResults])

  const attendancePercent = useMemo(() => {
    if (!attendance?.length) return null
    const present = attendance.filter(a => a.status === 'present' || a.present).length
    return Math.round((present / attendance.length) * 100)
  }, [attendance])

  const performance = useMemo(() => {
    if (!groupedExams.length) return []
    return groupedExams.map(([name, rows]) => {
      const avg = rows.reduce((s, r) => s + Number(r.marks || 0), 0) / rows.length
      return { label: String(name).slice(0, 6), avg }
    })
  }, [groupedExams])

  const subjectPerformance = useMemo(() => {
    return courses.map(c => ({
      name: c.name,
      grade: marksToGrade(c.avg),
      percent: Math.round(c.avg || c.progress),
    })).sort((a, b) => b.percent - a.percent)
  }, [courses])

  const recentResults = useMemo(() => {
    if (!examResults?.length) return []
    return examResults.slice(0, 5).map(r => ({
      subject: r.subject_detail?.name || r.subject || 'Subject',
      grade: marksToGrade(r.marks),
      marks: r.marks,
    }))
  }, [examResults])

  const examCount = groupedExams.length
  const assignmentCount = assessments?.length || 0

  const headerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'courses', label: 'My Courses' },
    { id: 'results', label: 'Results' },
    { id: 'reports', label: 'Reports' },
  ]

  const reportTabs = [
    { id: 'academic', label: 'Academic Report' },
    { id: 'grade', label: 'Grade Report' },
    { id: 'attendance', label: 'Attendance' },
  ]

  return (
    <div className="sm:hidden bg-slate-50 min-h-full">
      <div className="bg-blue-600 rounded-b-3xl shadow-md pb-1">
        <StudentMobileHeader
          theme="blue"
          embedded
          title="Academics"
          showBack
          onBack={() => navigate('/student')}
          rightIcon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          }
          onRightClick={() => {}}
        />
        <StudentMobileTabs tabs={headerTabs} active={subTab} onChange={setSubTab} />
      </div>

      <div className="px-4 py-4 space-y-4">
        {subTab === 'overview' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Current Term</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{termLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">GPA</div>
                  <div className="text-2xl font-bold text-blue-600">{gpa.toFixed(2)}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    {gpa >= 3.5 ? 'Good standing' : gpa >= 2.5 ? 'Fair standing' : 'Needs improvement'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Courses', value: courses.length },
                  { label: 'Exams', value: examCount },
                  { label: 'Assignments', value: assignmentCount },
                  { label: 'Attendance', value: attendancePercent != null ? `${attendancePercent}%` : '—' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="text-lg font-bold text-slate-900">{isLoading ? '—' : stat.value}</div>
                    <div className="text-[9px] font-semibold text-slate-500 uppercase">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Courses</h3>
              {courses.length > 0 ? (
                <div className="space-y-2">
                  {courses.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{c.name}</div>
                          {c.code && <div className="text-[10px] text-slate-500">{c.code}</div>}
                        </div>
                        <span className="text-sm font-bold text-blue-600 shrink-0">{c.progress}%</span>
                      </div>
                      <ProgressBar percent={c.progress} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-500 border border-slate-100">
                  No courses yet
                </div>
              )}
            </div>

            {recentResults.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Recent Results</h3>
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                  {recentResults.slice(0, 1).map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{r.subject}</span>
                      <span className="text-lg font-bold text-emerald-600">{r.grade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {subTab === 'courses' && (
          <div className="space-y-2">
            {courses.length > 0 ? courses.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.name}</div>
                    {c.code && <div className="text-xs text-slate-500">{c.code}</div>}
                  </div>
                  <span className="text-sm font-bold text-blue-600">{c.progress}%</span>
                </div>
                <ProgressBar percent={c.progress} />
                {c.avg > 0 && (
                  <div className="mt-2 text-xs text-slate-500">Average score: {c.avg.toFixed(1)}%</div>
                )}
              </div>
            )) : (
              <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No courses found</div>
            )}
          </div>
        )}

        {subTab === 'results' && (
          <div className="space-y-3">
            {groupedExams.length > 0 ? groupedExams.map(([name, rows]) => {
              const avg = rows.reduce((s, r) => s + Number(r.marks || 0), 0) / rows.length
              return (
                <div key={name} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-slate-900">{name}</div>
                    <span className="text-sm font-bold text-blue-600">{avg.toFixed(1)}%</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 truncate">
                          {r.subject_detail?.name || r.subject || 'Subject'}
                        </span>
                        <span className="font-bold text-slate-900 shrink-0 ml-2">
                          {marksToGrade(r.marks)} ({r.marks})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }) : (
              <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No exam results yet</div>
            )}
          </div>
        )}

        {subTab === 'reports' && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {reportTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportsSubTab(tab.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    reportsSubTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {reportsSubTab === 'academic' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Academic Performance</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <DonutChart percent={overallPercent} size={110} sublabel={overallPercent >= 80 ? 'Very Good' : overallPercent >= 60 ? 'Good' : 'Fair'} />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total Credits</span>
                        <span className="font-bold text-slate-900">{courses.length * 4}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Completed</span>
                        <span className="font-bold text-emerald-600">{Math.max(0, courses.length - 1)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">In Progress</span>
                        <span className="font-bold text-blue-600">{Math.min(1, courses.length)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {performance.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Performance Trend</h3>
                    <MiniLineChart data={performance} />
                  </div>
                )}

                {subjectPerformance.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Subject Performance</h3>
                    <div className="space-y-2">
                      {subjectPerformance.map((s, i) => (
                        <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-800 truncate">{s.name}</span>
                            <span className="text-sm font-bold text-blue-600 shrink-0 ml-2">{s.grade}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ProgressBar percent={s.percent} />
                            <span className="text-xs font-bold text-slate-600 shrink-0">{s.percent}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {reportsSubTab === 'grade' && (
              <div className="space-y-2">
                {subjectPerformance.length > 0 ? subjectPerformance.map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                    <span className="text-xl font-bold text-blue-600">{s.grade}</span>
                  </div>
                )) : (
                  <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500">No grade data</div>
                )}
              </div>
            )}

            {reportsSubTab === 'attendance' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                {attendancePercent != null ? (
                  <>
                    <div className="text-4xl font-bold text-blue-600">{attendancePercent}%</div>
                    <div className="text-sm text-slate-500 mt-2">Overall Attendance</div>
                    <div className="text-xs text-slate-400 mt-1">{attendance.length} records tracked</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">No attendance data available</div>
                )}
              </div>
            )}
          </>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>
    </div>
  )
}
