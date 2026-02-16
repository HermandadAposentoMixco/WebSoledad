import express from "express";
import cors from "cors";
import mysql from "mysql2";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

// --------------------------------------------------
// CONFIG BÁSICA
// --------------------------------------------------
const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// SERVIR FRONTEND
// --------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// MYSQL (POOL)
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

// --------------------------------------------------
// CONFIG CORREO
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CORREO_SISTEMA,
    pass: process.env.PASS_CORREO
  }
});

async function enviarCorreo(devoto) {
  await transporter.sendMail({
    from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
    to: devoto.correo,
    subject: "Comprobante de Registro - Hermandad Soledad",
    html: `
      <h2>Registro Confirmado</h2>
      <p>Estimado(a) ${devoto.nombres} ${devoto.apellidos}</p>
      <p>Su registro fue procesado correctamente.</p>
      <p><strong>CUI:</strong> ${devoto.cui}</p>
      <p><strong>Turno:</strong> ${devoto.nota || "-"}</p>
      <br>
      <p>Gracias por formar parte de la Hermandad Virgen de la Soledad Mixco.</p>
    `
  });
}

// --------------------------------------------------
// RUTAS API
// --------------------------------------------------
app.get("/api/devotos/:cui", async (req, res) => {
  try {
    const { cui } = req.params;
    const [rows] = await db.promise().query(
      "SELECT * FROM devotos WHERE cui = ?",
      [cui]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error en la consulta" });
  }
});

app.post("/api/devotos", async (req, res) => {
  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  if (!cui || !nombres || !apellidos || !correo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM devotos WHERE cui = ?",
      [cui]
    );

    if (rows.length > 0) {
      await db.promise().query(`
        UPDATE devotos
        SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=?
        WHERE cui=?`,
        [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui]
      );
    } else {
      await db.promise().query(`
        INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo]
      );
    }

    // 🔥 Enviar correo automáticamente
    await enviarCorreo({ cui, nombres, apellidos, correo, nota });

    res.json({ message: "Registro procesado y correo enviado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando registro" });
  }
});

app.get("/api/all", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM devotos ORDER BY fecha_registro DESC"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error cargando registros" });
  }
});

// --------------------------------------------------
// HEALTH CHECK (Render)
// --------------------------------------------------
app.get("/healthz", (req, res) => res.send("OK"));

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
