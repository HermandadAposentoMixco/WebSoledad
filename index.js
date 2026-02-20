import express from "express";
import cors from "cors";
import mysql from "mysql2";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import QRCode from "qrcode";

dotenv.config();

// --------------------------------------------------
const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
app.use(cors());
app.use(express.json());

// --------------------------------------------------
console.log("Correo sistema:", process.env.CORREO_SISTEMA);
console.log("Pass correo existe?:", !!process.env.PASS_CORREO);

// --------------------------------------------------
// PASSWORD + QR
// --------------------------------------------------
function generarPassword(len = 6) {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let o = "";
  for (let i = 0; i < len; i++)
    o += c.charAt(Math.floor(Math.random() * c.length));
  return o;
}

async function generarQR(data) {
  const pass = generarPassword();

  const contenido = [
    `CUI: ${data.cui}`,
    `Nombres: ${data.nombres}`,
    `Apellidos: ${data.apellidos}`,
    `Correo: ${data.correo}`,
    `Teléfono: ${data.telefono || "-"}`,
    `Dirección: ${data.direccion || "-"}`,
    `Sexo: ${data.sexo || "-"}`,
    `Turno: ${data.nota || "-"}`,
    `Contraseña: ${pass}`
  ].join("\n");

  const qrBase64 = await QRCode.toDataURL(contenido, { width: 400 });

  return { qrBase64, pass, contenido };
}

// --------------------------------------------------
// CORREO
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CORREO_SISTEMA,
    pass: process.env.PASS_CORREO
  }
});

transporter.verify()
  .then(() => console.log("✅ Servidor de correo listo"))
  .catch(err => console.log("❌ Error correo:", err.message));

// --------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// MYSQL
// --------------------------------------------------
const db = mysql.createPool({
  host: "bc1f5keqcm2p0h7qnkw6-mysql.services.clever-cloud.com",
  user: "u7hsnsh0t3uzwlc0",
  password: process.env.DB_PASSWORD,
  database: "bc1f5keqcm2p0h7qnkw6",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: false }
});

// mantener viva conexión
setInterval(() => db.query("SELECT 1"), 30000);

// --------------------------------------------------
// GET
// --------------------------------------------------
app.get("/api/devotos/:cui", (req, res) => {
  const { cui } = req.params;
  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la consulta" });
    if (results.length === 0) return res.status(404).json({ message: "No encontrado" });
    res.json(results[0]);
  });
});

// --------------------------------------------------
// POST
// --------------------------------------------------
app.post("/api/devotos", async (req, res) => {

  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  // normalizar sexo para ENUM MySQL
  let sexoDB = null;
  if (sexo) {
    const s = sexo.toLowerCase();
    if (s.startsWith("h")) sexoDB = "Hombre";
    else if (s.startsWith("m") || s.startsWith("f")) sexoDB = "Mujer";
  }

  try {

    const qrData = await generarQR(req.body);

    // verificar existencia
    const [rows] = await db.promise().query(
      "SELECT cui FROM devotos WHERE cui=?",
      [cui]
    );

    if (rows.length > 0) {

      // UPDATE
      await db.promise().query(
        `UPDATE devotos 
         SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=? 
         WHERE cui=?`,
        [nombres, apellidos, telefono, correo, direccion, fn, nota, sexoDB, cui]
      );

    } else {

      // INSERT (ARREGLADO)
      await db.promise().query(
        `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexoDB]
      );
    }

    // enviar correo (no rompe el flujo si falla)
    transporter.sendMail({
      from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
      to: correo,
      subject: "Comprobante de Registro",
      html: `
        <h2>Registro completado</h2>
        <p><b>${nombres} ${apellidos}</b></p>
        <p>CUI: ${cui}</p>
        <p>Contraseña: <b>${qrData.pass}</b></p>
        <p>Presente este código:</p>
        <img src="${qrData.qrBase64}" width="250"/>
      `
    }).catch(e => console.log("⚠️ Correo no enviado:", e.message));

    // RESPUESTA
    res.json({
      message: "Registro guardado correctamente",
      qr: qrData.qrBase64,
      password: qrData.pass,
      contenidoQR: qrData.contenido
    });

  } catch (error) {
    console.log("ERROR REAL:", error);
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});