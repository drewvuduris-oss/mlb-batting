# The Box Score: A Statistical History of Major League Batting

A two-page website about how hitting in Major League Baseball has changed from 1871 to 2025.

- **Report** (`index.html`): ten findings about strikeouts, home runs, eras of offense and players, each with a chart.
- **Dashboard** (`dashboard.html`): filters, switches, charts and a table that recalculate in the browser.

Built by Drew Vuduris for Financial Data Analytics.

## Data source

The [Lahman Baseball Database](https://sabr.org/lahman-database/), 1871–2025 release (December 10, 2025),
maintained by the Society for American Baseball Research (SABR). It covers the American and National
Leagues, the Negro Leagues and the early major leagues (National Association, American Association,
Union Association, Players' League, Federal League). See `data/raw/readme2025.txt` for full details.

One row of the cleaned data is **one player's batting line for one team in one season**
(106,470 rows after dropping 22,128 rows with zero at-bats).

## Files

| File | What it does |
|---|---|
| `index.html` | The report page: the 3D baseball opening, summary, headline numbers on a scoreboard, ten finding sections with charts, two historical photographs, and the "About the data" section explaining the source, rows dropped and every formula. |
| `dashboard.html` | The dashboard page: filters (years, league, team, batting hand, birth country), a measure switch, a breakdown switch, six summary numbers on a scoreboard, five charts, a table and a reset button. |
| `css/style.css` | Shared navigation bar, fonts, colors and layout for both pages: cream paper, classic serif type and a green hand-operated scoreboard. Every text color meets the WCAG AA contrast standard. |
| `js/site.js` | Shared page behavior: scroll-in animations and the scoreboard number plates that slide into place. |
| `js/charts-common.js` | Shared chart styling (Chart.js defaults, colors, draw-in animations, label wrapping on narrow screens) and number formatting used by both pages. |
| `js/report.js` | Runs the report's opening scroll steps, photo drift and scoreboard flip cards, and draws the ten charts from `data/report_numbers.json` as each one scrolls into view. |
| `js/hero-ball.js` | The 3D baseball in the report's opening (built with [Three.js](https://threejs.org/)): an old, worn ball drawn entirely in code that turns as you scroll. Decorative only; it shows no data. |
| `js/dashboard.js` | Loads `data/batting_clean.csv`, applies the filters, computes every dashboard number and draws the charts and table. |
| `scripts/build_data.py` | Builds `data/batting_clean.csv` from the raw files: joins player, team and franchise information, adds era, league group and plate appearances, fixes country names and drops rows with zero at-bats. |
| `scripts/report_stats.py` | Computes every number cited on the report page and writes `data/report_numbers.json`. |
| `data/batting_clean.csv` | The cleaned data set the dashboard loads (106,470 rows, 24 columns). |
| `data/report_numbers.json` | Season, era, decade, batting-hand and career numbers used by the report charts. |
| `data/raw/Batting.csv` | Lahman batting table: one row per player, team and season (128,598 rows). |
| `data/raw/People.csv` | Lahman player table: names, batting hand, birth country. |
| `data/raw/Teams.csv` | Lahman team-season table: used for franchise IDs and games per season. |
| `data/raw/TeamsFranchises.csv` | Lahman franchise names. |
| `data/raw/readme2025.txt` | Lahman documentation for this release. |
| `img/cobb-1909.jpg` | Ty Cobb sliding into third base, 1909, by Charles M. Conlon (public domain, via Wikimedia Commons), cropped and toned to match the site. |
| `img/ruth-1927.jpg` | Babe Ruth taking a warm-up swing, c. 1927, by Charles M. Conlon (public domain, via Wikimedia Commons), cropped and toned to match the site. |
| `img/emblem-mark.svg` | The site's original emblem (crossed bats and a ball), used in the navigation bar. |
| `favicon.svg` | The emblem as the browser-tab icon. |
| `.gitignore` | Files git should not track (editor and OS files, Python caches). |

## Cleaned data columns

`year`, `era`, `playerID`, `name`, `bats`, `country`, `team`, `franchise`, `league`, `lgGroup`,
`G`, `PA`, `AB`, `R`, `H`, `2B`, `3B`, `HR`, `RBI`, `SB`, `BB`, `SO`, `HBP`, `SF`.
Blank values mean the statistic was not recorded for that season.

## Reproducing the numbers

Requires Python 3 with pandas.

```
python scripts/build_data.py     # data/raw/*  ->  data/batting_clean.csv
python scripts/report_stats.py   # data/batting_clean.csv  ->  data/report_numbers.json
```

## Libraries

Loaded from the jsDelivr CDN: [Chart.js](https://www.chartjs.org/) 4.4.1 (charts),
[Papa Parse](https://www.papaparse.com/) 5.4.1 (reading the CSV in the dashboard) and
[Three.js](https://threejs.org/) 0.160.0 (the 3D baseball). Fonts from Google Fonts: Libre Caslon
Display and Libre Caslon Text (headings), Inter (text and numbers) and Barlow Condensed (scoreboard).

## Photographs

Both photographs are by Charles M. Conlon and are in the public domain; the originals are on
Wikimedia Commons ("Cobb slide into third.jpg" and "Babe Ruth Warm Up Swing.png"). They were cropped
and given a warm duotone so they match the page. This is an independent student project and is not
affiliated with Major League Baseball.

## Viewing the site locally

The pages load data files with `fetch`, so open them through a local web server rather than by
double-clicking the HTML file:

```
python -m http.server 8000
```

Then visit http://localhost:8000.
