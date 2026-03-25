require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Almacén en memoria de ubicaciones recibidas ──
const ubicaciones = [];

// ── Token de sesión activo (se genera al hacer login) ──
let sessionToken = null;

// ── Nodemailer ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Middleware: verificar token de admin ──
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (sessionToken && token === sessionToken) return next();
  res.status(401).json({ error: 'No autorizado' });
}

// ── POST /ubicacion — recibe coordenadas del cliente ──
app.post('/ubicacion', async (req, res) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Faltan coordenadas' });
  }

  const registro = {
    lat,
    lng,
    fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    mapa: `https://www.google.com/maps?q=${lat},${lng}`,
  };
  ubicaciones.push(registro);

  // Enviar correo (no bloquea la respuesta)
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'Nueva ubicación recibida',
    html: `
      <h2>Nueva ubicación</h2>
      <p><b>Lat:</b> ${lat} &nbsp; <b>Lng:</b> ${lng}</p>
      <p><b>Fecha:</b> ${registro.fecha}</p>
      <p><a href="${registro.mapa}">Ver en Google Maps</a></p>
    `,
  };
  transporter.sendMail(mailOptions).catch(err =>
    console.error('Error al enviar correo:', err.message)
  );

  res.json({ ok: true });
});

// ── POST /api/login — validar contraseña de admin ──
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  sessionToken = crypto.randomBytes(32).toString('hex');
  res.json({ ok: true, token: sessionToken });
});

// ── GET /api/ubicaciones — devuelve todas las ubicaciones (requiere auth) ──
app.get('/api/ubicaciones', requireAuth, (req, res) => {
  res.json(ubicaciones);
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`Admin en   http://localhost:${PORT}/admin.html`);
});
