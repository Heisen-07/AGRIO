import React from 'react';
import { motion } from 'framer-motion';

export default function SoilMoistureRing({ 
  percentage = 68, 
  size = 120, 
  strokeWidth = 10, 
  label = "Soil Moisture",
  bare = false 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

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
          stroke="#D1FAE5"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Value Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#059669"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Center Percentage Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${size < 100 ? 'text-base font-black' : 'text-2xl font-extrabold'} text-emerald-950 tracking-tight leading-none`}>
          {percentage}%
        </span>
        {size >= 90 && (
          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">
            Optimal
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
