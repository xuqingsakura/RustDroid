// charts.js — MVP 甘特图 + Mermaid 初始化
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- 甘特图：MVP 四阶段开发路线 ---
  var ganttEl = document.getElementById('chart-gantt');
  if (ganttEl && typeof echarts !== 'undefined') {
    var chart = echarts.init(ganttEl, null, { renderer: 'svg' });

    // 阶段数据：[起始月, 持续月数, 名称, 颜色, 交付物]
    var phases = [
      { name: 'Phase 1: 最小可用编辑器', start: 0, dur: 8, color: '#059669', desc: 'Tauri+React+Monaco+ropey' },
      { name: 'Phase 2: 语言支持', start: 8, dur: 6, color: accent, desc: 'jdtls+Kotlin LSP+tree-sitter' },
      { name: 'Phase 3: Android 特化', start: 14, dur: 6, color: '#d97706', desc: 'Gradle+ADB+Logcat' },
      { name: 'Phase 4: 高级功能', start: 20, dur: 8, color: accent2, desc: '布局预览+调试器+AI' }
    ];

    chart.setOption({
      animation: false,
      tooltip: {
        appendToBody: true,
        formatter: function (p) {
          if (p.seriesIndex === 0) return '';
          var idx = p.dataIndex;
          var ph = phases[idx];
          return '<b>' + ph.name + '</b><br/>' +
            '时间：第 ' + (ph.start + 1) + ' - ' + (ph.start + ph.dur) + ' 月<br/>' +
            '工期：' + ph.dur + ' 人月<br/>' +
            '技术栈：' + ph.desc;
        }
      },
      grid: { left: '3%', right: '5%', bottom: '8%', top: '5%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '开发月份',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: muted, fontSize: 12 },
        min: 0,
        max: 28,
        interval: 2,
        axisLine: { lineStyle: { color: rule } },
        axisLabel: {
          color: muted,
          formatter: function (v) { return 'M' + (v + 1); }
        },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: phases.map(function (p) { return p.name; }),
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 12, fontWeight: 600 },
        axisTick: { show: false }
      },
      series: [
        // 透明占位条（推到正确的起始位置）
        {
          name: '占位',
          type: 'bar',
          stack: 'gantt',
          barWidth: '55%',
          silent: true,
          itemStyle: { color: 'transparent' },
          data: phases.map(function (p) { return p.start; })
        },
        // 实际阶段条
        {
          name: '工期',
          type: 'bar',
          stack: 'gantt',
          barWidth: '55%',
          data: phases.map(function (p) {
            return {
              value: p.dur,
              itemStyle: {
                color: p.color,
                borderRadius: [0, 4, 4, 0]
              }
            };
          }),
          label: {
            show: true,
            position: 'insideRight',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            formatter: function (p) { return p.value + ' 人月'; }
          }
        }
      ]
    });
    window.addEventListener('resize', function () { chart.resize(); });
  }

  // --- Mermaid 初始化 ---
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }
})();