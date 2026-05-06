'use client';

import { motion } from 'framer-motion';

export function Splash() {
  const path = 'M30 4 L52 14 L52 30 C52 44 42 54 30 58 C18 54 8 44 8 30 L8 14 Z';
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <div className="flex flex-col items-center gap-6">
        <svg width="120" height="120" viewBox="0 0 60 60" className="overflow-visible">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <motion.path
            d={path}
            fill="none"
            stroke="url(#g)"
            strokeWidth={1.6}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="30"
            cy="32"
            r="6"
            fill="url(#g)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5, ease: 'backOut' }}
          />
        </svg>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="gradient-text text-2xl font-semibold tracking-wide"
        >
          CryptVault
        </motion.div>
        <motion.div
          className="h-[2px] w-40 overflow-hidden rounded-full bg-line"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <motion.div
            className="h-full w-1/3"
            style={{ background: 'linear-gradient(90deg,#7c5cff,#22d3ee)' }}
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
