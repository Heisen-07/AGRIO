import React from 'react';
import { motion } from 'framer-motion';

export default function SoilMoistureRing({ 
  percentage = 68, 
  size = 120, 
  strokeWidth = 10, 
  label = "Soil Moisture",
  bare = false,
  statusText = "Optimal",
  strokeColor = "#059669",
  trackColor = "#D1FAE5",
  statusColor = "text-emerald-600"
}) {
  const numericVal = typeof percentage === 'number' && !isNaN(percentage) ? Math.max(0, Math.min(100, percentage)) : null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = numericVal !== null 
    ? circumference - (numericVal / 100) * circumference 
    : circumference;

  const ringElement = (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        className="w-full h-full transform -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Value Ring */}
        {numericVal !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
            fill="transparent"
          />
        )}
      </svg>

      {/* Center Percentage Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`${size < 100 ? 'text-base font-black' : 'text-2xl font-extrabold'} text-emerald-950 tracking-tight leading-none`}>
          {numericVal !== null ? `${Math.round(numericVal * 10) / 10}%` : '--'}
        </span>
        {size >= 90 && statusText && (
          <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 max-w-[85%] truncate text-center ${statusColor}`}>
            {statusText}
          </span>
        )}
      </div>
    </div>
  );

  if (bare) {
    return ringElement;
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white/80 backdrop-blur-sm rounded-3xl shadow-neumorphic border border-white/60">
      {ringElement}
      {label && <p className="mt-2 text-xs font-semibold text-emerald-800 text-center">{label}</p>}
    </div>
  );
}
