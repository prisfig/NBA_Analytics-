# 🏀 NBA Analytics AI

Plataforma de análisis deportivo full-stack con datos reales de la NBA, modelos estadísticos y actuariales, predicciones de partidos y un chatbot con inteligencia artificial.

## 🛠️ Tecnologías utilizadas

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML, CSS, JavaScript, Chart.js |
| Backend | Node.js + Express |
| Base de datos | MySQL |
| Inteligencia Artificial | OpenAI GPT-4.1-mini |

## 🚀 Funcionalidades principales

**Dashboard**
Vista general de la liga con estadísticas clave, gráficas interactivas y tabla de partidos recientes. Filtrable por temporada.

**Análisis por equipo**
Historial de victorias por temporada, porcentaje de victorias en casa y desglose por año.

**Pronósticos / Predictions**
Predicción estadística de partidos usando un modelo Elo + historial directo entre equipos (head-to-head). Muestra probabilidades, marcador proyectado y factores clave.

**Actuarial Analytics**
Módulo especializado con cinco análisis estadísticos:
- 🏆 **ASI Rankings** — Índice de Fuerza Actuarial propio
- 🎲 **Simulación Monte Carlo** — hasta 100,000 iteraciones
- 📉 **Riesgo y Volatilidad** — Coeficiente de Variación por equipo
- 🥇 **Probabilidad de Campeonato** — distribución Softmax
- 📐 **Intervalos de Confianza** — IC 95% para predicción de puntos

**Chatbot IA**
Asistente inteligente conectado a la base de datos real. Responde preguntas sobre estadísticas, temporadas, Finals 2025-26 y predicciones sin inventar datos.

## ⚙️ Instalación

```bash
# Backend
cd nba_backend
npm install
# Crear archivo .env con: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, OPENAI_API_KEY
npm run dev

# Frontend
cd nba_frontend
python3 -m http.server 8080
# Abrir http://localhost:8080
```

## 📂 Estructura del proyecto

```
NBA_Analytics-/
├── nba_backend/
│   ├── server.js
│   ├── routes/        # analytics, predictions, actuarial, AI, sync
│   ├── config/
│   └── utils/
└── nba_frontend/
    ├── index.html
    ├── script.js
    └── style.css
```

## 👩‍💻 Autora
Priscilla Figueroa — Proyecto de portafolio universitario.