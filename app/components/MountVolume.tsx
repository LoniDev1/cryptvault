'use client';

import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { motion } from 'framer-motion';
import { Card, Field } from './Field';
import { Button } from './Button';
import { call, useAppStore, type MountSummary } from '../lib/store';
import { KeyRound, Lock } from 'lucide-react';

export function MountVolume() {
  const [path, setPath] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const refresh = useAppStore((s) => s.refreshMounts);
  const setActive = useAppStore((s) => s.setActive);

  const choose = async () => {
    const p = await open({ filters: [{ name: 'CryptVault', extensions: ['cv'] }], multiple: false });
    if (typeof p === 'string') setPath(p);
  };

  const submit = async () => {
    setMsg(null);
    if (!path || !pw) return setMsg({ kind: 'err', text: 'path and passphrase required' });
    setBusy(true);
    try {
      const m = await call<MountSummary>('mount_volume', { path, password: pw });
      await refresh();
      setActive(m.id);
      setPw('');
      setMsg({ kind: 'ok', text: `mounted ${m.label}` });
    } catch (e) {
      setMsg({ kind: 'err', text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-accent2" />
          <h2 className="text-base font-semibold">Mount existing volume</h2>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="Container file" value={path} onChange={setPath} placeholder=".cv file" />
            <Button variant="ghost" onClick={choose}>Browse</Button>
          </div>
          <Field label="Passphrase" value={pw} onChange={setPw} type="password" />
          <div className="flex items-center justify-end">
            <Button onClick={submit} loading={busy}>{busy ? 'Unlocking…' : 'Unlock'}</Button>
          </div>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs ${msg.kind === 'ok' ? 'text-ok' : 'text-danger'}`}
            >
              {msg.text}
            </motion.div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-3">Lock animation</h3>
        <LockGraphic active={busy} />
      </Card>
    </div>
  );
}

function LockGraphic({ active }: { active: boolean }) {
  return (
    <div className="grid h-44 place-items-center">
      <motion.div
        className="grid place-items-center size-24 rounded-2xl"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(124,92,255,0.4), rgba(34,211,238,0.4), rgba(124,92,255,0.4))',
        }}
        animate={{ rotate: active ? 360 : 0 }}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: 'linear' }}
      >
        <div className="grid place-items-center size-20 rounded-2xl bg-panel border border-line">
          <motion.div
            animate={{ y: active ? [0, -3, 0] : 0 }}
            transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
          >
            <Lock size={28} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
