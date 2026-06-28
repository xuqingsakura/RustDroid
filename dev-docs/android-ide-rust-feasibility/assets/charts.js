// charts.js — 雷达图 + Mermaid 初始化
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- 雷达图：Rust vs JVM(IntelliJ) 适用性对比 ---
  var radarEl = document.getElementById('chart-radar');
  if (radarEl && typeof echarts !== 'undefined') {
    var chart = echarts.init(radarEl, null, { renderer: 'svg' });
    chart.setOption({
      animation: false,
      tooltip: {
        appendToBody: true,
        trigger: 'item'
      },
      legend: {
        data: ['Rust', 'JVM / IntelliJ（参照）'],
        top: 0,
        textStyle: { color: ink, fontSize: 13 },
        itemGap: 20
      },
      radar: {
        center: ['50%', '55%'],
        radius: '65%',
        indicator: [
          { name: '编辑器内核性能', max: 10 },
          { name: '语言服务生态', max: 10 },
          { name: '构建系统集成', max: 10 },
          { name: '调试器支持', max: 10 },
          { name: 'GUI 框架成熟度', max: 10 },
          { name: '插件生态', max: 10 },
          { name: '开发迭代效率', max: 10 }
        ],
        axisName: {
          color: ink,
          fontSize: 12,
          fontWeight: 600
        },
        splitLine: { lineStyle: { color: rule } },
        splitArea: {
          areaStyle: {
            color: [bg2, 'transparent']
          }
        },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'radar',
        emphasis: { focus: 'self' },
        data: [
          {
            value: [9, 7, 8, 5, 4, 3, 5],
            name: 'Rust',
            areaStyle: { color: accent + '33' },
            lineStyle: { color: accent, width: 2 },
            itemStyle: { color: accent },
            symbolSize: 6
          },
          {
            value: [5, 10, 9, 9, 9, 10, 8],
            name: 'JVM / IntelliJ（参照）',
            areaStyle: { color: accent2 + '22' },
            lineStyle: { color: accent2, width: 2, type: 'dashed' },
            itemStyle: { color: accent2 },
            symbolSize: 6
          }
        ]
      }]
    });
    window.addEventListener('resize', function () { chart.resize(); });
  }

  // --- 柱状图：各模块工作量占比分布 ---
  var effortEl = document.getElementById('chart-effort');
  if (effortEl && typeof echarts !== 'undefined') {
    var effortChart = echarts.init(effortEl, null, { renderer: 'svg' });
    effortChart.setOption({
      animation: false,
      tooltip: { appendToBody: true, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: false },
      grid: { left: '3%', right: '5%', bottom: '3%', top: '12%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '人月',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: ['Logcat 面板', 'ADB/设备管理', 'LSP 客户端', '构建集成', '资源/清单管理', '项目管理/Gradle解析', 'UI/前端(Tauri)', '编辑器内核', '调试器(DAP→JDWP)', '布局预览(JVM桥接)'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 1.5, itemStyle: { color: accent2 } },
          { value: 2.5, itemStyle: { color: accent2 } },
          { value: 2.5, itemStyle: { color: accent2 } },
          { value: 2.5, itemStyle: { color: accent2 } },
          { value: 3.5, itemStyle: { color: accent } },
          { value: 4, itemStyle: { color: accent } },
          { value: 5, itemStyle: { color: accent } },
          { value: 6, itemStyle: { color: accent } },
          { value: 5, itemStyle: { color: '#b91c1c' } },
          { value: 4.5, itemStyle: { color: '#b91c1c' } }
        ],
        barWidth: '55%',
        label: {
          show: true,
          position: 'right',
          color: ink,
          fontSize: 11,
          formatter: '{c} 人月'
        }
      }]
    });
    window.addEventListener('resize', function () { effortChart.resize(); });
  }

  // --- 热力图：核心风险概率-影响 ---
  var riskEl = document.getElementById('chart-risk');
  if (riskEl && typeof echarts !== 'undefined') {
    var riskChart = echarts.init(riskEl, null, { renderer: 'svg' });
    // 风险项：[概率(1-5), 影响(1-5), 名称]
    var risks = [
      [5, 5, 'Kotlin LSP AGP 支持停滞'],
      [5, 5, '单人开发精力不足'],
      [3, 3, '布局预览 API 适配成本(已修正)'],
      [4, 3, 'Gradle/AGP/Kotlin 版本演进'],
      [3, 4, 'Rust GUI 破坏性变更'],
      [3, 3, '调试链路过复杂'],
      [3, 3, '构建产物反馈失效'],
      [3, 2, 'WebView 跨平台差异'],
      [3, 1, 'Windows 路径/编码'],
      [2, 2, '许可证合规(开源场景已缓解)']
    ];
    // 构建 x 轴(影响) 1-5, y 轴(概率) 1-5 的网格
    var heatData = [];
    risks.forEach(function (r) {
      heatData.push([r[1] - 1, r[0] - 1, r[2]]);
    });
    riskChart.setOption({
      animation: false,
      tooltip: {
        appendToBody: true,
        formatter: function (p) {
          return '<b>' + p.value[3] + '</b><br/>概率: ' + (p.value[1] + 1) + '/5<br/>影响: ' + (p.value[0] + 1) + '/5';
        }
      },
      grid: { left: '3%', right: '5%', bottom: '8%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        name: '影响程度 →',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: muted, fontSize: 12 },
        data: ['1 低', '2', '3 中', '4', '5 高'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted },
        splitArea: { show: false }
      },
      yAxis: {
        type: 'category',
        name: '发生概率 ↑',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: muted, fontSize: 12 },
        data: ['5 高', '4', '3 中', '2', '1 低'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted },
        splitArea: { show: false }
      },
      visualMap: {
        min: 0,
        max: 25,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        show: false,
        inRange: { color: [bg2, accent2, accent, '#b91c1c'] }
      },
      series: [{
        type: 'scatter',
        data: heatData.map(function (d) {
          return { value: [d[0], d[1], d[2], d[2]] };
        }),
        symbolSize: function (val) {
          // 风险值越大圆越大
          var riskScore = (val[0] + 1) * (val[1] + 1);
          return Math.sqrt(riskScore) * 9 + 12;
        },
        itemStyle: {
          color: function (p) {
            var score = (p.value[0] + 1) * (p.value[1] + 1);
            if (score >= 20) return '#b91c1c';
            if (score >= 12) return accent;
            if (score >= 6) return accent2;
            return muted;
          },
          opacity: 0.85,
          borderColor: '#fff',
          borderWidth: 1.5
        },
        label: {
          show: true,
          formatter: function (p) {
            // 截断过长名称
            var n = p.value[3];
            return n.length > 10 ? n.substring(0, 9) + '…' : n;
          },
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          position: 'inside'
        }
      }]
    });
    window.addEventListener('resize', function () { riskChart.resize(); });
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
