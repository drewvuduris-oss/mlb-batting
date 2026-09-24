"""Compute every number used on the report page (index.html).

Reads data/batting_clean.csv (built by build_data.py) and writes
data/report_numbers.json, which the report's charts load.

Run from the repository root:
    python scripts/report_stats.py
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "data" / "batting_clean.csv"
TEAMS = ROOT / "data" / "raw" / "Teams.csv"
OUT = ROOT / "data" / "report_numbers.json"

MLB = ["American League", "National League"]
ERA_ORDER = ["19th Century", "Dead Ball", "Live Ball", "Integration",
             "Expansion", "Free Agency", "Steroid", "Modern"]


def load() -> pd.DataFrame:
    return pd.read_csv(CLEAN, keep_default_na=False, na_values={
        c: [""] for c in ["RBI", "SB", "SO", "HBP", "SF"]})


def rates(g: pd.DataFrame) -> dict:
    """League rates built from totals (sum of H / sum of AB, not an average of averages).
    Missing HBP and SF count as 0. Strikeout rate uses only rows where SO was recorded."""
    s = g[["PA", "AB", "H", "2B", "3B", "HR", "BB", "HBP", "SF"]].sum()
    so = g.dropna(subset=["SO"])
    singles = s.H - s["2B"] - s["3B"] - s.HR
    return {
        "PA": int(s.PA),
        "H": int(s.H),
        "HR": int(s.HR),
        "SO": int(so.SO.sum()),
        "AVG": s.H / s.AB,
        "OBP": (s.H + s.BB + s.HBP) / (s.AB + s.BB + s.HBP + s.SF),
        "SLG": (singles + 2 * s["2B"] + 3 * s["3B"] + 4 * s.HR) / s.AB,
        "HRpct": s.HR / s.PA * 100,
        "Kpct": so.SO.sum() / so.PA.sum() * 100,
        "BBpct": s.BB / s.PA * 100,
        "singlesPct": singles / s.H * 100,
    }


def rnd(obj, nd=6):
    """Round floats in nested dicts/lists for a tidy JSON file."""
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, dict):
        return {k: rnd(v, nd) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rnd(v, nd) for v in obj]
    return obj


def main() -> None:
    d = load()
    mlb = d[d.lgGroup.isin(MLB)]

    # ---- Season-by-season league rates (AL + NL) --------------------------------
    yearly = [{"year": int(y), **rates(g)} for y, g in mlb.groupby("year")]

    # ---- Player-seasons: a traded player's stints are added together ------------
    ps = mlb.groupby(["playerID", "name", "year"], as_index=False)[
        ["PA", "AB", "H", "HR"]].sum()
    ps["AVG"] = ps.H / ps.AB

    # Qualified hitter = 3.1 PA per scheduled team game. Games per team = the most
    # games any AL/NL team played that season (from Teams.csv).
    teams = pd.read_csv(TEAMS, encoding="utf-8-sig", keep_default_na=False)
    games = teams[teams.lgID.isin(["AL", "NL"])].groupby("yearID").G.max()
    ps["qualified"] = ps.PA >= ps.year.map(games) * 3.1
    q = ps[ps.qualified]
    n300 = q[q.AVG >= 0.300].groupby("year").size()
    n30hr = ps[ps.HR >= 30].groupby("year").size()
    for row in yearly:
        row["hitters300"] = int(n300.get(row["year"], 0))
        row["qualified"] = int((q.year == row["year"]).sum())
        row["hr30"] = int(n30hr.get(row["year"], 0))

    yr = pd.DataFrame(yearly).set_index("year")

    # ---- Eras --------------------------------------------------------------------
    eras = []
    for era in ERA_ORDER:
        g = mlb[mlb.era == era]
        eras.append({"era": era, "first": int(g.year.min()), "last": int(g.year.max()), **rates(g)})

    # ---- Foreign-born share of players by decade (AL + NL) -------------------------
    players = mlb.drop_duplicates(["playerID", "year"])
    players = players[players.country != "Unknown"].assign(decade=lambda x: x.year // 10 * 10)
    foreign = []
    for dec, g in players.groupby("decade"):
        uniq = g.drop_duplicates("playerID")
        foreign.append({"decade": int(dec), "players": len(uniq),
                        "foreignPct": (uniq.country != "USA").mean() * 100})
    countries_2025 = (players[(players.year == 2025) & (players.country != "USA")]
                      .country.value_counts().head(8))

    # ---- Batting hand, 2006-2025 (AL + NL) ---------------------------------------
    hand = []
    modern = mlb[(mlb.year >= 2006) & (mlb.bats != "Unknown")]
    for bats in ["Left", "Right", "Switch"]:
        r = rates(modern[modern.bats == bats])
        hand.append({"bats": bats, "PApct": r["PA"] / modern.PA.sum() * 100, **r})

    # ---- Career home run leaders (all leagues in the data) -------------------------
    car = d.groupby(["playerID", "name"]).agg(HR=("HR", "sum"), first=("year", "min"),
                                              last=("year", "max")).reset_index()
    # People.csv has no name suffix, so father and son share "Ken Griffey".
    car.loc[car.playerID == "griffke02", "name"] = "Ken Griffey Jr."
    career_hr = (car.nlargest(10, "HR")[["name", "HR", "first", "last"]]
                 .to_dict("records"))

    # ---- Headline facts cited in the text ------------------------------------------
    so_gt_h = yr[yr.SO > yr.H].index
    since68 = yr.loc[1969:, "AVG"]
    facts = {
        "rawRows": 128598,
        "rows": len(d),
        "droppedRows": 128598 - len(d),
        "seasons": int(d.year.nunique()),
        "players": int(d.playerID.nunique()),
        "franchises": int(d.franchise.nunique()),
        "firstSOgtH": int(so_gt_h.min()),
        "SOgtHYears": [int(y) for y in so_gt_h],
        "peakKyear": int(yr.Kpct.idxmax()), "peakK": yr.Kpct.max(),
        "peakHRyear": int(yr.HRpct.idxmax()), "peakHR": yr.HRpct.max(),
        "peakHr30year": int(yr.hr30.idxmax()), "peakHr30": int(yr.hr30.max()),
        "lowAvgYearSince1969": int(since68.idxmin()), "lowAvgSince1969": since68.min(),
        "avg1968": yr.loc[1968, "AVG"],
        "maxHitters300Since1990": int(yr.loc[1990:, "hitters300"].max()),
        "maxHitters300Since1990Year": int(yr.loc[1990:, "hitters300"].idxmax()),
        "countries2025": {k: int(v) for k, v in countries_2025.items()},
    }

    out = rnd({"facts": facts, "yearly": yearly, "eras": eras, "foreign": foreign,
               "hand": hand, "careerHR": career_hr})
    OUT.write_text(json.dumps(out, indent=1))
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
