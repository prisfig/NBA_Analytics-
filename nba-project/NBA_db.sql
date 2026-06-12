CREATE DATABASE NBA_db;

USE NBA_db;

CREATE TABLE Seasons (

	SeasonID INT AUTO_INCREMENT,

	SeasonName VARCHAR(20) NOT NULL,

	StartYear INT,

	EndYear INT,

	PRIMARY KEY (SeasonID)
);

CREATE TABLE Teams (

	TeamID INT AUTO_INCREMENT,

	TeamName VARCHAR(100) NOT NULL,

	Abbreviation VARCHAR(10),

	City VARCHAR(50),

	Conference VARCHAR(20),

	PRIMARY KEY (TeamID)
);

CREATE TABLE Games (

	GameID INT AUTO_INCREMENT,

	SeasonID INT NOT NULL,

	GameDate DATE NOT NULL,

	GameTime TIME,

	HomeTeamID INT NOT NULL,

	AwayTeamID INT NOT NULL,

	HomeScore INT,

	AwayScore INT,

	Overtime BOOLEAN DEFAULT FALSE,

	PlayoffGame BOOLEAN DEFAULT FALSE,

	Arena VARCHAR(100),

	StatusGame VARCHAR(30),

	PRIMARY KEY (GameID),

	CONSTRAINT fk_season
	FOREIGN KEY (SeasonID)
	REFERENCES Seasons (SeasonID),

	CONSTRAINT fk_home_team
	FOREIGN KEY (HomeTeamID)
	REFERENCES Teams (TeamID),

	CONSTRAINT fk_away_team
	FOREIGN KEY (AwayTeamID)
	REFERENCES Teams (TeamID)
);

CREATE TABLE Arenas (

	ArenaID INT AUTO_INCREMENT,

	ArenaName VARCHAR(100),

	City VARCHAR(50),

	Capacity INT,

	PRIMARY KEY (ArenaID)
);

CREATE TABLE GameStats (

	StatID INT AUTO_INCREMENT,

	GameID INT NOT NULL,

	TeamID INT NOT NULL,

	FieldGoalPct DECIMAL(5,2),

	ThreePointPct DECIMAL(5,2),

	Rebounds INT,

	Assists INT,

	Turnovers INT,

	PRIMARY KEY (StatID),

	FOREIGN KEY (GameID)
	REFERENCES Games (GameID),

	FOREIGN KEY (TeamID)
	REFERENCES Teams (TeamID)
);

CREATE TABLE GamesRaw (

	GameDate VARCHAR(50),

	StartTime VARCHAR(50),

	AwayTeam VARCHAR(100),

	AwayPoints VARCHAR(20),

	HomeTeam VARCHAR(100),

	HomePoints VARCHAR(20),

	BoxScore VARCHAR(50),

	OT VARCHAR(20),

	Attendance VARCHAR(50),

	Notes VARCHAR(200)
);

USE nba_db;

LOAD DATA LOCAL INFILE
'/Users/priscilla/Documents/nba_2023_games.csv'

INTO TABLE GamesRaw

FIELDS TERMINATED BY ','

ENCLOSED BY '"'

LINES TERMINATED BY '\n'

IGNORE 1 ROWS;

SELECT *
FROM GamesRaw;

USE NBA_db;

SELECT *
FROM GamesRaw
LIMIT 10;

#NORMALIZAR DATOS 2023

CREATE TABLE Teams (

	TeamID INT AUTO_INCREMENT,

	TeamName VARCHAR(100) NOT NULL,

	PRIMARY KEY (TeamID)
);

INSERT INTO Teams (TeamName)

SELECT DISTINCT HomeTeam
FROM GamesRaw;

CREATE TABLE Games (

	GameID INT AUTO_INCREMENT,

	GameDate DATE,

	StartTime VARCHAR(20),

	HomeTeamID INT,

	AwayTeamID INT,

	HomePoints INT,

	AwayPoints INT,

	Attendance INT,

	Arena VARCHAR(100),

	Notes VARCHAR(200),

	PRIMARY KEY (GameID),

	FOREIGN KEY (HomeTeamID)
	REFERENCES Teams (TeamID),

	FOREIGN KEY (AwayTeamID)
	REFERENCES Teams (TeamID)
);

SELECT *
FROM Games
LIMIT 10;

ALTER TABLE GamesRaw
ADD Arena VARCHAR(100);

INSERT INTO Games (

	GameDate,
	StartTime,
	HomeTeamID,
	AwayTeamID,
	HomePoints,
	AwayPoints,
	Attendance,
	Arena,
	Notes

)

SELECT

	STR_TO_DATE(
		GR.GameDate,
		'%a %b %d %Y'
	),

	GR.StartTime,

	HT.TeamID,

	AT.TeamID,

	CAST(GR.HomePoints AS UNSIGNED),

	CAST(GR.AwayPoints AS UNSIGNED),

	CAST(

		NULLIF(

			REPLACE(
				REPLACE(GR.Attendance, ',', ''),
				'.0',
				''
			),

			'nan'

		)

	AS UNSIGNED),

	GR.Arena,

	GR.Notes

FROM GamesRaw GR

JOIN Teams HT
ON GR.HomeTeam = HT.TeamName

JOIN Teams AT
ON GR.AwayTeam = AT.TeamName;

INSERT INTO Seasons (
	SeasonName,
	StartYear,
	EndYear
)

VALUES

('2022-23', 2022, 2023),
('2023-24', 2023, 2024),
('2024-25', 2024, 2025),
('2025-26', 2025, 2026);

ALTER TABLE Games
ADD SeasonID INT;

ALTER TABLE Games

ADD CONSTRAINT fk_season

FOREIGN KEY (SeasonID)
REFERENCES Seasons (SeasonID);

UPDATE Games
SET SeasonID = 1;

INSERT INTO Games (

	GameDate,
	StartTime,
	HomeTeamID,
	AwayTeamID,
	HomePoints,
	AwayPoints,
	Attendance,
	Arena,
	Notes

)

SELECT

	STR_TO_DATE(
		GR.GameDate,
		'%a %b %d %Y'
	),

	GR.StartTime,

	HT.TeamID,

	AT.TeamID,

	CAST(GR.HomePoints AS UNSIGNED),

	CAST(GR.AwayPoints AS UNSIGNED),

	CAST(

		NULLIF(

			REPLACE(
				REPLACE(GR.Attendance, ',', ''),
				'.0',
				''
			),

			'nan'

		)

	AS UNSIGNED),

	GR.Arena,

	GR.Notes

FROM GamesRaw GR

JOIN Teams HT
ON GR.HomeTeam = HT.TeamName

JOIN Teams AT
ON GR.AwayTeam = AT.TeamName;

UPDATE Games
SET SeasonID = 2
WHERE SeasonID IS NULL;

ALTER TABLE GamesRaw
ADD GameLength VARCHAR(20);

ALTER TABLE Games
ADD GameLength VARCHAR(20);

SET SQL_SAFE_UPDATES = 0;

DELETE FROM GamesRaw;

SET SQL_SAFE_UPDATES = 0;

DELETE FROM Games;

DELETE FROM GamesRaw;

INSERT INTO Games (

	GameDate,
	StartTime,
	HomeTeamID,
	AwayTeamID,
	HomePoints,
	AwayPoints,
	Attendance,
	GameLength,
	Arena,
	Notes

)

SELECT

	STR_TO_DATE(
		GR.GameDate,
		'%a %b %d %Y'
	),

	GR.StartTime,

	HT.TeamID,

	AT.TeamID,

	CAST(GR.HomePoints AS UNSIGNED),

	CAST(GR.AwayPoints AS UNSIGNED),

	CAST(

		NULLIF(

			REPLACE(
				REPLACE(GR.Attendance, ',', ''),
				'.0',
				''
			),

			'nan'

		)

	AS UNSIGNED),

	GR.GameLength,

	GR.Arena,

	GR.Notes

FROM GamesRaw GR

JOIN Teams HT
ON GR.HomeTeam = HT.TeamName

JOIN Teams AT
ON GR.AwayTeam = AT.TeamName;

UPDATE Games
SET SeasonID = 1
WHERE SeasonID IS NULL;

DELETE FROM GamesRaw;

UPDATE Games
SET SeasonID = 3
WHERE SeasonID IS NULL;

DELETE FROM GamesRaw;

INSERT INTO Games (

	GameDate,
	StartTime,
	HomeTeamID,
	AwayTeamID,
	HomePoints,
	AwayPoints,
	Attendance,
	GameLength,
	Arena,
	Notes

)

SELECT

	STR_TO_DATE(
		GR.GameDate,
		'%a %b %d %Y'
	),

	GR.StartTime,

	HT.TeamID,

	AT.TeamID,

	COALESCE(

		FLOOR(

			NULLIF(
				GR.HomePoints,
				'nan'
			)

		),

		0

	),

	COALESCE(

		FLOOR(

			NULLIF(
				GR.AwayPoints,
				'nan'
			)

		),

		0

	),

	COALESCE(

		FLOOR(

			NULLIF(

				REPLACE(
					GR.Attendance,
					',',
					''
				),

				'nan'

			)

		),

		0

	),

	GR.GameLength,

	GR.Arena,

	GR.Notes

FROM GamesRaw GR

JOIN Teams HT
ON GR.HomeTeam = HT.TeamName

JOIN Teams AT
ON GR.AwayTeam = AT.TeamName;

SELECT

	G.GameDate,

	G.StartTime,

	HT.TeamName AS HomeTeam,

	AT.TeamName AS AwayTeam,

	G.HomePoints,

	G.AwayPoints,

	G.Attendance,

	G.GameLength,

	G.Arena

FROM Games G

JOIN Teams HT
ON G.HomeTeamID = HT.TeamID

JOIN Teams AT
ON G.AwayTeamID = AT.TeamID

WHERE
	MONTH(G.GameDate) = 11
	AND YEAR(G.GameDate) = 2022

ORDER BY G.GameDate;

UPDATE Games
SET SeasonID = 4
WHERE SeasonID IS NULL;

SELECT
	S.SeasonName,
	COUNT(*) AS TotalGames
    
    

FROM Games G

JOIN Seasons S
ON G.SeasonID = S.SeasonID

GROUP BY S.SeasonName;

CREATE TABLE TeamStats (

	StatID INT AUTO_INCREMENT,

	GameID INT,

	FieldGoalPct DECIMAL(5,2),

	ThreePointPct DECIMAL(5,2),

	FreeThrowPct DECIMAL(5,2),

	Rebounds INT,

	Assists INT,

	Turnovers INT,

	PRIMARY KEY (StatID),

	FOREIGN KEY (GameID)
	REFERENCES Games (GameID)
);

#CONSULTAS DE EJEMPLO
# Equipos con más victorias

SELECT

	T.TeamName,

	COUNT(*) AS Wins

FROM Games G

JOIN Teams T
ON G.HomeTeamID = T.TeamID

WHERE G.HomePoints > G.AwayPoints

GROUP BY T.TeamName

ORDER BY Wins DESC;

# Equipos con mejor promedio ofensivo
SELECT

	T.TeamName,

	AVG(G.HomePoints) AS AvgPoints

FROM Games G

JOIN Teams T
ON G.HomeTeamID = T.TeamID

GROUP BY T.TeamName

ORDER BY AvgPoints DESC;

#Arenas con mayor asistencia
SELECT

	Arena,

	AVG(Attendance) AS AvgAttendance

FROM Games

GROUP BY Arena

ORDER BY AvgAttendance DESC;

# Juegos más largos
SELECT

	GameDate,

	GameLength,

	Arena

FROM Games

ORDER BY GameLength DESC

LIMIT 20;

#Victorias por temporada
SELECT

	S.SeasonName,

	COUNT(*) AS TotalGames

FROM Games G

JOIN Seasons S
ON G.SeasonID = S.SeasonID

GROUP BY S.SeasonName;

UPDATE Games
SET GameLength = NULL
WHERE GameLength = 'nan';

SELECT

	GameDate,

	GameLength,

	Arena

FROM Games

ORDER BY GameLength DESC

LIMIT 20;

UPDATE Games
SET Notes = NULL
WHERE Notes = 'nan';

UPDATE Games
SET GameLength = NULL
WHERE GameLength = 'nan';

DESCRIBE Games;

LOAD DATA LOCAL INFILE
'/Users/priscilla/Documents/nba_2022_games.csv'

INTO TABLE GamesRaw

FIELDS TERMINATED BY ','

ENCLOSED BY '"'

LINES TERMINATED BY '\n'

IGNORE 1 ROWS;

DROP TABLE GamesRaw;

CREATE TABLE GamesRaw (

	GameDate VARCHAR(50),

	StartTime VARCHAR(50),

	AwayTeam VARCHAR(100),

	AwayPoints VARCHAR(20),

	HomeTeam VARCHAR(100),

	HomePoints VARCHAR(20),

	BoxScore VARCHAR(50),

	OT VARCHAR(20),

	Attendance VARCHAR(50),

	GameLength VARCHAR(20),

	Arena VARCHAR(100),

	Notes VARCHAR(200)

);

SELECT COUNT(*) FROM GamesRaw;

INSERT INTO Games (

	GameDate,
	StartTime,
	HomeTeamID,
	AwayTeamID,
	HomePoints,
	AwayPoints,
	Attendance,
	GameLength,
	Arena,
	Notes

)

SELECT

	STR_TO_DATE(
		GR.GameDate,
		'%a %b %d %Y'
	),

	GR.StartTime,

	HT.TeamID,

	AT.TeamID,

	COALESCE(

		FLOOR(

			NULLIF(
				GR.HomePoints,
				'nan'
			)

		),

		0

	),

	COALESCE(

		FLOOR(

			NULLIF(
				GR.AwayPoints,
				'nan'
			)

		),

		0

	),

	COALESCE(

		FLOOR(

			NULLIF(

				REPLACE(
					GR.Attendance,
					',',
					''
				),

				'nan'

			)

		),

		0

	),

	GR.GameLength,

	GR.Arena,

	GR.Notes

FROM GamesRaw GR

JOIN Teams HT
ON GR.HomeTeam = HT.TeamName

JOIN Teams AT
ON GR.AwayTeam = AT.TeamName;

SELECT COUNT(*) FROM Games;

SELECT

	G.GameDate,

	HT.TeamName AS HomeTeam,

	AT.TeamName AS AwayTeam,

	G.HomePoints,

	G.AwayPoints,

	G.Arena

FROM Games G

JOIN Teams HT
ON G.HomeTeamID = HT.TeamID

JOIN Teams AT
ON G.AwayTeamID = AT.TeamID

WHERE
	MONTH(G.GameDate) = 11
	AND YEAR(G.GameDate) = 2021

ORDER BY G.GameDate;


INSERT INTO Seasons (

	SeasonName,
	StartYear,
	EndYear

)

VALUES (

	'2021-22',
	2021,
	2022

);

SELECT * FROM Seasons;

UPDATE Games
SET SeasonID = 5
WHERE
	YEAR(GameDate) = 2021
	OR YEAR(GameDate) = 2022
	AND SeasonID IS NULL;

SELECT * FROM Teams;

SELECT

COUNT(*) AS Wins2023

FROM Games

WHERE

(

	(

		HomeTeamID = 16
		AND HomePoints > AwayPoints

	)

	OR

	(

		AwayTeamID = 16
		AND AwayPoints > HomePoints

	)

)

AND YEAR(GameDate) = 2023;


SELECT *
FROM seasons;

SELECT *
FROM Games;

SELECT COUNT(*) AS TotalGames
FROM Games;

SELECT COUNT(*) AS TotalGames
FROM Games
WHERE YEAR(GameDate) = 2023


;



SELECT
    s.SeasonName,
    s.StartYear,
    s.EndYear,
    COUNT(*) AS Games
FROM Games g
JOIN Seasons s
    ON YEAR(g.GameDate) BETWEEN s.StartYear AND s.EndYear
GROUP BY s.SeasonName, s.StartYear, s.EndYear
ORDER BY s.StartYear;

SELECT
    SeasonName,
    StartYear,
    EndYear
FROM Seasons
ORDER BY StartYear; 

SELECT
    YEAR(GameDate) AS Year,
    COUNT(*) AS Games
FROM Games
GROUP BY YEAR(GameDate)
ORDER BY Year;

SELECT
    YEAR(GameDate) AS Year,
    MIN(GameDate) AS FirstGame,
    MAX(GameDate) AS LastGame,
    COUNT(*) AS Games
FROM Games
GROUP BY YEAR(GameDate)
ORDER BY Year;

DESCRIBE NBA_db.Seasons;
SELECT * FROM NBA_db.Seasons ORDER BY SeasonID;

SELECT
    MIN(GameDate) AS FirstGame,
    MAX(GameDate) AS LastGame,
    COUNT(*) AS Games
FROM Games
WHERE
(
    YEAR(GameDate)=2025 AND MONTH(GameDate)>=10
)
OR
(
    YEAR(GameDate)=2026 AND MONTH(GameDate)<=6
);

SELECT
    s.SeasonName,
    s.StartYear,
    COUNT(*) AS Games
FROM Games g
JOIN Seasons s
ON (
    (YEAR(g.GameDate)=s.StartYear AND MONTH(g.GameDate)>=10)
    OR
    (YEAR(g.GameDate)=s.EndYear AND MONTH(g.GameDate)<=6)
)
GROUP BY
    s.SeasonName,
    s.StartYear
ORDER BY s.StartYear;


-- ── Jun 3: Spurs 95 - Knicks 105 (resultado confirmado en BR) ──
-- GameID 20252 = 2026-05-30 Oklahoma City vs San Antonio (pendiente)
-- Necesitamos el de Jun 3. Buscarlo:
SELECT GameID, GameDate, HomeTeamID, AwayTeamID 
FROM NBA_db.Games 
WHERE GameDate = '2026-06-03' 
  AND HomeTeamID = 11  -- San Antonio Spurs
  AND AwayTeamID = 19; -- New York Knicks
  
  -- Insertar Jun 3: Spurs (home) 95 vs Knicks (away) 105 — resultado ya jugado
INSERT INTO NBA_db.Games 
  (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, Attendance, GameLength, SeasonID)
VALUES 
  ('2026-06-03', 11, 19, 95, 105, 18835, '2:30', 5);

-- Insertar Jun 5: Spurs (home) vs Knicks (away) — aún sin resultado
INSERT INTO NBA_db.Games 
  (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, SeasonID, Arena, StartTime)
VALUES 
  ('2026-06-05', 11, 19, 0, 0, 5, 'Frost Bank Center', '8:30p');

-- Insertar Jun 8: Knicks (home) vs Spurs (away) — aún sin resultado
INSERT INTO NBA_db.Games 
  (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, SeasonID, Arena, StartTime)
VALUES 
  ('2026-06-08', 19, 11, 0, 0, 5, 'Madison Square Garden (IV)', '8:30p');

-- Insertar Jun 10: Knicks (home) vs Spurs (away) — aún sin resultado
INSERT INTO NBA_db.Games 
  (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, SeasonID, Arena, StartTime)
VALUES 
  ('2026-06-10', 19, 11, 0, 0, 5, 'Madison Square Garden (IV)', '8:30p');

-- Jun 13, 16, 19 se juegan solo si la serie los necesita (best of 7)
-- Insertarlos como pendientes también:
INSERT INTO NBA_db.Games 
  (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, SeasonID, Arena, StartTime)
VALUES 
  ('2026-06-13', 11, 19, 0, 0, 5, 'Frost Bank Center', ''),
  ('2026-06-16', 19, 11, 0, 0, 5, 'Madison Square Garden (IV)', ''),
  ('2026-06-19', 11, 19, 0, 0, 5, 'Frost Bank Center', '');
  
  SELECT GameID, GameDate, HomePoints, AwayPoints 
FROM NBA_db.Games 
WHERE GameDate >= '2026-06-01' 
ORDER BY GameDate;

-- ══════════════════════════════════════════
--  ACTUALIZAR Jun 5 (ya tiene resultado)
-- ══════════════════════════════════════════
UPDATE NBA_db.Games 
SET HomePoints = 104, AwayPoints = 105, Attendance = 19014, GameLength = '2:41'
WHERE GameDate = '2026-06-05' AND HomeTeamID = 11 AND AwayTeamID = 19;

-- ══════════════════════════════════════════
--  ACTUALIZAR PARTIDOS DE MAYO (todos los 52)
-- ══════════════════════════════════════════

-- May 1: Orlando Magic(home=22) vs Detroit Pistons(away=3) → 79-93
UPDATE NBA_db.Games SET HomePoints=79, AwayPoints=93, Attendance=19205, GameLength='2:29'
WHERE GameDate='2026-05-01' AND HomeTeamID=22 AND AwayTeamID=3;

-- May 1: Toronto Raptors(home=9) vs Cleveland Cavaliers(away=27) → 112-110 OT
UPDATE NBA_db.Games SET HomePoints=112, AwayPoints=110, Attendance=19919, GameLength='2:48'
WHERE GameDate='2026-05-01' AND HomeTeamID=9 AND AwayTeamID=27;

-- May 1: Houston Rockets(home=20) vs Los Angeles Lakers(away=16) → 78-98
UPDATE NBA_db.Games SET HomePoints=78, AwayPoints=98, Attendance=18055, GameLength='2:25'
WHERE GameDate='2026-05-01' AND HomeTeamID=20 AND AwayTeamID=16;

-- May 2: Boston Celtics(home=1) vs Philadelphia 76ers(away=15) → 100-109
UPDATE NBA_db.Games SET HomePoints=100, AwayPoints=109, Attendance=19156, GameLength='2:27'
WHERE GameDate='2026-05-02' AND HomeTeamID=1 AND AwayTeamID=15;

-- May 3: Detroit Pistons(home=3) vs Orlando Magic(away=22) → 116-94
UPDATE NBA_db.Games SET HomePoints=116, AwayPoints=94, Attendance=20062, GameLength='2:31'
WHERE GameDate='2026-05-03' AND HomeTeamID=3 AND AwayTeamID=22;

-- May 3: Cleveland Cavaliers(home=27) vs Toronto Raptors(away=9) → 114-102
UPDATE NBA_db.Games SET HomePoints=114, AwayPoints=102, Attendance=19432, GameLength='2:44'
WHERE GameDate='2026-05-03' AND HomeTeamID=27 AND AwayTeamID=9;

-- May 4: New York Knicks(home=19) vs Philadelphia 76ers(away=15) → 137-98
UPDATE NBA_db.Games SET HomePoints=137, AwayPoints=98, Attendance=19812, GameLength='2:34'
WHERE GameDate='2026-05-04' AND HomeTeamID=19 AND AwayTeamID=15;

-- May 4: San Antonio Spurs(home=11) vs Minnesota Timberwolves(away=10) → 102-104
UPDATE NBA_db.Games SET HomePoints=102, AwayPoints=104, Attendance=18827, GameLength='2:30'
WHERE GameDate='2026-05-04' AND HomeTeamID=11 AND AwayTeamID=10;

-- May 5: Detroit Pistons(home=3) vs Cleveland Cavaliers(away=27) → 111-101
UPDATE NBA_db.Games SET HomePoints=111, AwayPoints=101, Attendance=20062, GameLength='2:25'
WHERE GameDate='2026-05-05' AND HomeTeamID=3 AND AwayTeamID=27;

-- May 5: Oklahoma City Thunder(home=29) vs Los Angeles Lakers(away=16) → 108-90
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=90, Attendance=18203, GameLength='2:23'
WHERE GameDate='2026-05-05' AND HomeTeamID=29 AND AwayTeamID=16;

-- May 6: New York Knicks(home=19) vs Philadelphia 76ers(away=15) → 108-102
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=102, Attendance=19812, GameLength='2:38'
WHERE GameDate='2026-05-06' AND HomeTeamID=19 AND AwayTeamID=15;

-- May 6: San Antonio Spurs(home=11) vs Minnesota Timberwolves(away=10) → 133-95
UPDATE NBA_db.Games SET HomePoints=133, AwayPoints=95, Attendance=19185, GameLength='2:33'
WHERE GameDate='2026-05-06' AND HomeTeamID=11 AND AwayTeamID=10;

-- May 7: Detroit Pistons(home=3) vs Cleveland Cavaliers(away=27) → 107-97
UPDATE NBA_db.Games SET HomePoints=107, AwayPoints=97, Attendance=20062, GameLength='2:30'
WHERE GameDate='2026-05-07' AND HomeTeamID=3 AND AwayTeamID=27;

-- May 7: Oklahoma City Thunder(home=29) vs Los Angeles Lakers(away=16) → 125-107
UPDATE NBA_db.Games SET HomePoints=125, AwayPoints=107, Attendance=18203, GameLength='2:33'
WHERE GameDate='2026-05-07' AND HomeTeamID=29 AND AwayTeamID=16;

-- May 8: Philadelphia 76ers(home=15) vs New York Knicks(away=19) → 94-108
UPDATE NBA_db.Games SET HomePoints=94, AwayPoints=108, Attendance=19746, GameLength='2:35'
WHERE GameDate='2026-05-08' AND HomeTeamID=15 AND AwayTeamID=19;

-- May 8: Minnesota Timberwolves(home=10) vs San Antonio Spurs(away=11) → 108-115
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=115, Attendance=18978, GameLength='2:42'
WHERE GameDate='2026-05-08' AND HomeTeamID=10 AND AwayTeamID=11;

-- May 9: Cleveland Cavaliers(home=27) vs Detroit Pistons(away=3) → 116-109
UPDATE NBA_db.Games SET HomePoints=116, AwayPoints=109, Attendance=19432, GameLength='2:40'
WHERE GameDate='2026-05-09' AND HomeTeamID=27 AND AwayTeamID=3;

-- May 9: Los Angeles Lakers(home=16) vs Oklahoma City Thunder(away=29) → 108-131
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=131, Attendance=19057, GameLength='2:16'
WHERE GameDate='2026-05-09' AND HomeTeamID=16 AND AwayTeamID=29;

-- May 10: Philadelphia 76ers(home=15) vs New York Knicks(away=19) → 114-144
UPDATE NBA_db.Games SET HomePoints=114, AwayPoints=144, Attendance=19746, GameLength='2:30'
WHERE GameDate='2026-05-10' AND HomeTeamID=15 AND AwayTeamID=19;

-- May 10: Minnesota Timberwolves(home=10) vs San Antonio Spurs(away=11) → 114-109
UPDATE NBA_db.Games SET HomePoints=114, AwayPoints=109, Attendance=18978, GameLength='2:37'
WHERE GameDate='2026-05-10' AND HomeTeamID=10 AND AwayTeamID=11;

-- May 11: Cleveland Cavaliers(home=27) vs Detroit Pistons(away=3) → 112-103
UPDATE NBA_db.Games SET HomePoints=112, AwayPoints=103, Attendance=19432, GameLength='2:28'
WHERE GameDate='2026-05-11' AND HomeTeamID=27 AND AwayTeamID=3;

-- May 11: Los Angeles Lakers(home=16) vs Oklahoma City Thunder(away=29) → 110-115
UPDATE NBA_db.Games SET HomePoints=110, AwayPoints=115, Attendance=19057, GameLength='2:35'
WHERE GameDate='2026-05-11' AND HomeTeamID=16 AND AwayTeamID=29;

-- May 12: San Antonio Spurs(home=11) vs Minnesota Timberwolves(away=10) → 126-97
UPDATE NBA_db.Games SET HomePoints=126, AwayPoints=97, Attendance=19345, GameLength='2:28'
WHERE GameDate='2026-05-12' AND HomeTeamID=11 AND AwayTeamID=10;

-- May 13: Detroit Pistons(home=3) vs Cleveland Cavaliers(away=27) → 113-117 OT
UPDATE NBA_db.Games SET HomePoints=113, AwayPoints=117, Attendance=20062, GameLength='2:52'
WHERE GameDate='2026-05-13' AND HomeTeamID=3 AND AwayTeamID=27;

-- May 15: Cleveland Cavaliers(home=27) vs Detroit Pistons(away=3) → 94-115
UPDATE NBA_db.Games SET HomePoints=94, AwayPoints=115, Attendance=19432, GameLength='2:32'
WHERE GameDate='2026-05-15' AND HomeTeamID=27 AND AwayTeamID=3;

-- May 15: Minnesota Timberwolves(home=10) vs San Antonio Spurs(away=11) → 109-139
UPDATE NBA_db.Games SET HomePoints=109, AwayPoints=139, Attendance=18978, GameLength='2:27'
WHERE GameDate='2026-05-15' AND HomeTeamID=10 AND AwayTeamID=11;

-- May 17: Detroit Pistons(home=3) vs Cleveland Cavaliers(away=27) → 94-125
UPDATE NBA_db.Games SET HomePoints=94, AwayPoints=125, Attendance=20062, GameLength='2:33'
WHERE GameDate='2026-05-17' AND HomeTeamID=3 AND AwayTeamID=27;

-- May 18: Oklahoma City Thunder(home=29) vs San Antonio Spurs(away=11) → 115-122 2OT
UPDATE NBA_db.Games SET HomePoints=115, AwayPoints=122, Attendance=18203, GameLength='3:05'
WHERE GameDate='2026-05-18' AND HomeTeamID=29 AND AwayTeamID=11;

-- May 19: New York Knicks(home=19) vs Cleveland Cavaliers(away=27) → 115-104 OT
UPDATE NBA_db.Games SET HomePoints=115, AwayPoints=104, Attendance=19812, GameLength='2:46'
WHERE GameDate='2026-05-19' AND HomeTeamID=19 AND AwayTeamID=27;

-- May 20: Oklahoma City Thunder(home=29) vs San Antonio Spurs(away=11) → 122-113
UPDATE NBA_db.Games SET HomePoints=122, AwayPoints=113, Attendance=18203, GameLength='2:28'
WHERE GameDate='2026-05-20' AND HomeTeamID=29 AND AwayTeamID=11;

-- May 21: New York Knicks(home=19) vs Cleveland Cavaliers(away=27) → 109-93
UPDATE NBA_db.Games SET HomePoints=109, AwayPoints=93, Attendance=19812, GameLength='2:27'
WHERE GameDate='2026-05-21' AND HomeTeamID=19 AND AwayTeamID=27;

-- May 22: San Antonio Spurs(home=11) vs Oklahoma City Thunder(away=29) → 108-123
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=123, Attendance=19034, GameLength='2:47'
WHERE GameDate='2026-05-22' AND HomeTeamID=11 AND AwayTeamID=29;

-- May 23: Cleveland Cavaliers(home=27) vs New York Knicks(away=19) → 108-121
UPDATE NBA_db.Games SET HomePoints=108, AwayPoints=121, Attendance=19432, GameLength='2:32'
WHERE GameDate='2026-05-23' AND HomeTeamID=27 AND AwayTeamID=19;

-- May 24: San Antonio Spurs(home=11) vs Oklahoma City Thunder(away=29) → 103-82
UPDATE NBA_db.Games SET HomePoints=103, AwayPoints=82, Attendance=19405, GameLength='2:37'
WHERE GameDate='2026-05-24' AND HomeTeamID=11 AND AwayTeamID=29;

-- May 25: Cleveland Cavaliers(home=27) vs New York Knicks(away=19) → 93-130
UPDATE NBA_db.Games SET HomePoints=93, AwayPoints=130, Attendance=19432, GameLength='2:18'
WHERE GameDate='2026-05-25' AND HomeTeamID=27 AND AwayTeamID=19;

-- May 26: Oklahoma City Thunder(home=29) vs San Antonio Spurs(away=11) → 127-114
UPDATE NBA_db.Games SET HomePoints=127, AwayPoints=114, Attendance=18203, GameLength='2:39'
WHERE GameDate='2026-05-26' AND HomeTeamID=29 AND AwayTeamID=11;

-- May 28: San Antonio Spurs(home=11) vs Oklahoma City Thunder(away=29) → 118-91
UPDATE NBA_db.Games SET HomePoints=118, AwayPoints=91, Attendance=19066, GameLength='2:21'
WHERE GameDate='2026-05-28' AND HomeTeamID=11 AND AwayTeamID=29;

-- May 30: Oklahoma City Thunder(home=29) vs San Antonio Spurs(away=11) → 103-111
UPDATE NBA_db.Games SET HomePoints=103, AwayPoints=111, Attendance=18203, GameLength='2:32'
WHERE GameDate='2026-05-30' AND HomeTeamID=29 AND AwayTeamID=11;

DELETE FROM NBA_db.Games
WHERE GameID IN (
  SELECT GameID FROM (
    SELECT GameID FROM NBA_db.Games
    WHERE HomePoints = 0 AND AwayPoints = 0
      AND GameDate < '2026-06-01'
  ) AS tmp
);

-- Verificar resultado final
SELECT g.GameID, g.GameDate,
       ht.TeamName AS HomeTeam,
       at.TeamName AS AwayTeam,
       g.HomePoints, g.AwayPoints
FROM NBA_db.Games g
JOIN NBA_db.Teams ht ON g.HomeTeamID = ht.TeamID
JOIN NBA_db.Teams at ON g.AwayTeamID = at.TeamID
WHERE g.HomePoints = 0 AND g.AwayPoints = 0
ORDER BY g.GameDate;


-- Corregir fecha y agregar arena al Game 2
UPDATE NBA_db.Games 
SET GameDate = '2026-06-05', 
    Arena = 'Frost Bank Center'
WHERE GameID = 23067;

-- Verificar
SELECT GameID, GameDate, HomePoints, AwayPoints, Arena 
FROM NBA_db.Games 
WHERE GameID IN (23066, 23067);

UPDATE NBA_db.Games 
SET Arena = 'Frost Bank Center'
WHERE GameID = 23066;

SELECT T.TeamName, 
  AVG(CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints
           WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints END) AS AvgFor,
  STDDEV(CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints
              WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints END) AS StdFor
FROM Teams T
JOIN Games g ON (g.HomeTeamID = T.TeamID OR g.AwayTeamID = T.TeamID)
WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
GROUP BY T.TeamID, T.TeamName
LIMIT 5;

SELECT 
  COUNT(*) AS TotalPartidos,
  SUM(CASE WHEN g.HomePoints > g.AwayPoints THEN 1 ELSE 0 END) AS GanaLocalHome,
  ht.TeamName AS HomeTeam,
  at.TeamName AS AwayTeam
FROM Games g
JOIN Teams ht ON g.HomeTeamID = ht.TeamID
JOIN Teams at ON g.AwayTeamID = at.TeamID
WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
  AND (
    (ht.TeamName LIKE '%Knicks%' AND at.TeamName LIKE '%Spurs%')
    OR 
    (ht.TeamName LIKE '%Spurs%' AND at.TeamName LIKE '%Knicks%')
  )
GROUP BY ht.TeamName, at.TeamName;

UPDATE NBA_db.Games
SET HomePoints = 111,
    AwayPoints = 115,
    Attendance = 19812,
    GameLength = '2:46'
WHERE GameID = 23068;

UPDATE NBA_db.Games
SET GameDate = '2026-06-08'
WHERE GameID = 23068;

-- Verificar
SELECT GameID, GameDate, HomePoints, AwayPoints 
FROM NBA_db.Games 
WHERE GameID = 23068;

UPDATE NBA_db.Games
SET HomePoints = 107,
    AwayPoints = 106,
    Attendance = 19812,
    GameLength = '2:51'
WHERE GameID = 23069;

-- Verificar
SELECT GameID, GameDate, HomePoints, AwayPoints
FROM NBA_db.Games
WHERE GameID = 23069;