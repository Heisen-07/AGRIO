import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, badgeText, badgeColor = 'emerald', onClick }) {
  const badgeClasses = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-surface-border shadow-soft-glow hover:shadow-lift hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-3 rounded-xl bg-surface-muted text-forest">
          {Icon && <Icon className="w-5 h-5 text-emerald-700" />}
        </div>
        {badgeText && (
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${badgeClasses[badgeColor] || badgeClasses.emerald}`}>
            {badgeText}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-agrio-subtle uppercase tracking-wider mb-1">
          {title}
        </p>
        <h3 className="text-2xl font-extrabold text-forest tracking-tight">
          {value}
        </h3>
        {subtext && (
          <p className="text-xs text-gray-500 font-medium mt-1">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
