// ============================================
//  server.js — Entry point
// ============================================

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const db      = require('./config/db');

const teamsRoutes      = require('./routes/teams');
const analyticsRoutes  = require('./routes/analytics');
const aiRoutes         = require('./routes/ai');
const predictGameRoutes = require('./routes/predict-game');
const syncRoutes       = require('./routes/sync');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

db.connect((err) => {
  if (err) { console.log('Error de conexión'); return; }
  console.log('MySQL conectado ');
});

app.use('/', teamsRoutes);
app.use('/', analyticsRoutes);
app.use('/', aiRoutes);
app.use('/', predictGameRoutes);
app.use('/', syncRoutes);
const actuarialRoutes = require('./routes/actuarial');
// ... after the other app.use() lines:
app.use('/', actuarialRoutes);

app.get('/', (_req, res) => res.send('NBA API funcionando ✅'));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} `);
});