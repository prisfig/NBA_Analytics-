import pandas as pd

files = [

    "nba_2023_october.csv",
    "nba_2023_november.csv",
    "nba_2023_december.csv",
    "nba_2024_january.csv",
    "nba_2024_february.csv",
    "nba_2024_march.csv",
    "nba_2024_april.csv",
    "nba_2024_may.csv",
    "nba_2024_june.csv"

]

dfs = []

for file in files:

    df = pd.read_csv(file)

    dfs.append(df)

games = pd.concat(dfs)

games.to_csv(
    "nba_2024_games.csv",
    index=False
)

print("CSV 2024 combinado ")