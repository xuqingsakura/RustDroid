import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { getVersion } from './api/app';

export default function App() {
  const { version, setVersion, theme } = useAppStore();

  useEffect(() => {
    getVersion().then(setVersion).catch((e) => console.error('getVersion failed:', e));
  }, [setVersion]);

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <h1>RustDroid IDE</h1>
        <span className="version">v{version}</span>
      </header>
      <main className="app-main">
        <p className="hero-text">
          Phase 1 · Sprint 1-1 骨架已就绪
        </p>
        <p className="hero-sub">Tauri + React 19 + Zustand 5 + Rust workspace</p>
      </main>
      <footer className="app-footer">
        <span>Apache-2.0</span>
        <span>·</span>
        <span>RustDroid IDE</span>
      </footer>
    </div>
  );
}
