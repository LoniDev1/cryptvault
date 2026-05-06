'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={clsx(
        'relative overflow-hidden rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
        variant === 'primary' &&
          'text-white border border-white/10 bg-gradient-to-br from-[#7c5cff] to-[#5b8cff] hover:brightness-110',
        variant === 'ghost' &&
          'text-white/90 border border-white/10 bg-white/5 hover:bg-white/10',
        variant === 'danger' &&
          'text-white border border-red-400/20 bg-gradient-to-br from-rose-500 to-red-500 hover:brightness-110',
        loading && 'opacity-80 cursor-wait',
        className,
      )}
      disabled={loading || disabled}
      {...(rest as any)}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {variant === 'primary' && (
        <motion.span
          aria-hidden
          className="absolute inset-0 -z-0 opacity-50"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.button>
  );
});
