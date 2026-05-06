'use client';

import { motion } from 'framer-motion';
import { Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Win = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResize: (cb: () => void) => () => void;
};

async function loadWindow(): Promise<Win | null> {
  if (typeof window === 'undefined') return null;
  // @ts-ignore
  if (!('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window)) return null;
  try {
    const mod = await import('@tauri-apps/api/window');
    const w = mod.getCurrentWindow();
    return {
      minimize: () => w.minimize(),
      toggleMaximize: () => w.toggleMaximize(),
      close: () => w.close(),
      isMaximized: () => w.isMaximized(),
      onResize: (cb) => {
        const unlisten = w.onResized(() => cb());
        return () => {
          unlisten.then((u) => u());
        };
      },
    };
  } catch {
    return null;
  }
}

export function Titlebar({ title = 'CryptVault' }: { title?: string }) {
  const [win, setWin] = useState<Win | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cleanup = () => {};
    loadWindow().then((w) => {
      setWin(w);
      if (w) {
        w.isMaximized().then(setMaximized);
        cleanup = w.onResize(() => w.isMaximized().then(setMaximized));
      }
    });
    return () => cleanup();
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="titlebar relative z-50 flex h-9 items-center justify-between border-b border-line/60 bg-panel/60 backdrop-blur-xl select-none"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 pl-3">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="size-4 rounded-sm"
          style={{ background: 'linear-gradient(135deg,#7c5cff,#22d3ee)' }}
        />
        <span data-tauri-drag-region className="text-[11px] font-medium tracking-wider text-muted/80">
          {title}
        </span>
      </div>

      <div className="flex h-full">
        <CtlBtn onClick={() => win?.minimize()} aria-label="minimize">
          <Minus size={12} />
        </CtlBtn>
        <CtlBtn onClick={() => win?.toggleMaximize()} aria-label="maximize">
          <Square size={10} />
        </CtlBtn>
        <CtlBtn onClick={() => win?.close()} aria-label="close" danger>
          <X size={12} />
        </CtlBtn>
      </div>
    </div>
  );
}

function CtlBtn({
  children,
  onClick,
  danger,
  'aria-label': ariaLabel,
}: { children: React.ReactNode; onClick?: () => void; danger?: boolean; 'aria-label'?: string }) {
  return (
    <motion.button
      whileHover={{ backgroundColor: danger ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.07)' }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid h-full w-11 place-items-center text-muted transition-colors hover:text-text"
    >
      {children}
    </motion.button>
  );
}
