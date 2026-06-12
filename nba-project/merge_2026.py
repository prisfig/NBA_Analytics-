import pandas as pd

files = [

    "nba_2025_october.csv",
    "nba_2025_november.csv",
    "nba_2025_december.csv",

    "nba_2026_january.csv",
    "nba_2026_february.csv",
    "nba_2026_march.csv",
    "nba_2026_april.csv",
    "nba_2026_may.csv"

]

dfs = []

for file in files:

    df = pd.read_csv(file)

    dfs.append(df)

games = pd.concat(dfs)

games.to_csv(
    "nba_2026_games.csv",
    index=False
)

print("CSV 2026 combinado ")