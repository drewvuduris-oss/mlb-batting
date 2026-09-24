// Dashboard: loads data/batting_clean.csv, filters it in the browser and
// recalculates every number and chart. Formulas match scripts/report_stats.py.

// ---------- Measures ------------------------------------------------------------
// Every rate is built from totals (sum of H / sum of AB), as in the report.
const MEASURES = {
  AVG:    { label: "Batting average",     kind: "rate",  fmt: fmt.rate, calc: (a) => div(a.H, a.AB) },
  OBP:    { label: "On-base percentage",  kind: "rate",  fmt: fmt.rate, calc: (a) => div(a.H + a.BB + a.HBP, a.AB + a.BB + a.HBP + a.SF) },
  SLG:    { label: "Slugging percentage", kind: "rate",  fmt: fmt.rate, calc: (a) => div(a.H + a.D + 2 * a.T + 3 * a.HR, a.AB) },
  HRpct:  { label: "Home run rate (% of PA)",  kind: "rate", fmt: (v) => fmt.pct(v, 2), calc: (a) => pct(a.HR, a.PA) },
  Kpct:   { label: "Strikeout rate (% of PA)", kind: "rate", fmt: (v) => fmt.pct(v), calc: (a) => pct(a.SO, a.PAso) },
  BBpct:  { label: "Walk rate (% of PA)",      kind: "rate", fmt: (v) => fmt.pct(v), calc: (a) => pct(a.BB, a.PA) },
  HR:     { label: "Home runs (total)",   kind: "count", fmt: fmt.int, calc: (a) => a.HR },
  H:      { label: "Hits (total)",        kind: "count", fmt: fmt.int, calc: (a) => a.H },
  SO:     { label: "Strikeouts (total)",  kind: "count", fmt: fmt.int, calc: (a) => a.SO },
  SB:     { label: "Stolen bases (total)", kind: "count", fmt: fmt.int, calc: (a) => a.SB },
  PA:     { label: "Plate appearances (total)", kind: "count", fmt: fmt.int, calc: (a) => a.PA },
  players:{ label: "Players (count)",     kind: "count", fmt: fmt.int, calc: (a) => a.players.size },
};

function div(n, d) { return d > 0 ? n / d : null; }
function pct(n, d) { return d > 0 ? (n / d) * 100 : null; }

// ---------- Breakdowns ----------------------------------------------------------
// Fixed category orders and fixed colors, so a category keeps its color when filters change.
// Series colors come from the theme (COLORS.cat / COLORS.catOther in charts-common.js).
const TOP_COUNTRIES = ["USA", "Dominican Republic", "Venezuela", "Cuba", "Puerto Rico", "Canada", "Mexico", "Japan"];

const BREAKDOWNS = {
  lgGroup: { label: "League", key: (r) => r.lgGroup,
             order: ["American League", "National League", "Negro Leagues", "Early Leagues"] },
  era:     { label: "Era", key: (r) => r.era,
             order: ["19th Century", "Dead Ball", "Live Ball", "Integration", "Expansion", "Free Agency", "Steroid", "Modern"] },
  bats:    { label: "Batting hand", key: (r) => r.bats, order: ["Right", "Left", "Switch", "Unknown"] },
  country: { label: "Birth country", key: (r) => (TOP_COUNTRIES.includes(r.country) ? r.country : "Other"),
             order: [...TOP_COUNTRIES, "Other"] },
  franchise: { label: "Team", key: (r) => r.franchise, order: null }, // ordered by plate appearances
};

// ---------- State ---------------------------------------------------------------
let ROWS = [];
let YEARS = [];
const DEFAULTS = { from: 1871, to: 2025, league: "MLB", franchise: "ALL", bats: "ALL", country: "ALL", measure: "AVG", by: "lgGroup" };
const state = { ...DEFAULTS };
const charts = {};

const $ = (id) => document.getElementById(id);

// ---------- Aggregation -----------------------------------------------------------
function newAcc() {
  return { rows: 0, PA: 0, PAso: 0, AB: 0, H: 0, D: 0, T: 0, HR: 0, BB: 0, HBP: 0, SF: 0, SO: 0, SB: 0, players: new Set() };
}
function add(a, r) {
  a.rows++;
  a.PA += r.PA; a.AB += r.AB; a.H += r.H; a.D += r.D; a.T += r.T; a.HR += r.HR; a.BB += r.BB;
  a.HBP += r.HBP; a.SF += r.SF; a.SB += r.SB;
  if (r.SOknown) { a.SO += r.SO; a.PAso += r.PA; } // strikeouts only where reliably recorded
  a.players.add(r.playerID);
}
function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    let a = m.get(k);
    if (!a) m.set(k, (a = newAcc()));
    add(a, r);
  }
  return m;
}

function filtered() {
  const { from, to, league, franchise, bats, country } = state;
  return ROWS.filter((r) =>
    r.year >= from && r.year <= to &&
    (league === "ALL" || (league === "MLB" ? r.mlb : r.lgGroup === league)) &&
    (franchise === "ALL" || r.franchise === franchise) &&
    (bats === "ALL" || r.bats === bats) &&
    (country === "ALL" || r.country === country));
}

// Categories of the current breakdown present in the view, in display order.
function orderedCats(groups, bd) {
  if (bd.order) return bd.order.filter((c) => groups.has(c));
  return [...groups.keys()].sort((a, b) => groups.get(b).PA - groups.get(a).PA);
}

// ---------- Rendering ---------------------------------------------------------------
function render() {
  const rows = filtered();
  const m = MEASURES[state.measure];
  const bd = BREAKDOWNS[state.by];
  const total = newAcc();
  rows.forEach((r) => add(total, r));

  const leagueText = $("f-league").selectedOptions[0].textContent;
  const hasNegro = rows.some((r) => r.lgGroup === "Negro Leagues");
  $("view-note").textContent = rows.length
    ? `Showing ${fmt.int(rows.length)} batting lines · ${state.from}–${state.to} · ${leagueText}` +
      (hasNegro ? " · Negro League rows are left out of strikeout numbers (incomplete in the source data)." : "")
    : "No batting lines match these filters. Try widening them or press Reset.";

  renderTiles(total);
  const groups = groupBy(rows, bd.key);
  const cats = orderedCats(groups, bd);

  renderTrend(rows, m, bd, groups, cats);
  renderByCategory(m, bd, groups, cats);
  renderDecade(rows, m);
  renderPlayers(rows, m);
  renderShare(bd, groups, cats, total);
  renderTable(bd, groups, cats, total);
}

function renderTiles(t) {
  const tiles = [
    [fmt.int(t.players.size), "Players"],
    [fmt.int(t.PA), "Plate appearances"],
    [fmt.rate(MEASURES.AVG.calc(t)), "Batting average"],
    [fmt.rate(MEASURES.OBP.calc(t)), "On-base percentage"],
    [fmt.int(t.HR), "Home runs"],
    [fmt.pct(MEASURES.Kpct.calc(t)), "Strikeout rate"],
  ];
  const box = $("tiles");
  if (!box.children.length) {
    box.innerHTML = tiles
      .map(([, l]) => `<div class="board-tile"><span class="sb-value"></span><span class="label">${l}</span></div>`)
      .join("");
  }
  // Scoreboard digits flip only where the number changed.
  box.querySelectorAll(".sb-value").forEach((el, i) => {
    const v = tiles[i][0];
    if (el.dataset.value === v) return;
    el.dataset.value = v;
    flapTo(el, v, { spins: 3, stagger: 45 });
  });
}

function setChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

// Chart 1: measure by year, one line per breakdown category (top 4 + Other).
function renderTrend(rows, m, bd, groups, cats) {
  let series; // [{name, keyFn, color}]
  if (state.by === "era") {
    series = [{ name: "All selected", test: () => true, color: COLORS.navy }];
  } else {
    let top = cats.slice(0, 4);
    if (state.by === "country") top = TOP_COUNTRIES.slice(0, 4).filter((c) => groups.has(c));
    const rest = cats.filter((c) => !top.includes(c));
    series = top.map((c, i) => ({ name: c, test: (k) => k === c, color: fixedColor(c, i) }));
    if (rest.length) series.push({ name: rest.length === 1 ? rest[0] : "All other", test: (k) => !top.includes(k), color: COLORS.catOther });
  }

  const byYear = series.map(() => new Map());
  for (const r of rows) {
    const k = bd.key(r);
    series.forEach((s, i) => {
      if (!s.test(k)) return;
      let a = byYear[i].get(r.year);
      if (!a) byYear[i].set(r.year, (a = newAcc()));
      add(a, r);
    });
  }

  const datasets = series.map((s, i) => ({
    label: s.name,
    data: [...byYear[i].entries()].sort((a, b) => a[0] - b[0]).map(([y, a]) => ({ x: y, y: m.calc(a) })),
    borderColor: s.color,
    backgroundColor: s.color,
    pointHoverBackgroundColor: s.color,
    pointBackgroundColor: s.color,
    pointRadius: state.to - state.from < 3 ? 4 : 0, // a very short range has too few points to draw a line
    spanGaps: false,
  }));

  // Rates zoom to their range so the lines are readable; totals keep a zero baseline.
  const options = lineOptions({ yFormat: m.fmt, xMin: state.from, xMax: state.to, beginAtZero: m.kind === "count" });
  options.scales.x.ticks.stepSize = state.to - state.from > 60 ? 20 : state.to - state.from > 20 ? 5 : 1;
  options.plugins.legend = { display: datasets.length > 1, position: "top", align: "start" };
  options.plugins.tooltip.callbacks.label = (item) => `${item.dataset.label}: ${m.fmt(item.parsed.y)}`;
  setChart("c-trend", { type: "line", data: { datasets }, options });

  $("t-trend").textContent = `${m.label} by season${state.by === "era" ? "" : `, by ${bd.label.toLowerCase()}`}`;
  $("n-trend").textContent = series.length > 1 && cats.length > 4
    ? `The four largest groups in the current view are shown; the rest are combined as "All other".`
    : "";
}

function fixedColor(cat, i) {
  const bd = BREAKDOWNS[state.by];
  if (bd.order) {
    const idx = bd.order.indexOf(cat);
    if (cat === "Unknown" || cat === "Other") return COLORS.catOther;
    if (idx > -1 && idx < COLORS.cat.length) return COLORS.cat[idx];
  }
  return COLORS.cat[i % COLORS.cat.length];
}

// Chart 2: measure for each breakdown category.
function renderByCategory(m, bd, groups, cats) {
  const shown = state.by === "franchise" ? cats.slice(0, 12) : cats;
  const values = shown.map((c) => m.calc(groups.get(c)));
  const horizontal = shown.length > 6;
  const options = barOptions({ horizontal, valueFormat: m.fmt });
  options.plugins.barValueLabels = { format: m.fmt };
  options.plugins.tooltip = {
    callbacks: {
      label: (item) => `${m.label}: ${m.fmt(item.raw)}`,
      afterLabel: (item) => `Plate appearances: ${fmt.int(groups.get(shown[item.dataIndex]).PA)}`,
    },
  };
  options.layout = horizontal ? { padding: { right: 48 } } : { padding: { top: 18 } };
  const ds = horizontal ? horizontalBarDataset(values, COLORS.navy, m.label) : barDataset(values, COLORS.navy, m.label);
  setChart("c-by", { type: "bar", data: { labels: shown, datasets: [ds] }, options });
  $("t-by").textContent = `${m.label} by ${bd.label.toLowerCase()}`;
  $("n-by").textContent = state.by === "franchise" && cats.length > 12
    ? "The 12 teams with the most plate appearances in the current view." : "";
}

// Chart 3: measure by decade.
function renderDecade(rows, m) {
  const groups = groupBy(rows, (r) => Math.floor(r.year / 10) * 10);
  const decades = [...groups.keys()].sort((a, b) => a - b);
  const values = decades.map((d) => m.calc(groups.get(d)));
  const options = barOptions({ valueFormat: m.fmt });
  options.plugins.tooltip = { callbacks: { label: (item) => `${m.label}: ${m.fmt(item.raw)}` } };
  setChart("c-decade", {
    type: "bar",
    data: { labels: decades.map((d) => d + "s"), datasets: [barDataset(values, COLORS.navy, m.label)] },
    options,
  });
  $("t-decade").textContent = `${m.label} by decade`;
  $("n-decade").textContent = "Decades are cut to the selected year range.";
}

// Chart 4: top 10 players on the measure within the current view.
function renderPlayers(rows, m) {
  const groups = new Map();
  const names = new Map();
  for (const r of rows) {
    let a = groups.get(r.playerID);
    if (!a) { groups.set(r.playerID, (a = newAcc())); names.set(r.playerID, r.name); }
    add(a, r);
  }
  const MIN_PA = 1000;
  let measure = m;
  let note;
  if (state.measure === "players") {
    measure = MEASURES.PA;
    note = "“Players” is a count, so this chart ranks players by plate appearances instead.";
  } else if (m.kind === "rate") {
    note = `Players with at least ${fmt.int(MIN_PA)} plate appearances in the current view.`;
  } else {
    note = "Totals within the current view.";
  }
  const list = [...groups.entries()]
    .filter(([, a]) => m.kind !== "rate" || a.PA >= MIN_PA)
    .map(([id, a]) => ({ name: names.get(id), v: measure.calc(a) }))
    .filter((p) => p.v != null)
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);

  const options = barOptions({ horizontal: true, valueFormat: measure.fmt });
  options.plugins.barValueLabels = { format: measure.fmt };
  options.plugins.tooltip = { callbacks: { label: (item) => `${measure.label}: ${measure.fmt(item.raw)}` } };
  options.layout = { padding: { right: 52 } };
  setChart("c-players", {
    type: "bar",
    data: { labels: list.map((p) => p.name), datasets: [horizontalBarDataset(list.map((p) => p.v), COLORS.red, measure.label)] },
    options,
  });
  $("t-players").textContent = `Top 10 players: ${measure.label.toLowerCase()}`;
  $("n-players").textContent = list.length ? note : "No players meet the minimum in this view.";
}

// Chart 5: share of plate appearances by breakdown category.
function renderShare(bd, groups, cats, total) {
  const shown = state.by === "franchise" ? cats.slice(0, 12) : cats;
  const values = shown.map((c) => pct(groups.get(c).PA, total.PA));
  const horizontal = shown.length > 6;
  const f = (v) => fmt.pct(v);
  const options = barOptions({ horizontal, valueFormat: (v) => v + "%" });
  options.plugins.barValueLabels = { format: f };
  options.plugins.tooltip = { callbacks: { label: (item) => `Share of plate appearances: ${f(item.raw)}` } };
  options.layout = horizontal ? { padding: { right: 48 } } : { padding: { top: 18 } };
  const ds = horizontal ? horizontalBarDataset(values, COLORS.navy, "Share of PA") : barDataset(values, COLORS.navy, "Share of PA");
  setChart("c-share", { type: "bar", data: { labels: shown, datasets: [ds] }, options });
  $("t-share").textContent = `Share of plate appearances by ${bd.label.toLowerCase()}`;
  $("n-share").textContent = "How much of the batting in the current view each group accounts for.";
}

// Table: numbers behind the current view.
function renderTable(bd, groups, cats, total) {
  const cols = [
    ["Players", (a) => fmt.int(a.players.size), "players"],
    ["PA", (a) => fmt.int(a.PA), "PA"],
    ["H", (a) => fmt.int(a.H), "H"],
    ["HR", (a) => fmt.int(a.HR), "HR"],
    ["SO", (a) => fmt.int(a.SO), "SO"],
    ["SB", (a) => fmt.int(a.SB), "SB"],
    ["AVG", (a) => MEASURES.AVG.fmt(MEASURES.AVG.calc(a)), "AVG"],
    ["OBP", (a) => MEASURES.OBP.fmt(MEASURES.OBP.calc(a)), "OBP"],
    ["SLG", (a) => MEASURES.SLG.fmt(MEASURES.SLG.calc(a)), "SLG"],
    ["HR %", (a) => MEASURES.HRpct.fmt(MEASURES.HRpct.calc(a)), "HRpct"],
    ["K %", (a) => MEASURES.Kpct.fmt(MEASURES.Kpct.calc(a)), "Kpct"],
    ["BB %", (a) => MEASURES.BBpct.fmt(MEASURES.BBpct.calc(a)), "BBpct"],
  ];
  const hl = (key) => (key === state.measure ? ' class="num hl"' : ' class="num"');
  const head = `<thead><tr><th>${bd.label}</th>${cols.map(([h, , k]) => `<th${hl(k)}>${h}</th>`).join("")}</tr></thead>`;
  const body = cats.map((c) => `<tr><td>${c}</td>${cols.map(([, f, k]) => `<td${hl(k)}>${f(groups.get(c))}</td>`).join("")}</tr>`).join("");
  const foot = `<tfoot><tr><td>Total</td>${cols.map(([, f, k]) => `<td${hl(k)}>${f(total)}</td>`).join("")}</tr></tfoot>`;
  $("table").innerHTML = head + `<tbody>${body}</tbody>` + foot;
  $("t-table").textContent = `The numbers behind this view, by ${bd.label.toLowerCase()}`;
}

// ---------- Controls --------------------------------------------------------------
function fillSelect(el, options, value) {
  el.innerHTML = options.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
  el.value = value;
}

function buildControls() {
  const yearOpts = YEARS.map((y) => [y, y]);
  fillSelect($("f-from"), yearOpts, state.from);
  fillSelect($("f-to"), yearOpts, state.to);

  const franchises = [...new Set(ROWS.map((r) => r.franchise))].sort();
  fillSelect($("f-franchise"), [["ALL", "All teams"], ...franchises.map((f) => [f, f])], state.franchise);

  const countryCounts = new Map();
  ROWS.forEach((r) => countryCounts.set(r.country, (countryCounts.get(r.country) || 0) + 1));
  const countries = [...countryCounts.keys()].sort((a, b) => countryCounts.get(b) - countryCounts.get(a));
  fillSelect($("f-country"), [["ALL", "All countries"], ...countries.map((c) => [c, c])], state.country);

  fillSelect($("s-measure"), Object.entries(MEASURES).map(([k, m]) => [k, m.label]), state.measure);

  $("s-by").innerHTML = Object.entries(BREAKDOWNS)
    .map(([k, b]) => `<button type="button" role="radio" data-by="${k}">${b.label}</button>`)
    .join("");

  const bind = (id, key, num = false) =>
    $(id).addEventListener("change", (e) => {
      state[key] = num ? Number(e.target.value) : e.target.value;
      if (state.from > state.to) {
        [state.from, state.to] = key === "from" ? [state.from, state.from] : [state.to, state.to];
        $("f-from").value = state.from; $("f-to").value = state.to;
      }
      render();
    });
  bind("f-from", "from", true);
  bind("f-to", "to", true);
  bind("f-league", "league");
  bind("f-franchise", "franchise");
  bind("f-bats", "bats");
  bind("f-country", "country");
  bind("s-measure", "measure");

  $("s-by").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-by]");
    if (!b) return;
    state.by = b.dataset.by;
    syncControls();
    render();
  });

  $("reset").addEventListener("click", () => {
    Object.assign(state, DEFAULTS);
    syncControls();
    render();
  });
  syncControls();
}

function syncControls() {
  $("f-from").value = state.from;
  $("f-to").value = state.to;
  $("f-league").value = state.league;
  $("f-franchise").value = state.franchise;
  $("f-bats").value = state.bats;
  $("f-country").value = state.country;
  $("s-measure").value = state.measure;
  document.querySelectorAll("#s-by button").forEach((b) => {
    const on = b.dataset.by === state.by;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  });
}

// ---------- Load ------------------------------------------------------------------
const num = (v) => (v === "" || v == null ? 0 : Number(v));

Papa.parse("data/batting_clean.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: (res) => {
    ROWS = res.data.map((r) => ({
      year: Number(r.year), era: r.era, playerID: r.playerID, name: r.name, bats: r.bats,
      country: r.country, franchise: r.franchise, lgGroup: r.lgGroup,
      mlb: r.lgGroup === "American League" || r.lgGroup === "National League",
      PA: num(r.PA), AB: num(r.AB), H: num(r.H), D: num(r["2B"]), T: num(r["3B"]), HR: num(r.HR),
      BB: num(r.BB), HBP: num(r.HBP), SF: num(r.SF), SB: num(r.SB),
      // Negro League strikeouts are recorded for only some games (0.8% of PA where present),
      // so they are left out of strikeout totals and rates. See About the Data.
      SO: num(r.SO), SOknown: r.SO !== "" && r.lgGroup !== "Negro Leagues",
    }));
    YEARS = [...new Set(ROWS.map((r) => r.year))].sort((a, b) => a - b);
    $("loading").hidden = true;
    $("dash").hidden = false;
    buildControls();
    render();
    window.addEventListener("themechange", () => { refreshColors(); render(); });
  },
  error: (err) => {
    $("loading").textContent = "The data file could not be loaded. If you opened this page directly from disk, serve the folder instead (see README).";
    console.error(err);
  },
});
