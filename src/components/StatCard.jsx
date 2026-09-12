import React from 'react';

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeColor = 'emerald',
  onClick,
}) {
  const badgeClasses = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-900 border-amber-200',
    red: 'bg-rose-100 text-rose-800 border-rose-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const iconBgClasses = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
    cyan: 'bg-cyan-50 text-cyan-700',
    purple: 'bg-purple-50 text-purple-700',
    slate: 'bg-slate-50 text-slate-700',
  };

  const isInteractive = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`bg-white/80 backdrop-blur-md p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic border border-emerald-100/70 ring-1 ring-inset ring-white/50 flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 ${
        isInteractive
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1.5 mb-2.5 sm:mb-3 min-w-0">
        <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl ${iconBgClasses[badgeColor] || iconBgClasses.emerald} shrink-0 shadow-2xs`}>
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
        {badgeText && (
          <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-full border shrink-0 text-right truncate max-w-[95px] sm:max-w-none shadow-2xs ${badgeClasses[badgeColor] || badgeClasses.emerald}`}>
            {badgeText}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-bold text-emerald-800/60 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
          {title}
        </p>
        <h3 className="text-lg sm:text-2xl font-extrabold text-emerald-950 tracking-tight truncate min-w-0">
          {value}
        </h3>
        {subtext && (
          <p className="text-[11px] sm:text-xs text-emerald-800/60 font-medium mt-0.5 sm:mt-1 truncate min-w-0">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

