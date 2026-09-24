// Shared chart styling and number formatting for the report and dashboard.
// Colors come from the CSS custom properties in css/style.css so both pages match.

const css = getComputedStyle(document.documentElement);
const COLORS = {
  navy: css.getPropertyValue("--navy-2").trim(),
  red: css.getPropertyValue("--red").trim(),
  ink: css.getPropertyValue("--ink").trim(),
  ink2: css.getPropertyValue("--ink-2").trim(),
  muted: css.getPropertyValue("--muted").trim(),
  grid: css.getPropertyValue("--grid").trim(),
  mutedBar: css.getPropertyValue("--muted-bar").trim(),
  paper: css.getPropertyValue("--paper").trim(),
};

Chart.defaults.font.family = '"Source Sans 3", system-ui, sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = COLORS.muted;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 400;
Chart.defaults.plugins.legend.labels.color = COLORS.ink2;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = "rectRounded";
Chart.defaults.plugins.tooltip.backgroundColor = "#14305e";
Chart.defaults.plugins.tooltip.titleFont = { weight: "700" };
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 6;

// Formatters
const fmt = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  // Baseball rate style: .296 (no leading zero)
  rate: (v) => (v == null || isNaN(v) ? "–" : v.toFixed(3).replace(/^0/, "")),
  pct: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toFixed(d) + "%"),
  num: (v, d = 1) => (v == null || isNaN(v) ? "–" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d })),
};

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
