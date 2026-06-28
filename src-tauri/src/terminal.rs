//! 终端进程管理
//!
//! 使用标准输入输出管道与 shell 进程通信。
//! 输出通过 Tauri event 推送，输入通过 Tauri command 发送到 stdin channel。

#![forbid(unsafe_code)]

use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

/// 终端输出事件
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputPayload {
    pub data: String,
}

/// 终端输入发送器
type StdinSender = Arc<Mutex<Option<Sender<String>>>>;

/// 启动终端 shell
pub fn start_terminal(app: &AppHandle) -> Result<(), String> {
    // 先停止已有终端
    if let Some(state) = app.try_state::<StdinSender>() {
        *state.lock().unwrap() = None;
    }

    let shell = if cfg!(windows) { "cmd.exe" } else { "/bin/bash" };

    let mut child = Command::new(shell)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn shell: {}", e))?;

    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // 创建输入 channel
    let (tx, rx) = mpsc::channel::<String>();

    // 线程：写 stdin（从 channel 接收数据并写入进程）
    std::thread::spawn(move || {
        while let Ok(data) = rx.recv() {
            let _ = stdin.write_all(data.as_bytes());
            let _ = stdin.flush();
        }
    });

    // 存储发送器到 app state
    if app.try_state::<StdinSender>().is_none() {
        app.manage(StdinSender::default());
    }
    {
        let state = app.state::<StdinSender>();
        *state.lock().unwrap() = Some(tx);
    }

    // 线程：读 stdout → 推送事件
    {
        let app = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app.emit(
                        "rustdroid://terminal_output",
                        &TerminalOutputPayload { data: format!("{}\r\n", line) },
                    );
                }
            }
        });
    }

    // 线程：读 stderr → 推送事件（红色）
    {
        let app = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app.emit(
                        "rustdroid://terminal_output",
                        &TerminalOutputPayload { data: format!("\x1b[91m{}\x1b[0m\r\n", line) },
                    );
                }
            }
        });
    }

    // 分离子进程（防止僵尸进程）
    let _ = child.wait();

    tracing::info!("terminal started");
    Ok(())
}

/// 停止终端
pub fn stop_terminal(app: &AppHandle) {
    if let Some(state) = app.try_state::<StdinSender>() {
        *state.lock().unwrap() = None;
    }
    tracing::info!("terminal stopped");
}

/// 发送输入到终端
#[tauri::command]
pub fn terminal_write(app: AppHandle, data: String) -> Result<(), String> {
    let state = app.state::<StdinSender>();
    let guard = state.lock().unwrap();
    if let Some(tx) = guard.as_ref() {
        tx.send(data).map_err(|e| format!("terminal send error: {}", e))
    } else {
        Err("terminal not running".into())
    }
}

/// 启动终端命令
#[tauri::command]
pub fn terminal_start(app: AppHandle) -> Result<(), String> {
    start_terminal(&app)
}

/// 停止终端命令
#[tauri::command]
pub fn terminal_stop(app: AppHandle) -> Result<(), String> {
    stop_terminal(&app);
    Ok(())
}
