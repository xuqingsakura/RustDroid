import { useState } from 'react';
import { TerminalTab } from './TerminalTab';
import { ProblemsTab } from './ProblemsTab';
import { OutputTab } from './OutputTab';
import './BottomPanel.css';

type PanelTab = 'terminal' | 'problems' | 'output';

interface BottomPanelProps {
  height: number;
  onResize: (height: number) => void;
}

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'terminal', label: '终端' },
  { id: 'problems', label: '问题' },
  { id: 'output', label: '输出' },
];

export function BottomPanel({ height, onResize }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('terminal');
  const [isResizing, setIsResizing] = useState(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.max(80, Math.min(400, startHeight + delta));
      onResize(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="bottom-panel" style={{ height }}>
      <div
        className={`bottom-panel-resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={startResize}
      />
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="bottom-panel-content">
        {activeTab === 'terminal' && <TerminalTab />}
        {activeTab === 'problems' && <ProblemsTab />}
        {activeTab === 'output' && <OutputTab />}
      </div>
    </div>
  );
}
