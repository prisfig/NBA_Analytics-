import pandas as pd
import mysql.connector

df = pd.read_csv(
    "nba_2026_games.csv"
)

print(df.columns)

connection = mysql.connector.connect(
    host="localhost",
    user="root",
    password="administrador",
    database="NBA_db"
)

cursor = connection.cursor()

for index, row in df.iterrows():

    sql = """
    INSERT INTO GamesRaw (
    GameDate,
    StartTime,
    AwayTeam,
    AwayPoints,
    HomeTeam,
    HomePoints,
    BoxScore,
    OT,
    Attendance,
    GameLength,
    Arena,
    Notes
)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    values = (
    str(row["Date"]),
    str(row["Start (ET)"]),
    str(row["Visitor/Neutral"]),
    str(row["PTS"]),
    str(row["Home/Neutral"]),
    str(row["PTS.1"]),
    str(row["Unnamed: 6"]),
    str(row["Unnamed: 7"]),
    str(row["Attend."]),
    str(row["LOG"]),
    str(row["Arena"]),
    str(row["Notes"])
)
    cursor.execute(sql, values)

connection.commit()

print("Datos importados ")

cursor.close()
connection.close()