import React from 'react';
import { motion } from 'framer-motion';
import { Droplet } from 'lucide-react';

export default function WaterTankGauge({ capacity = 10000, current = 8500, label = "Reservoir Level" }) {
  const percentage = Math.round((current / capacity) * 100);

  return (
    <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-neumorphic hover:shadow-neumorphic-lg transition-all w-full min-w-0 border border-white/60">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Droplet className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-emerald-950 truncate">{label}</h4>
            <p className="text-xs text-emerald-700/40 truncate">{current.toLocaleString()} L / {capacity.toLocaleString()} L</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 shrink-0">
          {percentage}% Full
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full bg-emerald-50 rounded-full h-5 overflow-hidden p-0.5 relative">
        <motion.div
          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full relative overflow-hidden"
          initial={{ width: "0%" }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          {/* Subtle water wave effect */}
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </motion.div>
      </div>

      <div className="flex justify-between items-center mt-2.5 text-xs text-emerald-700/40 font-medium">
        <span>Min Reserve: 2,000 L</span>
        <span className="text-emerald-700 font-bold">Est. 12 days capacity</span>
      </div>
    </div>
  );
}
