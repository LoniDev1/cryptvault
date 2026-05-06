'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { FileLock2, FileKey } from 'lucide-react';
import { Card, Field } from './Field';
import { Button } from './Button';
import { PasswordStrength } from './PasswordStrength';
import { call, type KdfMode } from '../lib/store';

export function EncryptFiles() {
  const [tab, setTab] = useState<'enc' | 'dec'>('enc');
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 inline-flex rounded-xl glass p-1">
        {(['enc', 'dec'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative rounded-lg px-4 py-2 text-sm"
          >
            {tab === t && (
              <motion.span
                layoutId="ftab"
                className="absolute inset-0 rounded-lg"
                style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.25), rgba(34,211,238,0.18))', border: '1px solid rgba(124,92,255,0.35)' }}
              />
            )}
            <span className="relative">{t === 'enc' ? 'Encrypt' : 'Decrypt'}</span>
          </button>
        ))}
      </div>
      {tab === 'enc' ? <EncryptPanel /> : <DecryptPanel />}
    </div>
  );
}

function EncryptPanel() {
  const [path, setPath] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<KdfMode>('Strong');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const choose = async () => {
    const p = await open({ multiple: false });
    if (typeof p === 'string') setPath(p);
  };
  const chooseDir = async () => {
    const p = await open({ directory: true, multiple: false });
    if (typeof p === 'string') setPath(p);
  };

  const submit = async () => {
    setErr(null); setResult(null);
    if (!path) return setErr('select a file or folder');
    if (pw.length < 8) return setErr('password too short');
    if (pw !== confirm) return setErr('passwords do not match');
    setBusy(true);
    try {
      const out = await call<string>('encrypt_path', { path, password: pw, kdfMode: mode });
      setResult(out);
      setPw(''); setConfirm('');
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <FileLock2 size={16} className="text-accent2" />
        <h2 className="text-base font-semibold">Encrypt file or folder</h2>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <Field label="Source" value={path} onChange={setPath} placeholder="path to file or folder" />
          <Button variant="ghost" onClick={choose}>File</Button>
          <Button variant="ghost" onClick={chooseDir}>Folder</Button>
        </div>
        <Field label="Passphrase" value={pw} onChange={setPw} type="password" />
        <PasswordStrength password={pw} />
        <Field label="Confirm passphrase" value={confirm} onChange={setConfirm} type="password" />

        <KdfPicker value={mode} onChange={setMode} />

        <div className="flex items-center justify-end">
          <Button onClick={submit} loading={busy}>{busy ? 'Encrypting…' : 'Encrypt'}</Button>
        </div>
        {err && <div className="text-xs text-danger">{err}</div>}
        {result && <div className="text-xs text-ok">written: {result}</div>}
      </div>
    </Card>
  );
}

function DecryptPanel() {
  const [path, setPath] = useState('');
  const [outDir, setOutDir] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const choose = async () => {
    const p = await open({ multiple: false, filters: [{ name: 'CryptVault', extensions: ['cv'] }] });
    if (typeof p === 'string') setPath(p);
  };
  const chooseOut = async () => {
    const p = await open({ directory: true, multiple: false });
    if (typeof p === 'string') setOutDir(p);
  };

  const submit = async () => {
    setErr(null); setResult(null);
    if (!path || !outDir) return setErr('select source and destination');
    setBusy(true);
    try {
      const out = await call<string>('decrypt_path', { path, password: pw, outDir });
      setResult(out);
      setPw('');
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <FileKey size={16} className="text-accent2" />
        <h2 className="text-base font-semibold">Decrypt .cv file</h2>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Encrypted file" value={path} onChange={setPath} placeholder=".cv" />
          <Button variant="ghost" onClick={choose}>Browse</Button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Output folder" value={outDir} onChange={setOutDir} />
          <Button variant="ghost" onClick={chooseOut}>Browse</Button>
        </div>
        <Field label="Passphrase" value={pw} onChange={setPw} type="password" />
        <div className="flex items-center justify-end">
          <Button onClick={submit} loading={busy}>{busy ? 'Decrypting…' : 'Decrypt'}</Button>
        </div>
        {err && <div className="text-xs text-danger">{err}</div>}
        {result && <div className="text-xs text-ok">restored: {result}</div>}
      </div>
    </Card>
  );
}

function KdfPicker({ value, onChange }: { value: KdfMode; onChange: (v: KdfMode) => void }) {
  const opts: KdfMode[] = ['Fast', 'Strong', 'Paranoid'];
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted mb-2">KDF strength</div>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <motion.button
            key={o}
            whileHover={{ y: -1 }}
            onClick={() => onChange(o)}
            className={`relative rounded-lg border px-3 py-2 text-sm ${
              value === o ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel/60 hover:bg-panel'
            }`}
          >
            {o}
            {value === o && (
              <motion.span layoutId="kdf-pick-files" className="absolute inset-0 rounded-lg ring-1 ring-accent/60" />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
