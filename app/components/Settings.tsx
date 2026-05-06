'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Card } from './Field';
import { Button } from './Button';
import { call, type KdfMode } from '../lib/store';
import { Cpu, GaugeCircle, ShieldCheck } from 'lucide-react';

interface AppInfo {
  name: string;
  version: string;
  algorithms: string[];
  kdf: string;
}

export function Settings() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [bench, setBench] = useState<Record<KdfMode, number | null>>({ Fast: null, Strong: null, Paranoid: null });
  const [busy, setBusy] = useState<KdfMode | null>(null);

  useEffect(() => {
    call<AppInfo>('app_info').then(setInfo).catch(() => setInfo({
      name: 'CryptVault', version: '0.1.0',
      algorithms: ['AES-256-GCM', 'XChaCha20-Poly1305 (cascade)'], kdf: 'Argon2id',
    }));
  }, []);

  const run = async (mode: KdfMode) => {
    setBusy(mode);
    try {
      const ms = await call<number>('benchmark_kdf', { mode });
      setBench((b) => ({ ...b, [mode]: ms }));
    } catch {} finally { setBusy(null); }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-accent2" />
          <h2 className="text-base font-semibold">Crypto stack</h2>
        </div>
        <div className="text-sm space-y-2">
          <Row k="App" v={`${info?.name ?? '—'} ${info?.version ?? ''}`} />
          <Row k="KDF" v={info?.kdf ?? '—'} />
          <Row k="Cipher cascade" v={(info?.algorithms ?? []).join(' → ')} />
          <Row k="Master key length" v="64 bytes (HKDF-SHA-512 split)" />
          <Row k="Header authentication" v="AEAD over volume id (AAD)" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <GaugeCircle size={16} className="text-accent2" />
          <h2 className="text-base font-semibold">KDF benchmark</h2>
        </div>
        <div className="grid gap-2">
          {(['Fast', 'Strong', 'Paranoid'] as KdfMode[]).map((m) => (
            <div key={m} className="flex items-center justify-between rounded-lg border border-line bg-panel/60 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Cpu size={14} className="text-muted" />
                <span className="text-sm font-medium">{m}</span>
                <BenchBar value={bench[m]} />
              </div>
              <Button variant="ghost" onClick={() => run(m)} loading={busy === m}>
                {bench[m] !== null ? `${bench[m]} ms` : 'Run'}
              </Button>
            </div>
          ))}
          <div className="text-[11px] text-muted mt-1">
            Higher cost slows brute-force attempts proportionally. Pick the strongest you can tolerate.
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line/70 bg-panel/40 px-3 py-2">
      <span className="text-muted text-xs uppercase tracking-wider">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

function BenchBar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(100, Math.max(2, (value / 6000) * 100));
  return (
    <div className="w-44 overflow-hidden rounded-full bg-line">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="h-1.5"
        style={{ background: 'linear-gradient(90deg,#7c5cff,#22d3ee)' }}
      />
    </div>
  );
}
