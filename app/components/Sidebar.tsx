'use client';

import { motion } from 'framer-motion';
import { Box, FilePlus2, FolderLock, KeyRound, LucideIcon, Settings2, ShieldCheck } from 'lucide-react';

export type View = 'vault' | 'create' | 'mount' | 'files' | 'settings';

const items: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'vault', label: 'Vault', icon: FolderLock },
  { id: 'create', label: 'Create', icon: Box },
  { id: 'mount', label: 'Mount', icon: KeyRound },
  { id: 'files', label: 'Encrypt files', icon: FilePlus2 },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function Sidebar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <aside className="relative h-full border-r border-line/70 bg-panel/40 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <motion.div
          initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="grid size-9 place-items-center rounded-lg glow"
          style={{ background: 'linear-gradient(135deg,#7c5cff,#22d3ee)' }}
        >
          <ShieldCheck size={18} />
        </motion.div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">CryptVault</div>
          <div className="text-[11px] text-muted">v0.1.0</div>
        </div>
      </div>
      <div className="hairline mx-4 my-2" />

      <nav className="px-3 py-3 space-y-1">
        {items.map((it, i) => {
          const active = it.id === view;
          const Icon = it.icon;
          return (
            <motion.button
              key={it.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              onClick={() => onChange(it.id)}
              className="relative w-full overflow-hidden rounded-lg px-3 py-2.5 text-left text-sm"
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(124,92,255,0.18), rgba(34,211,238,0.10))',
                    border: '1px solid rgba(124,92,255,0.28)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-3">
                <span className={active ? 'text-white' : 'text-muted'}>
                  <Icon size={16} />
                </span>
                <span className={active ? 'text-white' : 'text-muted'}>{it.label}</span>
              </span>
            </motion.button>
          );
        })}
      </nav>

      <div className="absolute inset-x-4 bottom-5">
        <div className="rounded-xl glass p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">cipher cascade</div>
          <div className="text-xs leading-snug">
            AES-256-GCM <span className="text-muted">→</span> XChaCha20-Poly1305
          </div>
          <div className="mt-2 text-[11px] text-muted">Argon2id key derivation</div>
        </div>
      </div>
    </aside>
  );
}
