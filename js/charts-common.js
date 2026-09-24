// Shared chart styling and number formatting for the report and dashboard.
// Colors come from the CSS custom properties in css/style.css, so charts follow
// the night/day theme. refreshColors() re-reads them when the theme changes.

const COLORS = {};

function refreshColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  Object.assign(COLORS, {
    navy: v("--series-1"),      // series 1 (blue)
    red: v("--series-2"),       // series 2 / highlight (red)
    ink: v("--ink"),
    ink2: v("--ink-2"),
    muted: v("--muted"),
    grid: v("--grid"),
    mutedBar: v("--rule"),      // axis baseline
    paper: v("--chart-surface"),
    cat: [v("--cat-1"), v("--cat-2"), v("--cat-3"), v("--cat-4")],
    catOther: v("--cat-other"),
    tooltipBg: v("--tooltip-bg"),
  });
  Chart.defaults.color = COLORS.muted;
  Chart.defaults.plugins.legend.labels.color = COLORS.ink2;
  Chart.defaults.plugins.tooltip.backgroundColor = COLORS.tooltipBg;
}

Chart.defaults.font.family = '"Source Sans 3", system-ui, sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = window.REDUCED_MOTION ? 0 : 900;
Chart.defaults.animation.easing = "easeOutQuart";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = "rectRounded";
Chart.defaults.plugins.tooltip.titleFont = { weight: "700" };
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
refreshColors();

// Formatters
const fmt = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  // Baseball rate style: .296 (no leading zero)
  rate: (v) => (v == null || isNaN(v) ? "–" : v.toFixed(3).replace(/^0/, "")),
  pct: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toFixed(d) + "%"),
  num: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d })),
};

// Line animation that draws each series from left to right.
function progressiveLine(points, duration = 1400) {
  if (window.REDUCED_MOTION) return false;
  const step = duration / Math.max(points, 1);
  const prevY = (ctx) => ctx.index === 0
    ? ctx.chart.scales.y.getPixelForValue(ctx.chart.scales.y.min)
    : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(["y"], true).y;
  const delay = (key) => (ctx) => {
    if (ctx.type !== "data" || ctx[key]) return 0;
    ctx[key] = true;
    return ctx.index * step;
  };
  return {
    x: { type: "number", easing: "linear", duration: step, from: NaN, delay: delay("xStarted") },
    y: { type: "number", easing: "linear", duration: step, from: prevY, delay: delay("yStarted") },
  };
}

// Bars grow from the baseline one after another.
function staggeredBars(stepMs = 45) {
  if (window.REDUCED_MOTION) return false;
  return {
    delay: (ctx) => (ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * stepMs : 0),
  };
}

// Base options for a line chart over years, with crosshair-style index tooltip.
function lineOptions({ yFormat, yTitle, beginAtZero = true, xMin, xMax } = {}) {
  return {
    interaction: { mode: "index", intersect: false },
    elements: {
      line: { borderWidth: 2, tension: 0.15, borderCapStyle: "round", borderJoinStyle: "round" },
      point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: COLORS.paper },
    },
    scales: {
      x: {
        type: "linear",
        min: xMin,
        max: xMax,
        grid: { display: false },
        border: { color: COLORS.mutedBar },
        ticks: { stepSize: 20, includeBounds: false, callback: (v) => String(v) },
      },
      y: {
        beginAtZero,
        grid: { color: COLORS.grid },
        border: { display: false },
        title: yTitle ? { display: true, text: yTitle, color: COLORS.muted } : undefined,
        ticks: { callback: yFormat || ((v) => v.toLocaleString("en-US")) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => String(items[0].parsed.x),
        },
      },
    },
  };
}

// Base options for a bar chart over categories.
// Bars always start at zero: a bar's length is its value.
function barOptions({ horizontal = false, valueFormat } = {}) {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: COLORS.grid },
    border: { display: false },
    ticks: { callback: valueFormat || ((v) => v.toLocaleString("en-US")) },
  };
  const catAxis = { grid: { display: false }, border: { color: COLORS.mutedBar }, ticks: { color: COLORS.ink2 } };
  return {
    indexAxis: horizontal ? "y" : "x",
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    plugins: { legend: { display: false } },
    animation: staggeredBars(),
  };
}

// Dataset defaults for bars: capped thickness, rounded data end, 2px surface gap.
function barDataset(data, colors, label) {
  return {
    label,
    data,
    backgroundColor: colors,
    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
    borderSkipped: "start",
    maxBarThickness: 24,
    borderWidth: 0,
  };
}

function horizontalBarDataset(data, colors, label) {
  return {
    ...barDataset(data, colors, label),
    borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
  };
}

// Plugin: writes the value at the end of each bar (used sparingly, on short category lists).
const barValueLabels = {
  id: "barValueLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.format) return;
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = '600 12px "Source Sans 3", system-ui, sans-serif';
    ctx.fillStyle = COLORS.ink2;
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const v = chart.data.datasets[0].data[i];
      if (v == null) return;
      const text = opts.format(v);
      if (horizontal) {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, bar.x + 6, bar.y);
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(text, bar.x, bar.y - 4);
      }
    });
    ctx.restore();
  },
};
Chart.register(barValueLabels);
