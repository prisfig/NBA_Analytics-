import pandas as pd
import requests
import time
from io import StringIO

months = [
    "october",
    "november",
    "december",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june"
]

all_games = []

headers = {
    "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
}

for month in months:

    url = f"https://www.basketball-reference.com/leagues/NBA_2023_games-{month}.html"

    print(f"Leyendo {month}...")

    response = requests.get(
        url,
        headers=headers,
        timeout=10
    )

    print(response.status_code)

    html = response.text

    tables = pd.read_html(
        StringIO(html),
        flavor="lxml"
    )

    df = tables[0]

    all_games.append(df)

    time.sleep(3)

games = pd.concat(all_games)

games.to_csv(
    "nba_2023_games.csv",
    index=False
)

print("CSV completo creado ")