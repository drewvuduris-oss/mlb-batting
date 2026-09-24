# Swing and a Miss: 155 Years of MLB Batting

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
| `index.html` | The report page: summary, headline numbers, ten finding sections with charts, and the "About the data" section explaining the source, rows dropped and every formula. |
| `dashboard.html` | The dashboard page: filters (years, league, team, batting hand, birth country), a measure switch, a breakdown switch, six summary numbers, five charts, a table and a reset button. |
| `css/style.css` | Shared navigation bar, fonts, colors and layout for both pages. |
| `js/charts-common.js` | Shared chart styling (Chart.js defaults, colors, bar and line settings) and number formatting used by both pages. |
| `js/report.js` | Draws the report charts from `data/report_numbers.json`. |
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

## Viewing the site locally

The pages load data files with `fetch`, so open them through a local web server rather than by
double-clicking the HTML file:

```
python -m http.server 8000
```

Then visit http://localhost:8000.
