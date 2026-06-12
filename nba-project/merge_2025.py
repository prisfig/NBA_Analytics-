import pandas as pd

files = [

    "nba_2024_october.csv",
    "nba_2024_november.csv",
    "nba_2024_december.csv",

    "nba_2025_january.csv",
    "nba_2025_february.csv",
    "nba_2025_march.csv",
    "nba_2025_april.csv",
    "nba_2025_may.csv",
    "nba_2025_june.csv"

]

dfs = []

for file in files:

    df = pd.read_csv(file)

    dfs.append(df)

games = pd.concat(dfs)

games.to_csv(
    "nba_2025_games.csv",
    index=False
)

print("CSV 2025 combinado ")