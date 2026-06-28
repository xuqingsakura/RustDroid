import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

export function TerminalTab() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

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

    terminalRef.current = term;

    // 启动后端终端
    invoke('terminal_start').catch((e) => {
      term.write(`\x1b[91m终端启动失败: ${e}\x1b[0m\r\n`);
      // 降级到本地回显模式
      setupLocalEcho(term);
    });

    // 监听后端输出
    listen<TerminalOutputEvent>('rustdroid://terminal_output', (event) => {
      term.write(event.payload.data);
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    // 键盘输入 → 发送到后端
    term.onData((data) => {
      invoke('terminal_write', { data }).catch(() => {
        // 后端未运行，忽略（本地回显模式使用自己的处理）
      });
    });

    // Resize 处理
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
      invoke('terminal_stop').catch(() => {});
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  return <div ref={containerRef} className="terminal-container" />;
}

interface TerminalOutputEvent {
  payload: {
    data: string;
  };
}

/** 本地回显模式（后端终端不可用时的降级方案） */
function setupLocalEcho(term: Terminal) {
  term.write('RustDroid IDE 终端 (本地回显模式)\r\n');

  let currentLine = '';
  term.onData((data) => {
    if (data === '\r') {
      term.write('\r\n');
      if (currentLine.trim() === 'clear') {
        term.clear();
      } else if (currentLine.trim()) {
        term.write(`\x1b[90m[本地回显] ${currentLine}\x1b[0m\r\n`);
      }
      term.write('$ ');
      currentLine = '';
    } else if (data === '\x7f') {
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
        term.write('\b \b');
      }
    } else if (data === '\x03') {
      term.write('^C\r\n$ ');
      currentLine = '';
    } else if (data === '\t') {
      // Tab 补全：简单尝试匹配命令
      const candidates = ['clear', 'help', 'exit', 'echo '].filter((c) =>
        c.startsWith(currentLine)
      );
      if (candidates.length === 1) {
        const rest = candidates[0].slice(currentLine.length);
        term.write(rest);
        currentLine = candidates[0];
      }
    } else {
      currentLine += data;
      term.write(data);
    }
  });
}
