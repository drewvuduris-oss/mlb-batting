// Report page: the opening scroll steps, photo drift, scoreboard flip cards, and
// the ten charts, drawn from data/report_numbers.json (made by scripts/report_stats.py)
// as each one scrolls into view.

// ---------- Opening: which text step shows depends on scroll through the hero ----------
(function hero() {
  const el = document.getElementById("hero");
  const steps = [...el.querySelectorAll(".step")];
  const cue = el.querySelector(".scroll-cue");
  window.heroProgress = 0;

  function update() {
    const span = el.offsetHeight - innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / span)) : 0;
    window.heroProgress = p;
    const active = window.REDUCED_MOTION ? 0 : p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
    steps.forEach((s, i) => {
      s.classList.toggle("on", i === active);
      s.setAttribute("aria-hidden", i === active ? "false" : "true");
    });
    if (cue) cue.style.opacity = p > 0.05 ? "0" : "1";

    // Photographs drift a few pixels while in view (slow parallax)
    if (!window.REDUCED_MOTION) {
      document.querySelectorAll(".photo, .banner").forEach((fig) => {
        const r = fig.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const t = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // about -1..1 around center
        fig.style.setProperty("--drift", `${(-t * 20 - (fig.classList.contains("banner") ? 30 : 20)).toFixed(1)}px`);
      });
    }
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
})();

// ---------- Scoreboard: plates slide in one after another; cards flip ----------
(function scoreboard() {
  const board = document.getElementById("board");
  if (!board) return;
  board.querySelectorAll(".plate-num span").forEach((s, i) => (s.style.transitionDelay = `${250 + i * 110}ms`));
  board.querySelectorAll(".plate-card").forEach((card) => {
    card.addEventListener("click", () => {
      const on = card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", String(on));
    });
  });
})();

// ---------- Charts ----------
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
    ctx.font = '600 14px "Inter", system-ui, sans-serif';
    ctx.fillStyle = COLORS.ink2;
    ctx.textAlign = "center";
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      const pt = meta.data.find((p, j) => ds.data[j].x === opts.atYear);
      if (!pt) return;
      const above = opts.above[i];
      ctx.textBaseline = above ? "bottom" : "top";
      ctx.fillText(ds.label, pt.x, pt.y + (above ? -10 : 10));
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
        backgroundColor: color + "1c",
        fill: true,
        pointHoverBackgroundColor: color,
      }],
    },
    options,
  });
}

// Bars where one category is the story: it gets the accent, the rest the base color.
function highlightBars(id, labels, values, highlight, { horizontal = false, format, tipLabel }) {
  if (!horizontal && labels.length > 4 && isNarrow(document.getElementById(id))) horizontal = true;
  if (horizontal) fitBarHeight(document.getElementById(id), labels);
  else document.getElementById(id).parentElement.style.height = "";
  const colors = labels.map((l) => (highlight.includes(l) ? COLORS.red : COLORS.navy));
  const options = barOptions({ horizontal, valueFormat: format });
  options.plugins.barValueLabels = { format };
  options.plugins.tooltip = { callbacks: { label: (item) => `${tipLabel}: ${format(item.raw)}` } };
  options.layout = horizontal ? { padding: { right: 52 } } : { padding: { top: 24 } };
  const ds = horizontal ? horizontalBarDataset(values, colors, tipLabel) : barDataset(values, colors, tipLabel);
  return new Chart(document.getElementById(id), { type: "bar", data: { labels, datasets: [ds] }, options });
}

// One builder per chart, keyed by canvas id.
function chartBuilders(data) {
  const yearly = data.yearly;
  const eraLabels = data.eras.map((e) => e.era);
  return {
    // 1. Strikeouts vs hits
    "chart-so-h": () => {
      const options = lineOptions({ yFormat: (v) => fmt.int(v), xMin: 1901, xMax: 2025 });
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
      options.scales.x.ticks = { stepSize: 20, includeBounds: false, maxRotation: 0, autoSkip: true, autoSkipPadding: 16, callback: (v) => String(v), color: COLORS.muted };
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
            barPercentage: 1, categoryPercentage: 1, borderRadius: 1,
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

// Charts measure their labels when drawn, so wait for the web fonts first
// (otherwise labels are sized for the fallback font and can be clipped).
Promise.all([fetch("data/report_numbers.json").then((res) => res.json()), document.fonts.ready])
  .then(([data]) => {
    // Draw each chart the first time it scrolls into view, so the animation is seen.
    const builders = chartBuilders(data);
    const built = {};
    Object.entries(builders).forEach(([id, build]) => {
      whenVisible(document.getElementById(id), () => { built[id] = build(); }, "0px 0px -15% 0px");
    });
    // Category charts change layout on narrow screens; redraw them if the width crosses that point.
    let narrow = innerWidth < 700;
    addEventListener("resize", () => {
      if ((innerWidth < 700) === narrow) return;
      narrow = innerWidth < 700;
      Object.keys(built).forEach((id) => { built[id].destroy(); built[id] = builders[id](); });
    });
  })
  .catch((err) => {
    console.error(err);
    document.querySelectorAll(".chart-box").forEach((b) => {
      b.innerHTML = '<p class="note">Chart data could not be loaded. If you opened this file directly, serve the folder instead (see README).</p>';
    });
  });
