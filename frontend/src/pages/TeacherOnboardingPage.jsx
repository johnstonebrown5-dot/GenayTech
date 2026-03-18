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

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to EDU-TRACK',
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
    title: 'Quick Video Walkthrough',
    description: 'Watch this short step-by-step video to see how to navigate your new dashboard and perform key operations.',
    icon: <PlayCircle className="w-12 h-12 text-red-600" />,
    color: 'bg-red-50',
    content: (
      <div className="space-y-4">
        <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-200 flex items-center justify-center">
          {/* Video Placeholder - User can replace the src with their URL */}
          <iframe 
            className="absolute inset-0 w-full h-full"
            src={videoUrl}
            title="EDU-TRACK Teacher Tutorial"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
          <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />
        </div>
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
          <PlayCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <p className="text-xs text-amber-800">This video covers: Attendance, Grade Entry, Results analysis, and Messaging.</p>
        </div>
      </div>
    )
  },
  {
    id: 'dashboard',
    title: 'Smart Dashboard',
    description: 'Your central command center for daily operations and quick access to your classes.',
    icon: <LayoutDashboard className="w-12 h-12 text-blue-600" />,
    color: 'bg-blue-50',
    content: (
      <div className="space-y-3">
        <ul className="space-y-2">
          <li className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Calendar size={18} />
            </div>
            <span className="text-sm font-medium">Daily Timetable & Events</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <ClipboardList size={18} />
            </div>
            <span className="text-sm font-medium">Quick Tasks & Duties</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen size={18} />
            </div>
            <span className="text-sm font-medium">Your Assigned Classes</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'academics',
    title: 'Grading & Results',
    description: 'Effortlessly manage student performance with our streamlined academic tools.',
    icon: <BarChart3 className="w-12 h-12 text-emerald-600" />,
    color: 'bg-emerald-50',
    content: (
      <div className="space-y-4">
        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex-1 space-y-2">
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
            </div>
            <div className="h-2 w-2/3 bg-gray-100 rounded-full" />
            <div className="h-2 w-1/2 bg-gray-100 rounded-full" />
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-emerald-600">A+</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 italic text-center">"Automatic calculations for means, ranks, and grades."</p>
      </div>
    )
  },
  {
    id: 'communication',
    title: 'Seamless Communication',
    description: 'Stay connected with colleagues, parents, and students through our integrated messaging.',
    icon: <MessageSquare className="w-12 h-12 text-purple-600" />,
    color: 'bg-purple-50',
    content: (
      <div className="relative p-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500" />
            <div className="h-3 w-32 bg-gray-100 rounded-full" />
          </div>
          <div className="ml-11 h-12 w-full bg-gray-50 rounded-xl" />
          <div className="flex items-center gap-3 justify-end">
            <div className="h-3 w-24 bg-blue-100 rounded-full" />
            <div className="w-8 h-8 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <MessageSquare size={80} />
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

export default function TeacherOnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/embed/dQw4w9WgXcQ')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get('/auth/system-config/', { _skipGlobalLoading: true })
        if (mounted && res?.data) {
          const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches
          const desktopUrl = res.data.teacher_onboarding_video_url
          const mobileUrl = res.data.teacher_onboarding_video_url_mobile
          
          if (isMobile && mobileUrl) {
            setVideoUrl(mobileUrl)
          } else if (desktopUrl) {
            setVideoUrl(desktopUrl)
          }
        }
      } catch (e) {
        // Fallback to default
      }
    })()
    return () => { mounted = false }
  }, [])

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
          <span className="text-xl font-bold tracking-tight text-slate-900">EDU-TRACK</span>
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
