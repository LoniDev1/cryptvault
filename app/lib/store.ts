import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type KdfMode = 'Fast' | 'Strong' | 'Paranoid';

export interface MountSummary {
  id: string;
  label: string;
  path: string;
  entry_count: number;
  kdf_mode: KdfMode;
}

export interface EntryInfo {
  id: string;
  name: string;
  size: number;
  created_at: number;
  data_b64: string;
}

interface AppState {
  mounts: MountSummary[];
  activeMountId: string | null;
  setActive: (id: string | null) => void;
  refreshMounts: () => Promise<void>;
  unmount: (id: string) => Promise<void>;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error('Tauri runtime unavailable');
  }
  return invoke<T>(cmd, args);
}

export const useAppStore = create<AppState>((set, get) => ({
  mounts: [],
  activeMountId: null,
  setActive: (id) => set({ activeMountId: id }),
  refreshMounts: async () => {
    if (!isTauri) return;
    try {
      const mounts = await call<MountSummary[]>('list_mounts');
      set({ mounts });
      if (!get().activeMountId && mounts[0]) {
        set({ activeMountId: mounts[0].id });
      }
    } catch {}
  },
  unmount: async (id) => {
    await call('unmount_volume', { id });
    const mounts = get().mounts.filter((m) => m.id !== id);
    set({ mounts, activeMountId: mounts[0]?.id ?? null });
  },
}));

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}
