import React from 'react';
import { motion } from 'framer-motion';
import { Droplet } from 'lucide-react';

export default function WaterTankGauge({ capacity = 10000, current = 8500, label = "Reservoir Level" }) {
  const percentage = Math.round((current / capacity) * 100);

  return (
    <div className="bg-surface-card p-5 rounded-2xl border border-surface-border shadow-soft-glow hover:shadow-lift transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Droplet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-forest">{label}</h4>
            <p className="text-xs text-gray-500">{current.toLocaleString()} L / {capacity.toLocaleString()} L</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
          {percentage}% Full
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full bg-gray-100 rounded-xl h-5 overflow-hidden p-0.5 border border-gray-200 relative">
        <motion.div
          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-lg relative overflow-hidden"
          initial={{ width: "0%" }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          {/* Subtle water wave effect */}
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </motion.div>
      </div>

      <div className="flex justify-between items-center mt-2.5 text-xs text-gray-500 font-medium">
        <span>Min Reserve: 2,000 L</span>
        <span className="text-emerald-700 font-bold">Est. 12 days capacity</span>
      </div>
    </div>
  );
}
