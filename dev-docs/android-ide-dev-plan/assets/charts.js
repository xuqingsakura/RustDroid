// assets/charts.js — 纯 CSS 甘特图 + Mermaid 初始化
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var green = style.getPropertyValue('--green').trim();
  var orange = style.getPropertyValue('--orange').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var bg3 = style.getPropertyValue('--bg3').trim();

  // --- 注入甘特图 CSS ---
  var css = document.createElement('style');
  css.textContent = [
    '.gantt-chart{font-family:"Noto Sans SC",sans-serif;font-size:12px;}',
    '.gantt-grid{display:flex;flex-direction:column;gap:0;}',
    '.gantt-months-row{display:flex;align-items:center;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid ' + rule + ';}',
    '.gantt-label-col{width:150px;flex-shrink:0;}',
    '.gantt-months{flex:1;display:grid;grid-template-columns:repeat(26,1fr);}',
    '.gantt-month{text-align:center;color:' + muted + ';font-size:10px;font-family:"JetBrains Mono",monospace;}',
    '.gantt-row{display:flex;align-items:center;height:22px;margin-bottom:2px;}',
    '.gantt-row.phase-row{height:26px;margin-top:6px;}',
    '.gantt-label{width:150px;flex-shrink:0;font-size:11px;color:' + ink + ';padding-right:10px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.gantt-row.phase-row .gantt-label{font-weight:700;font-size:12px;color:' + accent + ';}',
    '.gantt-track{flex:1;position:relative;height:100%;background:' + bg2 + ';border-radius:3px;overflow:hidden;}',
    '.gantt-bar{position:absolute;top:3px;bottom:3px;border-radius:3px;cursor:pointer;opacity:0.85;transition:opacity 0.15s;}',
    '.gantt-bar.phase-bar{top:2px;bottom:2px;opacity:0.35;}',
    '.gantt-bar:hover{opacity:1;}',
    '.gantt-tooltip{position:fixed;background:' + bg3 + ';border:1px solid ' + rule + ';border-radius:6px;padding:6px 10px;font-size:12px;color:' + ink + ';pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:none;}'
  ].join('');
  document.head.appendChild(css);

  // --- Gantt Chart (纯 CSS 实现) ---
  var ganttEl = document.getElementById('chart-gantt');
  if (ganttEl) {
    var totalMonths = 26;

    var phases = [
      { name: 'Phase 1: 最小可用编辑器', start: 1, end: 8, color: accent },
      { name: 'Phase 2: 语言支持', start: 9, end: 14, color: accent2 },
      { name: 'Phase 3: Android 特化', start: 15, end: 20, color: green },
      { name: 'Phase 4: 高级功能', start: 21, end: 26, color: orange }
    ];

    var sprints = [
      { name: '1-1 Tauri 骨架', start: 1, end: 1, color: accent },
      { name: '1-2 文件系统', start: 2, end: 2, color: accent },
      { name: '1-3 Monaco 集成', start: 3, end: 4, color: accent },
      { name: '1-4 主题与 UI', start: 5, end: 6, color: accent },
      { name: '1-5 底部面板', start: 7, end: 7, color: accent },
      { name: '1-6 集成测试', start: 8, end: 8, color: accent },
      { name: '2-1 LSP 框架', start: 9, end: 9, color: accent2 },
      { name: '2-2 jdtls 集成', start: 10, end: 11, color: accent2 },
      { name: '2-3 Kotlin LSP', start: 12, end: 12, color: accent2 },
      { name: '2-4 tree-sitter', start: 13, end: 13, color: accent2 },
      { name: '2-5 集成测试', start: 14, end: 14, color: accent2 },
      { name: '3-1 Gradle 构建', start: 15, end: 16, color: green },
      { name: '3-2 ADB 设备', start: 17, end: 17, color: green },
      { name: '3-3 Logcat', start: 18, end: 18, color: green },
      { name: '3-4 项目向导', start: 19, end: 19, color: green },
      { name: '3-5 资源索引', start: 20, end: 20, color: green },
      { name: '4-1 布局预览', start: 21, end: 22, color: orange },
      { name: '4-2 调试器', start: 23, end: 24, color: orange },
      { name: '4-3 全局搜索', start: 25, end: 25, color: orange },
      { name: '4-4 Git 集成', start: 25, end: 25, color: orange },
      { name: '4-5 发布准备', start: 26, end: 26, color: orange }
    ];

    var allItems = phases.concat(sprints);

    // 月份头部
    var monthsHtml = '<div class="gantt-months-row"><div class="gantt-label-col"></div><div class="gantt-months">';
    for (var i = 1; i <= totalMonths; i++) {
      monthsHtml += '<span class="gantt-month">M' + i + '</span>';
    }
    monthsHtml += '</div></div>';

    // 条形行
    var rowsHtml = '';
    allItems.forEach(function(item) {
      var isPhase = item.name.indexOf('Phase') === 0;
      var leftPct = ((item.start - 0.5) / totalMonths) * 100;
      var widthPct = ((item.end - item.start + 1) / totalMonths) * 100;
      var rowClass = isPhase ? 'gantt-row phase-row' : 'gantt-row';
      var barClass = isPhase ? 'gantt-bar phase-bar' : 'gantt-bar';
      var tipText = item.name + ' · 月 ' + item.start + ' - ' + item.end;

      rowsHtml += '<div class="' + rowClass + '">';
      rowsHtml += '<div class="gantt-label">' + item.name + '</div>';
      rowsHtml += '<div class="gantt-track">';
      rowsHtml += '<div class="' + barClass + '" style="left:' + leftPct + '%;width:' + widthPct + '%;background:' + item.color + ';" data-tip="' + tipText + '"></div>';
      rowsHtml += '</div></div>';
    });

    ganttEl.innerHTML = '<div class="gantt-chart"><div class="gantt-grid">' + monthsHtml + rowsHtml + '</div></div>';
    ganttEl.style.minHeight = 'auto';

    // tooltip 交互
    var tooltip = document.createElement('div');
    tooltip.className = 'gantt-tooltip';
    document.body.appendChild(tooltip);

    var bars = ganttEl.querySelectorAll('.gantt-bar');
    bars.forEach(function(bar) {
      bar.addEventListener('mouseenter', function(e) {
        tooltip.textContent = bar.getAttribute('data-tip');
        tooltip.style.display = 'block';
      });
      bar.addEventListener('mousemove', function(e) {
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 30) + 'px';
      });
      bar.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
      });
    });
  }

  // --- Mermaid Init ---
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
  }
})();
