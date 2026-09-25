// Shared chart styling and number formatting for the report and dashboard.
// Colors come from the CSS custom properties in css/style.css so both pages match.

const COLORS = (() => {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    navy: v("--slate"),        // series 1
    red: v("--brick"),         // series 2 / highlight
    ink: v("--ink"),
    ink2: v("--ink-2"),
    muted: v("--muted"),
    grid: v("--grid"),
    mutedBar: v("--rule"),     // axis baseline
    paper: v("--card"),
    cat: [v("--cat-1"), v("--cat-2"), v("--cat-3"), v("--cat-4")],
    catOther: v("--cat-other"),
  };
})();

Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
Chart.defaults.font.size = 14;
Chart.defaults.color = COLORS.muted;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = window.REDUCED_MOTION ? 0 : 1000;
Chart.defaults.animation.easing = "easeOutQuart";
Chart.defaults.plugins.legend.labels.color = COLORS.ink2;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = "rectRounded";
Chart.defaults.plugins.legend.labels.font = { size: 14 };
Chart.defaults.plugins.tooltip.backgroundColor = COLORS.ink;
Chart.defaults.plugins.tooltip.titleFont = { family: '"Libre Caslon Text", Georgia, serif', size: 15, weight: "400" };
Chart.defaults.plugins.tooltip.bodyFont = { size: 14 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 4;

// Formatters
const fmt = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  // Baseball rate style: .296 (no leading zero)
  rate: (v) => (v == null || isNaN(v) ? "–" : v.toFixed(3).replace(/^0/, "")),
  pct: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toFixed(d) + "%"),
  num: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d })),
};

// Line animation that draws each series from left to right.
function progressiveLine(points, duration = 1500) {
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
function staggeredBars(stepMs = 60) {
  if (window.REDUCED_MOTION) return false;
  return {
    delay: (ctx) => (ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * stepMs : 0),
  };
}

// Base options for a line chart over years, with an index tooltip.
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
        ticks: { stepSize: 20, includeBounds: false, maxRotation: 0, autoSkip: true, autoSkipPadding: 16, callback: (v) => String(v) },
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

// Splits a long category name onto two lines at the space nearest its middle,
// so names like "Shoeless Joe Jackson" wrap instead of being cut off.
function wrapLabel(text, max = 13) {
  text = String(text);
  if (text.length <= max || !text.includes(" ")) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [text.slice(0, best), text.slice(best + 1)];
}

// True when a chart's box is too narrow for category names side by side.
const isNarrow = (canvas) => (canvas.parentElement ? canvas.parentElement.clientWidth : innerWidth) < 620;

// Gives a horizontal bar chart enough height that every row, including names
// wrapped onto two lines, has room. Call before creating the chart.
function fitBarHeight(canvas, labels) {
  const box = canvas.parentElement;
  if (!box) return;
  const twoLines = isNarrow(canvas) && labels.some((l) => Array.isArray(wrapLabel(l)));
  const rowH = twoLines ? 48 : 34;
  box.style.height = `${Math.max(200, labels.length * rowH + 70)}px`;
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
  const catAxis = {
    grid: { display: false },
    border: { color: COLORS.mutedBar },
    ticks: {
      color: COLORS.ink, font: { size: 14, weight: "500" },
      maxRotation: 0, autoSkip: false,
      // names wrap onto two lines only where the chart is too narrow for them
      callback(v) { return horizontal && isNarrow(this.chart.canvas) ? wrapLabel(this.getLabelForValue(v)) : this.getLabelForValue(v); },
    },
  };
  return {
    indexAxis: horizontal ? "y" : "x",
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    plugins: { legend: { display: false } },
    animation: staggeredBars(),
  };
}

// Dataset defaults for bars: capped thickness, rounded data end.
function barDataset(data, colors, label) {
  return {
    label,
    data,
    backgroundColor: colors,
    borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
    borderSkipped: "start",
    maxBarThickness: 26,
    borderWidth: 0,
  };
}

function horizontalBarDataset(data, colors, label) {
  return {
    ...barDataset(data, colors, label),
    borderRadius: { topRight: 3, bottomRight: 3, topLeft: 0, bottomLeft: 0 },
  };
}

// Plugin: writes the value at the end of each bar (used on short category lists).
const barValueLabels = {
  id: "barValueLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.format) return;
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = '600 14px "Inter", system-ui, sans-serif';
    ctx.fillStyle = COLORS.ink2;
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const v = chart.data.datasets[0].data[i];
      if (v == null) return;
      const text = opts.format(v);
      if (horizontal) {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, bar.x + 8, bar.y);
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(text, bar.x, bar.y - 6);
      }
    });
    ctx.restore();
  },
};
Chart.register(barValueLabels);
