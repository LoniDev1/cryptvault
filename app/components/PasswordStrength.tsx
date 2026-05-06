'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { call } from '../lib/store';

interface Report {
  score: number;
  entropy_bits: number;
  label: string;
  suggestions: string[];
}

const colors = ['#ff4d6d', '#f59e0b', '#eab308', '#22c55e', '#22d3ee'];

export function PasswordStrength({ password }: { password: string }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let cancel = false;
    if (!password) {
      setReport(null);
      return;
    }
    (async () => {
      try {
        const r = await call<Report>('password_strength', { password });
        if (!cancel) setReport(r);
      } catch {
        const len = password.length;
        const pool = 80;
        const e = len * Math.log2(pool);
        if (!cancel) {
          setReport({
            score: Math.min(5, Math.max(1, Math.floor(e / 24))),
            entropy_bits: e,
            label: e > 90 ? 'very strong' : e > 60 ? 'strong' : e > 40 ? 'fair' : 'weak',
            suggestions: [],
          });
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [password]);

  if (!password) return null;
  const score = report?.score ?? 1;
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0, opacity: 0.3 }}
            animate={{ scaleX: i <= score ? 1 : 0.2, opacity: i <= score ? 1 : 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="h-1.5 flex-1 origin-left rounded-full"
            style={{ background: i <= score ? colors[score - 1] : '#1c2030' }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted capitalize">{report?.label ?? ''}</span>
        <span className="text-muted">{report ? `${report.entropy_bits.toFixed(0)} bits` : ''}</span>
      </div>
      {report?.suggestions && report.suggestions.length > 0 && (
        <ul className="mt-1 text-[11px] text-muted space-y-0.5">
          {report.suggestions.map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
