import pandas as pd

files = [

    "nba_2022_october.csv",
    "nba_2022_november.csv",
    "nba_2022_december.csv",
    "nba_2023_january.csv",
    "nba_2023_february.csv",
    "nba_2023_march.csv",
    "nba_2023_april.csv",
    "nba_2023_may.csv",
    "nba_2023_june.csv"

]

dfs = []

for file in files:

    df = pd.read_csv(file)

    dfs.append(df)

games = pd.concat(dfs)

games.to_csv(
    "nba_2023_games.csv",
    index=False
)

print("CSV combinado ")