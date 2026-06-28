import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalTab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#0f1117',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selectionBackground: '#3b4261',
        black: '#1d1f2b',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#c0caf5',
        brightBlack: '#3b4261',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.write('RustDroid IDE 终端\r\n');
    term.write('$ ');

    let currentLine = '';
    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n');
        if (currentLine.trim() === 'clear') {
          term.clear();
        } else if (currentLine.trim()) {
          term.write(`\x1b[90m[已执行]\x1b[0m ${currentLine}\r\n`);
        }
        term.write('$ ');
        currentLine = '';
      } else if (data === '\x7f') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '') {
        term.write('^C\r\n$ ');
        currentLine = '';
      } else {
        currentLine += data;
        term.write(data);
      }
    });

    terminalRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} className="terminal-container" />;
}
