import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import api from '../api'
import { 
  LayoutDashboard, 
  BookOpen, 
  BarChart3, 
  MessageSquare, 
  UserCircle, 
  Settings, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  GraduationCap,
  Calendar,
  ClipboardList,
  PlayCircle
} from 'lucide-react'

export default function TeacherOnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [config, setConfig] = useState({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get('/auth/system-config/', { _skipGlobalLoading: true })
        if (mounted && res?.data) {
          setConfig(res.data)
        }
      } catch (e) {
        // Fallback to empty config
      }
    })()
    return () => { mounted = false }
  }, [])

  const getVideoUrl = (desktopKey, mobileKey) => {
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches
    const desktopUrl = config[desktopKey]
    const mobileUrl = config[mobileKey]
    
    if (isMobile && mobileUrl) return mobileUrl
    return desktopUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to Genay Technologies',
      description: 'Let\'s get you settled into your new digital classroom. We\'ve designed this space to make your teaching life easier.',
      icon: <GraduationCap className="w-12 h-12 text-indigo-600" />,
      color: 'bg-indigo-50',
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-1">Your Teaching Hub</h4>
            <p className="text-sm text-blue-800">Everything from grading to attendance is now at your fingertips. No more paper trails.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fast</span>
              <p className="text-sm font-semibold text-slate-900">Real-time sync</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Secure</span>
              <p className="text-sm font-semibold text-slate-900">Encrypted data</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'video-guide',
      title: 'Quick Overview',
      description: 'Watch this short video to see how to navigate your new dashboard and perform key operations.',
      icon: <PlayCircle className="w-12 h-12 text-red-600" />,
      color: 'bg-red-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('teacher_onboarding_video_url', 'teacher_onboarding_video_url_mobile')}
              title="Overview Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <p className="text-sm text-slate-600 text-center italic">"Start with the basics: navigation and your workspace."</p>
        </div>
      )
    },
    {
      id: 'messages-guide',
      title: 'How to: Messages',
      description: 'Learn how to stay connected with colleagues, parents, and students through our integrated messaging.',
      icon: <MessageSquare className="w-12 h-12 text-purple-600" />,
      color: 'bg-purple-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('video_url_messages', 'video_url_messages_mobile')}
              title="Messages Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-purple-600 mt-0.5" />
            <p className="text-xs text-purple-800">Learn to send broadcasts, private messages, and manage your inbox.</p>
          </div>
        </div>
      )
    },
    {
      id: 'grades-guide',
      title: 'How to: Enter Marks',
      description: 'Efficiently manage student performance with our streamlined grading tools.',
      icon: <BarChart3 className="w-12 h-12 text-emerald-600" />,
      color: 'bg-emerald-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('video_url_grades', 'video_url_grades_mobile')}
              title="Grades Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <p className="text-xs text-emerald-800">Master mark entry, grade calculations, and comment management.</p>
          </div>
        </div>
      )
    },
    {
      id: 'attendance-guide',
      title: 'How to: Attendance',
      description: 'Quickly record and monitor student attendance for your classes.',
      icon: <ClipboardList className="w-12 h-12 text-orange-600" />,
      color: 'bg-orange-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('video_url_attendance', 'video_url_attendance_mobile')}
              title="Attendance Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-orange-600 mt-0.5" />
            <p className="text-xs text-orange-800">See how to take daily attendance and generate attendance reports.</p>
          </div>
        </div>
      )
    },
    {
      id: 'print-results-guide',
      title: 'How to: Print Results',
      description: 'Learn how to generate and print student report cards and result sheets.',
      icon: <CheckCircle2 className="w-12 h-12 text-slate-600" />,
      color: 'bg-slate-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('video_url_print_results', 'video_url_print_results_mobile')}
              title="Print Results Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-slate-600 mt-0.5" />
            <p className="text-xs text-slate-800">Learn to generate PDFs for report cards, merit lists, and performance summaries.</p>
          </div>
        </div>
      )
    },
    {
      id: 'results-guide',
      title: 'How to: View Results',
      description: 'Analyze student performance across different exams and terms.',
      icon: <BarChart3 className="w-12 h-12 text-blue-600" />,
      color: 'bg-blue-50',
      content: (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
            <iframe 
              className="absolute inset-0 w-full h-full"
              src={getVideoUrl('video_url_results', 'video_url_results_mobile')}
              title="Results Tutorial"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800">Explore result analytics, class rankings, and mean performance.</p>
          </div>
        </div>
      )
    },
    {
      id: 'finish',
      title: 'Ready to Teach?',
      description: 'You\'re all set to begin your journey. Your profile and settings can be adjusted anytime.',
      icon: <CheckCircle2 className="w-12 h-12 text-orange-600" />,
      color: 'bg-orange-50',
      content: (
        <div className="text-center space-y-6 py-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-gray-900 text-xl">Onboarding Complete!</h4>
            <p className="text-gray-600 px-8 text-sm">Welcome aboard. Let\'s head to your dashboard and start making an impact.</p>
          </div>
        </div>
      )
    }
  ]

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      finishOnboarding()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const finishOnboarding = async () => {
    setIsFinishing(true)
    const userId = user?.id
    const key = userId ? `teacher_onboarding_completed:${String(userId)}` : 'teacher_onboarding_completed'
    
    try {
      localStorage.setItem(key, 'true')
      // Optional: Update server
      await api.post('/auth/onboarding/complete/', { scope: 'teacher_dashboard' }).catch(() => {})
      
      // Navigate to dashboard
      navigate('/teacher')
    } catch (e) {
      console.error('Failed to complete onboarding', e)
      navigate('/teacher')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background blobs for modern feel */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/40 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100/40 blur-[100px]" />
      </div>

      <div className="w-full max-w-4xl">
        {/* Header Branding */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <GraduationCap size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Genay Technologies</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white overflow-hidden transition-all duration-500">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-gray-100">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-8 sm:p-10">
            {/* Step Icon */}
            <div className={`w-20 h-20 ${step.color} rounded-2xl flex items-center justify-center mb-8 transition-transform duration-500 hover:scale-105`}>
              {step.icon}
            </div>

            {/* Title & Description */}
            <div className="space-y-2 mb-8">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {step.title}
              </h2>
              <p className="text-slate-600 leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Dynamic Content Area */}
            <div className="min-h-[160px] animate-in fade-in slide-in-from-bottom-4 duration-500">
              {step.content}
            </div>

            {/* Footer Actions */}
            <div className="mt-12 flex items-center justify-between gap-4">
              <button
                onClick={handleBack}
                disabled={currentStep === 0 || isFinishing}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all ${
                  currentStep === 0 
                    ? 'opacity-0 pointer-events-none' 
                    : 'text-slate-500 hover:bg-slate-50 active:scale-95'
                }`}
              >
                <ArrowLeft size={20} />
                Back
              </button>

              <button
                onClick={handleNext}
                disabled={isFinishing}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-95 transition-all"
              >
                {isFinishing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Finishing...
                  </span>
                ) : (
                  <>
                    {currentStep === steps.length - 1 ? 'Start Teaching' : 'Continue'}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {steps.map((_, idx) => (
            <div 
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep 
                  ? 'w-8 bg-indigo-600' 
                  : idx < currentStep 
                    ? 'w-3 bg-indigo-200' 
                    : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
