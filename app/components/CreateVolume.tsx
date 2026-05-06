'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Card, Field } from './Field';
import { Button } from './Button';
import { PasswordStrength } from './PasswordStrength';
import { call, type KdfMode } from '../lib/store';
import { Sparkles, FileKey2 } from 'lucide-react';

const modes: { id: KdfMode; title: string; sub: string }[] = [
  { id: 'Fast', title: 'Fast', sub: '64 MiB · 3 iters' },
  { id: 'Strong', title: 'Strong', sub: '256 MiB · 8 iters' },
  { id: 'Paranoid', title: 'Paranoid', sub: '1 GiB · 12 iters' },
];

export function CreateVolume() {
  const [path, setPath] = useState('');
  const [label, setLabel] = useState('My Vault');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [size, setSize] = useState('64');
  const [mode, setMode] = useState<KdfMode>('Strong');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const choosePath = async () => {
    const p = await save({
      defaultPath: 'vault.cv',
      filters: [{ name: 'CryptVault', extensions: ['cv'] }],
    });
    if (p) setPath(p);
  };

  const generate = async () => {
    try {
      const phrase = await call<string>('generate_passphrase', { words: 6 });
      setPw(phrase);
      setConfirm(phrase);
    } catch {}
  };

  const submit = async () => {
    setMsg(null);
    if (!path) return setMsg({ kind: 'err', text: 'choose a destination file' });
    if (pw.length < 8) return setMsg({ kind: 'err', text: 'password must be at least 8 characters' });
    if (pw !== confirm) return setMsg({ kind: 'err', text: 'passwords do not match' });
    setBusy(true);
    try {
      await call('create_volume', {
        path,
        label,
        password: pw,
        kdfMode: mode,
        sizeMb: Number(size) || 0,
      });
      setMsg({ kind: 'ok', text: 'volume created' });
      setPw('');
      setConfirm('');
    } catch (e) {
      setMsg({ kind: 'err', text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <FileKey2 size={16} className="text-accent2" />
          <h2 className="text-base font-semibold">New encrypted container</h2>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="Destination" value={path} onChange={setPath} placeholder="/path/to/vault.cv" />
            <Button variant="ghost" onClick={choosePath}>Browse</Button>
          </div>
          <Field label="Label" value={label} onChange={setLabel} placeholder="My Vault" />
          <Field
            label="Container size (MB)"
            value={size}
            onChange={setSize}
            type="number"
            hint="0 to grow on demand"
          />

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="Passphrase" value={pw} onChange={setPw} type="password" placeholder="•••••••••••" />
            <Button variant="ghost" onClick={generate}>
              <Sparkles size={14} /> Generate
            </Button>
          </div>
          <PasswordStrength password={pw} />
          <Field label="Confirm passphrase" value={confirm} onChange={setConfirm} type="password" />

          <div>
            <div className="text-xs uppercase tracking-wider text-muted mb-2">KDF strength</div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMode(m.id)}
                  className={`relative rounded-lg border px-3 py-3 text-left transition-colors ${
                    mode === m.id ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel/60 hover:bg-panel'
                  }`}
                >
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-[11px] text-muted">{m.sub}</div>
                  {mode === m.id && (
                    <motion.div
                      layoutId="kdf-pick"
                      className="absolute inset-0 rounded-lg ring-1 ring-accent/60"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-muted">Cascade: AES-256-GCM → XChaCha20-Poly1305</div>
            <Button onClick={submit} loading={busy}>{busy ? 'Forging…' : 'Create volume'}</Button>
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
        <h3 className="text-sm font-semibold mb-3">How it works</h3>
        <Pipeline />
        <ul className="mt-4 text-xs text-muted space-y-1.5">
          <li>• Argon2id derives a 64-byte master key from your passphrase</li>
          <li>• HKDF-SHA-512 splits it into AES and XChaCha keys</li>
          <li>• Data is encrypted twice with independent nonces and AAD</li>
          <li>• Headers are authenticated and tampering is detected</li>
        </ul>
      </Card>
    </div>
  );
}

function Pipeline() {
  const steps = ['passphrase', 'argon2id', 'hkdf-sha512', 'aes-256-gcm', 'xchacha20', 'sealed'];
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-line bg-panel/40">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lg" x1="0" x2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M20 100 C 120 20, 220 180, 320 100 S 520 20, 580 100"
          stroke="url(#lg)"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
        {[0.05, 0.25, 0.45, 0.65, 0.85].map((t, i) => (
          <motion.circle
            key={i}
            r="3"
            fill="#22d3ee"
            initial={{ offsetDistance: '0%' as any, opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3, delay: t * 2, repeat: Infinity }}
            style={{
              offsetPath: "path('M20 100 C 120 20, 220 180, 320 100 S 520 20, 580 100')" as any,
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-end justify-between px-4 pb-3 text-[10px] uppercase tracking-wider text-muted">
        {steps.map((s, i) => (
          <motion.span
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
          >
            {s}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
