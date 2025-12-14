import React, { useEffect, useState } from 'react'
import api from '../api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function AdminReports(){
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const load = async (clearCache = false) => {
    try {
      if (clearCache) {
        await api.post('/reports/clear-cache/')
      }
      const { data } = await api.get('/reports/summary/')
      setData(data)
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  useEffect(()=>{ load() },[])

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Metric','Value'],
      ['Students', data.students],
      ['Teachers', data.teachers],
      ['Classes', data.classes],
      ['AttendanceRate', data.attendanceRate + '%'],
      ['AvgScore', data.academic?.avgScore],
      ['FeesCollected', data.fees?.collected],
      ['FeesOutstanding', data.fees?.outstanding],
      ['CollectionRate', data.fees?.collectionRate + '%'],
      ['Invoices', data.fees?.invoices],
      ['PaidInvoices', data.fees?.paidInvoices],
      ['Assessments', data.assessmentsCount],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'school_report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!data) {
    return (
      <React.Fragment>
        <div className="space-y-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="flex space-x-2">
              <div className="h-10 bg-gray-200 rounded w-24"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-gray-200 rounded-xl h-32"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => (
              <div key={i} className="bg-gray-200 rounded-xl h-80"></div>
            ))}
          </div>
        </div>
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">School-wide Reports</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto -mx-1 px-1">
            <button
              onClick={() => load(true)}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 sm:px-4 py-2 rounded-lg transition text-sm font-medium text-gray-800"
              aria-label="Refresh"
            >
              <span>Refresh</span>
            </button>
            <button
              onClick={exportCSV}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition text-sm font-medium"
              aria-label="Export CSV"
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6 overflow-x-auto -mx-2 px-2">
            {['overview', 'finance', 'academic', 'administrative'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 pb-3 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Total Students</div>
                <div className="text-3xl font-bold mt-2">{data.students}</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Total Teachers</div>
                <div className="text-3xl font-bold mt-2">{data.teachers}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Total Classes</div>
                <div className="text-3xl font-bold mt-2">{data.classes}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Attendance Rate</div>
                <div className="text-3xl font-bold mt-2">{data.attendanceRate}%</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attendance Trend - Line Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Attendance Trend (14 Days)</h3>
                <div className="h-64">
                  <Line
                  data={{
                    labels: data.attendanceTrend?.map(item => 
                      new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    ),
                    datasets: [{
                      label: 'Attendance Rate (%)',
                      data: data.attendanceTrend?.map(item => item.rate),
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointHoverRadius: 6
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.parsed.y}%`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: (value) => `${value}%` }
                      }
                    }
                  }}
                  />
                </div>
              </div>

              {/* Fees Trend - Bar Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Fee Collection Trend (6 Months)</h3>
                <div className="h-64">
                  <Bar
                  data={{
                    labels: data.feesTrend?.map(item => item.month),
                    datasets: [{
                      label: 'Collected (KES)',
                      data: data.feesTrend?.map(item => item.collected),
                      backgroundColor: 'rgba(34, 197, 94, 0.8)',
                      borderColor: 'rgb(34, 197, 94)',
                      borderWidth: 2,
                      borderRadius: 8
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `KES ${context.parsed.y.toLocaleString()}`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => `${(value / 1000).toFixed(0)}K`
                        }
                      }
                    }
                  }}
                  />
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Finance Summary</h3>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-48 h-48">
                    <Doughnut
                      data={{
                        labels: ['Collected', 'Outstanding'],
                        datasets: [{
                          data: [
                            data.fees?.collected,
                            data.fees?.outstanding
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                          ],
                          borderColor: [
                            'rgb(34, 197, 94)',
                            'rgb(239, 68, 68)'
                          ],
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 10,
                              font: { size: 10 }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = context.parsed || 0;
                                return `KES ${value.toLocaleString()}`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-semibold">KES {Number(data.fees?.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Collection Rate:</span>
                    <span className="font-semibold text-blue-600">{data.fees?.collectionRate}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Academic Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Score:</span>
                    <span className="font-semibold text-2xl text-blue-600">{data.academic?.avgScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assessments:</span>
                    <span className="font-semibold">{data.assessmentsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Excellent (≥80):</span>
                    <span className="font-semibold text-green-600">{data.academic?.performanceDistribution?.excellent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Good (60-79):</span>
                    <span className="font-semibold text-blue-600">{data.academic?.performanceDistribution?.good}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Attendance Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Present:</span>
                    <span className="font-semibold text-green-600">{data.administrative?.attendanceStatus?.present}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Absent:</span>
                    <span className="font-semibold text-red-600">{data.administrative?.attendanceStatus?.absent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Late:</span>
                    <span className="font-semibold text-orange-600">{data.administrative?.attendanceStatus?.late}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">Overall Rate:</span>
                    <span className="font-semibold text-blue-600">{data.attendanceRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Finance Tab */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* Finance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600">Total Fees</div>
                <div className="text-2xl font-bold text-gray-800 mt-2">
                  KES {Number(data.fees?.total || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600">Collected</div>
                <div className="text-2xl font-bold text-green-600 mt-2">
                  KES {Number(data.fees?.collected || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600">Outstanding</div>
                <div className="text-2xl font-bold text-red-600 mt-2">
                  KES {Number(data.fees?.outstanding || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600">Collection Rate</div>
                <div className="text-2xl font-bold text-blue-600 mt-2">
                  {data.fees?.collectionRate}%
                </div>
              </div>
            </div>

            {/* Fee Collection Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Monthly Fee Collection</h3>
              <div className="h-80">
                <Bar
                data={{
                  labels: data.feesTrend?.map(item => item.month),
                  datasets: [{
                    label: 'Collected',
                    data: data.feesTrend?.map(item => item.collected),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 2,
                    borderRadius: 10
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `KES ${context.parsed.y.toLocaleString()}`
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `KES ${(value / 1000).toFixed(0)}K`
                      }
                    }
                  }
                }}
                />
              </div>
            </div>

            {/* Invoice Statistics & Recent Payments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Invoice Statistics</h3>
                <div className="flex items-center justify-center">
                  <div className="w-64 h-64">
                    <Doughnut
                      data={{
                        labels: ['Paid', 'Pending'],
                        datasets: [{
                          data: [
                            data.fees?.paidInvoices,
                            data.fees?.invoices - data.fees?.paidInvoices
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                          ],
                          borderColor: [
                            'rgb(34, 197, 94)',
                            'rgb(239, 68, 68)'
                          ],
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 15,
                              font: { size: 12 }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = data.fees?.invoices || 1;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-600">Total Invoices</div>
                  <div className="text-2xl font-bold">{data.fees?.invoices}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
                <div className="space-y-3">
                  {data.administrative?.recentPayments?.length > 0 ? (
                    data.administrative.recentPayments.map((payment, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-800">{payment.student}</div>
                          <div className="text-xs text-gray-500">{payment.date}</div>
                        </div>
                        <div className="font-semibold text-green-600">
                          KES {Number(payment.amount).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">No recent payments</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Academic Tab */}
        {activeTab === 'academic' && (
          <div className="space-y-6">
            {/* Academic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Average Score</div>
                <div className="text-3xl font-bold mt-2">{data.academic?.avgScore}</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Excellent (≥80)</div>
                <div className="text-3xl font-bold mt-2">{data.academic?.performanceDistribution?.excellent}</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Good (60-79)</div>
                <div className="text-3xl font-bold mt-2">{data.academic?.performanceDistribution?.good}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Total Assessments</div>
                <div className="text-3xl font-bold mt-2">{data.assessmentsCount}</div>
              </div>
            </div>

            {/* Performance Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Student Performance Distribution</h3>
                <div className="flex items-center justify-center">
                  <div className="w-80 h-80">
                    <Pie
                      data={{
                        labels: ['Excellent (≥80)', 'Good (60-79)', 'Average (40-59)', 'Poor (<40)'],
                        datasets: [{
                          data: [
                            data.academic?.performanceDistribution?.excellent,
                            data.academic?.performanceDistribution?.good,
                            data.academic?.performanceDistribution?.average,
                            data.academic?.performanceDistribution?.poor
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(234, 179, 8, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                          ],
                          borderColor: [
                            'rgb(34, 197, 94)',
                            'rgb(59, 130, 246)',
                            'rgb(234, 179, 8)',
                            'rgb(239, 68, 68)'
                          ],
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 10,
                              font: { size: 11 }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = Object.values(data.academic?.performanceDistribution || {}).reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
                <div className="h-72">
                  <Bar
                  data={{
                    labels: ['Excellent', 'Good', 'Average', 'Poor'],
                    datasets: [{
                      label: 'Number of Students',
                      data: [
                        data.academic?.performanceDistribution?.excellent,
                        data.academic?.performanceDistribution?.good,
                        data.academic?.performanceDistribution?.average,
                        data.academic?.performanceDistribution?.poor
                      ],
                      backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(234, 179, 8, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                      ],
                      borderColor: [
                        'rgb(34, 197, 94)',
                        'rgb(59, 130, 246)',
                        'rgb(234, 179, 8)',
                        'rgb(239, 68, 68)'
                      ],
                      borderWidth: 2,
                      borderRadius: 8
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                      }
                    }
                  }}
                  />
                </div>
              </div>
            </div>

            {/* Class Performance */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Class Performance</h3>
              <div style={{ height: `${Math.max(300, (data.academic?.classPerformance?.length || 1) * 50)}px` }}>
                <Bar
                data={{
                  labels: data.academic?.classPerformance?.map(c => c.name),
                  datasets: [{
                    label: 'Average Score',
                    data: data.academic?.classPerformance?.map(c => c.avgScore),
                    backgroundColor: data.academic?.classPerformance?.map(c => 
                      c.avgScore >= 80 ? 'rgba(34, 197, 94, 0.8)' :
                      c.avgScore >= 60 ? 'rgba(59, 130, 246, 0.8)' :
                      c.avgScore >= 40 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(239, 68, 68, 0.8)'
                    ),
                    borderColor: data.academic?.classPerformance?.map(c => 
                      c.avgScore >= 80 ? 'rgb(34, 197, 94)' :
                      c.avgScore >= 60 ? 'rgb(59, 130, 246)' :
                      c.avgScore >= 40 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)'
                    ),
                    borderWidth: 2,
                    borderRadius: 8
                  }]
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        afterLabel: (context) => {
                          const idx = context.dataIndex;
                          const students = data.academic?.classPerformance?.[idx]?.students;
                          return `Students: ${students}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      max: 100,
                      ticks: { callback: (value) => `${value}` }
                    }
                  }
                }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Administrative Tab */}
        {activeTab === 'administrative' && (
          <div className="space-y-6">
            {/* Attendance Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Present</div>
                <div className="text-3xl font-bold mt-2">{data.administrative?.attendanceStatus?.present}</div>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Absent</div>
                <div className="text-3xl font-bold mt-2">{data.administrative?.attendanceStatus?.absent}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="text-sm opacity-90">Late</div>
                <div className="text-3xl font-bold mt-2">{data.administrative?.attendanceStatus?.late}</div>
              </div>
            </div>

            {/* Attendance Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">14-Day Attendance Trend</h3>
                <div className="h-80">
                  <Line
                  data={{
                    labels: data.attendanceTrend?.map(item => 
                      new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    ),
                    datasets: [{
                      label: 'Attendance Rate',
                      data: data.attendanceTrend?.map(item => item.rate),
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBackgroundColor: data.attendanceTrend?.map(item => 
                        item.rate >= 90 ? 'rgb(34, 197, 94)' :
                        item.rate >= 75 ? 'rgb(59, 130, 246)' :
                        item.rate >= 60 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)'
                      )
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.parsed.y}%`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: (value) => `${value}%` }
                      }
                    }
                  }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Attendance Status Breakdown</h3>
                <div className="flex items-center justify-center">
                  <div className="w-80 h-80">
                    <Doughnut
                      data={{
                        labels: ['Present', 'Absent', 'Late'],
                        datasets: [{
                          data: [
                            data.administrative?.attendanceStatus?.present,
                            data.administrative?.attendanceStatus?.absent,
                            data.administrative?.attendanceStatus?.late
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(239, 68, 68, 0.8)',
                            'rgba(249, 115, 22, 0.8)'
                          ],
                          borderColor: [
                            'rgb(34, 197, 94)',
                            'rgb(239, 68, 68)',
                            'rgb(249, 115, 22)'
                          ],
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 15,
                              font: { size: 12 }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = (data.administrative?.attendanceStatus?.present || 0) +
                                             (data.administrative?.attendanceStatus?.absent || 0) +
                                             (data.administrative?.attendanceStatus?.late || 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Teacher Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Teacher Statistics</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-gray-600 font-medium">Teacher</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-medium">Classes</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-medium">Students</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-medium">Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.administrative?.teacherStats?.map((teacher, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{teacher.name}</td>
                        <td className="py-3 px-4">{teacher.classes}</td>
                        <td className="py-3 px-4">{teacher.students}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs">
                              <div 
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${Math.min((teacher.students / 50) * 100, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{teacher.students}/50</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  )
}
