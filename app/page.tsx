'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedBackground } from './components/AnimatedBackground';
import { Sidebar, type View } from './components/Sidebar';
import { CreateVolume } from './components/CreateVolume';
import { MountVolume } from './components/MountVolume';
import { VaultBrowser } from './components/VaultBrowser';
import { EncryptFiles } from './components/EncryptFiles';
import { Settings } from './components/Settings';
import { Splash } from './components/Splash';
import { Titlebar } from './components/Titlebar';
import { useAppStore } from './lib/store';

const views: Record<View, { title: string; sub: string; node: React.ReactNode }> = {
  vault: { title: 'Vault', sub: 'Mounted volumes and entries', node: <VaultBrowser /> },
  create: { title: 'Create volume', sub: 'Build a new encrypted container', node: <CreateVolume /> },
  mount: { title: 'Mount volume', sub: 'Unlock an existing container', node: <MountVolume /> },
  files: { title: 'Encrypt files', sub: 'One-shot file and folder encryption', node: <EncryptFiles /> },
  settings: { title: 'Settings', sub: 'Algorithms, KDF and benchmarks', node: <Settings /> },
};

export default function Page() {
  const [view, setView] = useState<View>('vault');
  const [booted, setBooted] = useState(false);
  const refresh = useAppStore((s) => s.refreshMounts);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1400);
    refresh().catch(() => {});
    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col">
      <Titlebar title="CryptVault" />
      <div className="relative flex-1 overflow-hidden">
      <AnimatedBackground />
      <AnimatePresence>{!booted && <Splash key="splash" />}</AnimatePresence>

      <div className="relative z-10 grid h-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <Sidebar view={view} onChange={setView} />
        <main className="relative h-full overflow-hidden">
          <Header title={views[view].title} sub={views[view].sub} />
          <div className="h-[calc(100%-92px)] overflow-y-auto px-8 pb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {views[view].node}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-end justify-between px-8 pt-8 pb-6">
      <div>
        <motion.h1
          key={title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-semibold tracking-tight gradient-text"
        >
          {title}
        </motion.h1>
        <motion.p
          key={sub}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-sm text-muted mt-1"
        >
          {sub}
        </motion.p>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 text-xs text-muted"
      >
        <span className="size-2 rounded-full bg-ok animate-pulse" /> secure session
      </motion.div>
    </div>
  );
}
