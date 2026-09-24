"""Build data/batting_clean.csv from the raw Lahman files.

One output row = one player's batting line for one team in one season
(a player traded mid-season has one row per team, as in Batting.csv).

Run from the repository root:
    python scripts/build_data.py
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "batting_clean.csv"

# "NA" is the National Association league code, not a missing value,
# so pandas' default NA parsing is turned off for code columns.
CODE_COLS = {"lgID": str, "teamID": str, "franchID": str}

LEAGUE_GROUP = {
    "AL": "American League",
    "NL": "National League",
    # SABR-recognized Negro Leagues and major-league-caliber independent clubs
    "NNL": "Negro Leagues", "ECL": "Negro Leagues", "ANL": "Negro Leagues",
    "EWL": "Negro Leagues", "NSL": "Negro Leagues", "NN2": "Negro Leagues",
    "NAL": "Negro Leagues", "EAS": "Negro Leagues", "IND": "Negro Leagues",
    "WES": "Negro Leagues", "NAC": "Negro Leagues", "INT": "Negro Leagues",
    # Other 19th- and early-20th-century major leagues
    "NA": "Early Leagues", "AA": "Early Leagues", "UA": "Early Leagues",
    "PL": "Early Leagues", "FL": "Early Leagues",
}

# (first year, last year, label)
ERAS = [
    (1871, 1900, "19th Century"),
    (1901, 1919, "Dead Ball"),
    (1920, 1941, "Live Ball"),
    (1942, 1960, "Integration"),
    (1961, 1976, "Expansion"),
    (1977, 1993, "Free Agency"),
    (1994, 2005, "Steroid"),
    (2006, 2025, "Modern"),
]

COUNTRY_FIX = {
    "D.R.": "Dominican Republic",
    "P.R.": "Puerto Rico",
    "CAN": "Canada",
    "M�xico": "Mexico",
    "Cura�ao": "Curacao",
}

BATS = {"R": "Right", "L": "Left", "B": "Switch"}


def era_of(year: int) -> str:
    for first, last, label in ERAS:
        if first <= year <= last:
            return label
    raise ValueError(f"No era for {year}")


def main() -> None:
    stat_cols = ["G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "CS",
                 "BB", "SO", "IBB", "HBP", "SH", "SF", "GIDP"]
    bat = pd.read_csv(RAW / "Batting.csv", dtype=CODE_COLS, keep_default_na=False,
                      na_values={c: [""] for c in stat_cols})
    people = pd.read_csv(RAW / "People.csv", encoding="utf-8-sig")
    teams = pd.read_csv(RAW / "Teams.csv", encoding="utf-8-sig", dtype=CODE_COLS,
                        keep_default_na=False)
    franchises = pd.read_csv(RAW / "TeamsFranchises.csv", encoding="utf-8-sig",
                             dtype=CODE_COLS, keep_default_na=False)

    n_raw = len(bat)

    # Drop batting lines with no at-bats (mostly pitchers who never came to the plate).
    bat = bat[bat["AB"] > 0].copy()
    n_dropped = n_raw - len(bat)

    # Plate appearances. Missing HBP/SH/SF (unrecorded in early seasons) count as 0,
    # the same convention Baseball-Reference uses.
    bat["PA"] = (bat["AB"] + bat["BB"] + bat["HBP"].fillna(0)
                 + bat["SH"].fillna(0) + bat["SF"].fillna(0)).astype(int)

    # Player attributes
    people["name"] = (people["nameFirst"].fillna("") + " " + people["nameLast"].fillna("")).str.strip()
    people["bats"] = people["bats"].map(BATS).fillna("Unknown")
    people["country"] = people["birthCountry"].replace(COUNTRY_FIX).fillna("Unknown")
    bat = bat.merge(people[["playerID", "name", "bats", "country"]], on="playerID", how="left")

    # Team and franchise names
    team_names = teams[["yearID", "teamID", "franchID", "name"]].rename(columns={"name": "teamName"})
    bat = bat.merge(team_names, on=["yearID", "teamID"], how="left")
    bat = bat.merge(franchises[["franchID", "franchName"]], on="franchID", how="left")

    bat["lgGroup"] = bat["lgID"].map(LEAGUE_GROUP)
    bat["era"] = bat["yearID"].map(era_of)

    missing = bat[["teamName", "franchName", "lgGroup", "name"]].isna().sum()
    if missing.any():
        raise SystemExit(f"Unmatched joins:\n{missing[missing > 0]}")

    out = bat.rename(columns={"yearID": "year", "lgID": "league", "teamID": "team",
                              "franchName": "franchise"})[[
        "year", "era", "playerID", "name", "bats", "country",
        "team", "franchise", "league", "lgGroup",
        "G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "BB", "SO", "HBP", "SF",
    ]].sort_values(["year", "team", "playerID"])

    # Nullable ints so unknown counts stay blank instead of becoming 0 or 12.0
    for col in ["G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "BB", "SO", "HBP", "SF"]:
        out[col] = out[col].astype("Int64")

    out.to_csv(OUT, index=False)
    print(f"Raw rows: {n_raw:,}  dropped (AB = 0): {n_dropped:,}  kept: {len(out):,}")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
