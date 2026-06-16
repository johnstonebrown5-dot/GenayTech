import React from 'react'

export default function StudentMobileTabs({ tabs, active, onChange, badgeKey }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-3 -mt-1">
      {tabs.map(tab => {
        const isActive = active === tab.id
        const badge = badgeKey ? tab[badgeKey] : tab.badge
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? 'bg-white text-blue-600 shadow-sm'
                : 'bg-white/20 text-white/90 hover:bg-white/30'
            }`}
          >
            {tab.label}
            {badge > 0 && (
              <span className="ml-1 text-[10px]">({badge})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function StudentMobileContentTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
              isActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="ml-1">({tab.badge})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
