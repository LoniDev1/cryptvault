'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Download, FilePlus2, FolderOpen, Trash2, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from './Field';
import { Button } from './Button';
import { call, fmtBytes, useAppStore, type EntryInfo } from '../lib/store';

export function VaultBrowser() {
  const mounts = useAppStore((s) => s.mounts);
  const active = useAppStore((s) => s.activeMountId);
  const setActive = useAppStore((s) => s.setActive);
  const unmount = useAppStore((s) => s.unmount);
  const refresh = useAppStore((s) => s.refreshMounts);
  const [entries, setEntries] = useState<EntryInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    (async () => {
      try {
        const list = await call<EntryInfo[]>('list_mount_entries', { id: active });
        setEntries(list);
      } catch {
        setEntries([]);
      }
    })();
  }, [active, mounts]);

  const addFiles = async () => {
    if (!active) return;
    const sel = await open({ multiple: true });
    const arr = Array.isArray(sel) ? sel : sel ? [sel] : [];
    if (!arr.length) return;
    setBusy(true);
    try {
      await call('add_files_to_mount', { id: active, files: arr });
      await refresh();
      const list = await call<EntryInfo[]>('list_mount_entries', { id: active });
      setEntries(list);
    } finally {
      setBusy(false);
    }
  };

  const extract = async (entryId: string) => {
    if (!active) return;
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir !== 'string') return;
    await call('extract_entry', { id: active, entryId, outDir: dir });
  };

  const remove = async (entryId: string) => {
    if (!active) return;
    await call('delete_entry', { id: active, entryId });
    const list = await call<EntryInfo[]>('list_mount_entries', { id: active });
    setEntries(list);
    await refresh();
  };

  if (!mounts.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="!p-3">
        <div className="px-2 pt-1 pb-2 text-[11px] uppercase tracking-wider text-muted">Mounted</div>
        <div className="space-y-1">
          {mounts.map((m) => (
            <motion.button
              key={m.id}
              onClick={() => setActive(m.id)}
              whileHover={{ x: 2 }}
              className={`relative w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                active === m.id ? 'bg-white/5' : 'hover:bg-white/5'
              }`}
            >
              {active === m.id && (
                <motion.span
                  layoutId="mount-active"
                  className="absolute inset-y-0 left-0 w-[3px] rounded-r"
                  style={{ background: 'linear-gradient(180deg,#7c5cff,#22d3ee)' }}
                />
              )}
              <div className="font-medium">{m.label}</div>
              <div className="text-[11px] text-muted truncate">{m.path}</div>
              <div className="mt-1 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted">
                <span>{m.entry_count} items</span>
                <span>{m.kdf_mode}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Entries</h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={addFiles} loading={busy}>
              <FilePlus2 size={14} /> Add files
            </Button>
            {active && (
              <Button variant="danger" onClick={() => unmount(active)}>
                <Unplug size={14} /> Unmount
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[1fr_120px_180px_120px] bg-panel/70 px-4 py-2 text-[11px] uppercase tracking-wider text-muted">
            <span>Name</span>
            <span>Size</span>
            <span>Added</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid grid-cols-[1fr_120px_180px_120px] items-center gap-2 border-t border-line/70 px-4 py-2.5 text-sm hover:bg-white/[0.03]"
                >
                  <span className="truncate">{e.name}</span>
                  <span className="text-muted">{fmtBytes(e.size)}</span>
                  <span className="text-muted">{new Date(e.created_at * 1000).toLocaleString()}</span>
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => extract(e.id)}
                      className="rounded p-1.5 text-muted hover:text-white"
                      title="Extract"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => remove(e.id)}
                      className="rounded p-1.5 text-muted hover:text-danger"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
              {!entries.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  no entries yet — add files to begin
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center py-20">
      <Card className="max-w-md text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl glow"
          style={{ background: 'linear-gradient(135deg,#7c5cff,#22d3ee)' }}
        >
          <FolderOpen size={26} />
        </motion.div>
        <h3 className="text-lg font-semibold">No volumes mounted</h3>
        <p className="text-sm text-muted mt-1">Create a new volume or mount an existing one to get started.</p>
      </Card>
    </div>
  );
}
