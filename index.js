
import express from "express";
import cors from "cors";
import mysql from "mysql2";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();


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
// VERIFICAR VARIABLES DE ENTORNO
// --------------------------------------------------
console.log("Correo sistema:", process.env.CORREO_SISTEMA);
console.log("Pass correo existe?:", !!process.env.PASS_CORREO);

// --------------------------------------------------
// CONFIGURAR CORREO
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.CORREO_SISTEMA,
    pass: process.env.PASS_CORREO
  }
});

transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Error conexión correo:", error);
  } else {
    console.log("✅ Servidor de correo listo para enviar");
  }
});

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
// RUTAS API
// --------------------------------------------------
app.get("/api/devotos/:cui", (req, res) => {
  const { cui } = req.params;
  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la consulta" });
    if (results.length === 0) return res.status(404).json({ message: "No encontrado" });
    res.json(results[0]);
  });
});

app.post("/api/devotos", async (req, res) => {
  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  if (!cui || !nombres || !apellidos || !correo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const enviarCorreo = async () => {
 try {
    console.log("Intentando enviar correo a:", correo);

    if (!correo) throw new Error("Correo electrónico no proporcionado");

   const info = await transporter.sendMail({
  from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
  to: correo,
  subject: "Confirmación de Registro",
  html: `<p>Estimado/a ${nombres} ${apellidos}, su registro fue completado ✅</p>`,
  text: `Estimado/a ${nombres} ${apellidos}, su registro fue completado ✅`,
  replyTo: process.env.CORREO_SISTEMA
});

    console.log("Correo enviado ✅ ID:", info.messageId);
  } catch (err) {
    console.error("ERROR ENVIANDO CORREO:", err);
  }
};


  try {
    const [results] = await db.promise().query("SELECT * FROM devotos WHERE cui = ?", [cui]);

    if (results.length > 0) {
      await db.promise().query(
        `UPDATE devotos SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=? WHERE cui=?`,
        [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui]
      );
    } else {
      await db.promise().query(
        `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo]
      );
    }

    // RESPONDE PRIMERO
    res.json({ message: "Registro guardado correctamente" });

    // ENVÍA DESPUÉS (no bloquea la petición)
    enviarCorreo();

  } catch (error) {
    console.log("ERROR GENERAL:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});