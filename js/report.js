// Report page: draws the charts from data/report_numbers.json (made by
// scripts/report_stats.py) as each one scrolls into view, redraws them when the
// night/day theme changes, and runs the scoreboard flip cards.

const pts = (rows, key, from = 0) =>
  rows.filter((r) => r.year >= from).map((r) => ({ x: r.year, y: r[key] }));

// Direct series labels: writes each series name beside its line at a chosen year,
// where the lines are far apart (identity is never color-only).
const seriesLabels = {
  id: "seriesLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.atYear) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 13px "Source Sans 3", system-ui, sans-serif';
    ctx.fillStyle = COLORS.ink2;
    ctx.textAlign = "center";
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      const pt = meta.data.find((p, j) => ds.data[j].x === opts.atYear);
      if (!pt) return;
      const above = opts.above[i];
      ctx.textBaseline = above ? "bottom" : "top";
      ctx.fillText(ds.label, pt.x, pt.y + (above ? -8 : 8));
    });
    ctx.restore();
  },
};

function singleLine(id, rows, key, { from = 0, color = COLORS.navy, label, yFormat, tipFormat, beginAtZero = true }) {
  const data = pts(rows, key, from);
  const options = lineOptions({ yFormat, beginAtZero, xMin: data[0].x, xMax: data[data.length - 1].x });
  options.plugins.tooltip.callbacks.label = (item) => `${label}: ${tipFormat(item.parsed.y)}`;
  options.animation = progressiveLine(data.length);
  return new Chart(document.getElementById(id), {
    type: "line",
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "22",
        fill: true,
        pointHoverBackgroundColor: color,
      }],
    },
    options,
  });
}

// Bars where one category is the story: it gets the accent, the rest the base color.
function highlightBars(id, labels, values, highlight, { horizontal = false, format, tipLabel }) {
  const colors = labels.map((l) => (highlight.includes(l) ? COLORS.red : COLORS.navy));
  const options = barOptions({ horizontal, valueFormat: format });
  options.plugins.barValueLabels = { format };
  options.plugins.tooltip = { callbacks: { label: (item) => `${tipLabel}: ${format(item.raw)}` } };
  if (horizontal) options.layout = { padding: { right: 40 } };
  else options.layout = { padding: { top: 18 } };
  const ds = horizontal ? horizontalBarDataset(values, colors, tipLabel) : barDataset(values, colors, tipLabel);
  return new Chart(document.getElementById(id), { type: "bar", data: { labels, datasets: [ds] }, options });
}

// One builder per chart, keyed by canvas id. Each returns a Chart.
function chartBuilders(data) {
  const yearly = data.yearly;
  const eraLabels = data.eras.map((e) => e.era);
  return {
    // 1. Strikeouts vs hits
    "chart-so-h": () => {
      const options = lineOptions({ yFormat: (v) => fmt.int(v), xMin: 1901, xMax: 2025 });
      options.plugins.legend = { display: true, position: "top", align: "start" };
      options.plugins.seriesLabels = { atYear: 1940, above: [true, false] };
      options.plugins.tooltip.callbacks.label = (item) => `${item.dataset.label}: ${fmt.int(item.parsed.y)}`;
      options.animation = progressiveLine(125);
      return new Chart(document.getElementById("chart-so-h"), {
        type: "line",
        data: {
          datasets: [
            { label: "Hits", data: pts(yearly, "H", 1901), borderColor: COLORS.navy, pointHoverBackgroundColor: COLORS.navy, backgroundColor: COLORS.navy },
            { label: "Strikeouts", data: pts(yearly, "SO", 1901), borderColor: COLORS.red, pointHoverBackgroundColor: COLORS.red, backgroundColor: COLORS.red },
          ],
        },
        options,
        plugins: [seriesLabels],
      });
    },

    // 2. Strikeout rate
    "chart-k": () => singleLine("chart-k", yearly, "Kpct", {
      color: COLORS.red, label: "Strikeout rate",
      yFormat: (v) => v + "%", tipFormat: (v) => fmt.pct(v),
    }),

    // 3. Home run rate
    "chart-hr": () => singleLine("chart-hr", yearly, "HRpct", {
      label: "Home run rate",
      yFormat: (v) => v.toFixed(1) + "%", tipFormat: (v) => fmt.pct(v, 2),
    }),

    // 4. Singles share of hits
    "chart-singles": () => singleLine("chart-singles", yearly, "singlesPct", {
      label: "Singles share of hits", beginAtZero: false,
      yFormat: (v) => v + "%", tipFormat: (v) => fmt.pct(v),
    }),

    // 5. Batting average by era
    "chart-era-avg": () => highlightBars("chart-era-avg", eraLabels, data.eras.map((e) => e.AVG), ["Live Ball"], {
      format: fmt.rate, tipLabel: "Batting average",
    }),

    // 6. Slugging by era
    "chart-era-slg": () => highlightBars("chart-era-slg", eraLabels, data.eras.map((e) => e.SLG), ["Steroid"], {
      format: fmt.rate, tipLabel: "Slugging",
    }),

    // 7. .300 hitters per season
    "chart-300": () => {
      const rows = yearly.filter((r) => r.year >= 1901);
      const options = barOptions({});
      options.animation = staggeredBars(8);
      options.scales.x.type = "linear";
      options.scales.x.min = 1900;
      options.scales.x.max = 2026;
      options.scales.x.ticks = { stepSize: 20, includeBounds: false, callback: (v) => String(v), color: COLORS.muted };
      options.scales.x.offset = true;
      options.plugins.tooltip = {
        callbacks: {
          title: (items) => String(items[0].raw.x),
          label: (item) => {
            const r = rows[item.dataIndex];
            return `.300 hitters: ${r.hitters300} of ${r.qualified} qualified`;
          },
        },
      };
      return new Chart(document.getElementById("chart-300"), {
        type: "bar",
        data: {
          datasets: [{
            ...barDataset(rows.map((r) => ({ x: r.year, y: r.hitters300 })), rows.map((r) => (r.year === 1999 || r.year === 2025 || r.year === 1930 ? COLORS.red : COLORS.navy)), ".300 hitters"),
            barPercentage: 1, categoryPercentage: 1, borderRadius: 2,
          }],
        },
        options,
      });
    },

    // 8. Foreign-born share by decade
    "chart-foreign": () => highlightBars("chart-foreign", data.foreign.map((f) => f.decade + "s"), data.foreign.map((f) => f.foreignPct), ["2020s"], {
      format: (v) => fmt.pct(v), tipLabel: "Born outside US",
    }),

    // 9. OBP by batting hand
    "chart-hand": () => highlightBars("chart-hand", data.hand.map((h) => h.bats), data.hand.map((h) => h.OBP), ["Left"], {
      horizontal: true, format: fmt.rate, tipLabel: "On-base %",
    }),

    // 10. Career home run leaders (red = career overlapped 1994-2005)
    "chart-career": () => {
      const top = data.careerHR;
      const steroid = top.filter((p) => p.last >= 1994 && p.first <= 2005).map((p) => p.name);
      const chart = highlightBars("chart-career", top.map((p) => p.name), top.map((p) => p.HR), steroid, {
        horizontal: true, format: fmt.int, tipLabel: "Career HR",
      });
      chart.options.plugins.tooltip.callbacks.afterLabel = (item) => `Seasons: ${top[item.dataIndex].first}–${top[item.dataIndex].last}`;
      return chart;
    },
  };
}

async function main() {
  const res = await fetch("data/report_numbers.json");
  const data = await res.json();
  const builders = chartBuilders(data);
  const built = {};

  // Draw each chart the first time it scrolls into view, so the animation is seen.
  Object.entries(builders).forEach(([id, build]) => {
    whenVisible(document.getElementById(id), () => { built[id] = build(); });
  });

  // Theme change: re-read the colors and redraw every chart already on the page.
  window.addEventListener("themechange", () => {
    refreshColors();
    Object.keys(built).forEach((id) => {
      built[id].destroy();
      built[id] = builders[id]();
    });
  });
}

main().catch((err) => {
  console.error(err);
  document.querySelectorAll(".chart-box").forEach((b) => {
    b.innerHTML = '<p class="chart-caption">Chart data could not be loaded. If you opened this file directly, serve the folder instead (see README).</p>';
  });
});

// ---------- Scoreboard flip cards --------------------------------------------------
// Each card flips its digits into place when the board scrolls into view, tilts
// toward the pointer, and flips over on click (or Enter/Space) to show the method.
(function scoreboard() {
  const board = document.querySelector(".scoreboard");
  if (!board) return;
  const cards = board.querySelectorAll(".flip-card");

  cards.forEach((card) => {
    const value = card.querySelector(".sb-value");
    value.textContent = value.dataset.value; // readable before the animation runs

    card.addEventListener("click", () => {
      const on = card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", on);
    });

    if (window.REDUCED_MOTION) return;
    card.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${x * 18}deg`);
      card.style.setProperty("--rx", `${-y * 14}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    });
  });

  whenVisible(board, () => {
    cards.forEach((card, i) => {
      const value = card.querySelector(".sb-value");
      setTimeout(() => flapTo(value, value.dataset.value), i * 180);
    });
  }, "0px 0px -20% 0px");
})();
