import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, badgeText, badgeColor = 'emerald', onClick }) {
  const badgeClasses = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white/80 backdrop-blur-sm p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic hover:shadow-neumorphic-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between border border-white/60 min-w-0 overflow-hidden"
    >
      <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
        <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-700 shrink-0">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />}
        </div>
        {badgeText && (
          <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-xs font-bold rounded-full shrink-0 text-right truncate max-w-[85px] sm:max-w-none ${badgeClasses[badgeColor] || badgeClasses.emerald}`}>
            {badgeText}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-bold text-emerald-700/50 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
          {title}
        </p>
        <h3 className="text-lg sm:text-2xl font-extrabold text-emerald-950 tracking-tight truncate">
          {value}
        </h3>
        {subtext && (
          <p className="text-[10px] sm:text-xs text-emerald-700/40 font-medium mt-0.5 sm:mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
