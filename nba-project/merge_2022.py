import pandas as pd

files = [

    'nba_2021_october.csv',
    'nba_2021_november.csv',
    'nba_2021_december.csv',
    'nba_2022_january.csv',
    'nba_2022_february.csv',
    'nba_2022_march.csv',
    'nba_2022_april.csv',
    'nba_2022_may.csv',
    'nba_2022_june.csv'

]

dataframes = []

for file in files:

    df = pd.read_csv(file)

    dataframes.append(df)

merged_df = pd.concat(
    dataframes,
    ignore_index=True
)

merged_df.to_csv(
    'nba_2022_games.csv',
    index=False
)

print(
    'CSV files merged successfully.'
)