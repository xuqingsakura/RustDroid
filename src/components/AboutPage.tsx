import './AboutPage.css';

interface AboutPageProps {
  version: string;
  onClose: () => void;
}

const TECH_STACK = [
  { name: 'Tauri', version: '2.x', desc: '桌面应用框架' },
  { name: 'React', version: '19.x', desc: 'UI 框架' },
  { name: 'Rust', version: '2021 ed.', desc: '后端/核心逻辑' },
  { name: 'Monaco Editor', version: '0.55', desc: '代码编辑器' },
  { name: 'ropey', version: '1.6', desc: '文档模型' },
  { name: 'Zustand', version: '5.x', desc: '状态管理' },
];

export function AboutPage({ version, onClose }: AboutPageProps) {
  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-panel" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={onClose}>×</button>

        <div className="about-hero">
          <h1 className="about-title">RustDroid</h1>
          <p className="about-version">v{version}</p>
          <p className="about-subtitle">轻量级 Android IDE</p>
        </div>

        <div className="about-info">
          <p className="about-license">开源许可 · Apache-2.0</p>
          <div className="about-links">
            <a href="#" onClick={(e) => e.preventDefault()}>源代码</a>
            <span className="about-link-sep">·</span>
            <a href="#" onClick={(e) => e.preventDefault()}>文档</a>
            <span className="about-link-sep">·</span>
            <a href="#" onClick={(e) => e.preventDefault()}>更新</a>
            <span className="about-link-sep">·</span>
            <a href="#" onClick={(e) => e.preventDefault()}>反馈</a>
          </div>
        </div>

        <div className="about-tech">
          <h3>技术栈</h3>
          <div className="about-tech-grid">
            {TECH_STACK.map((t) => (
              <div key={t.name} className="about-tech-item">
                <span className="about-tech-name">{t.name}</span>
                <span className="about-tech-version">{t.version}</span>
                <span className="about-tech-desc">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="about-footer">RustDroid IDE © 2026 · Apache-2.0</p>
      </div>
    </div>
  );
}
