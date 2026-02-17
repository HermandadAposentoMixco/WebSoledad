
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

    await transporter.sendMail({
  from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
  to: correo,
  subject: "Confirmación de Registro - Hermandad Virgen de la Soledad",
  html: `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #2c3e50;">Registro Completado ✅</h2>
      <p>Estimado/a <strong>${nombres} ${apellidos}</strong>,</p>
      <p>Nos complace informarle que su registro ha sido procesado de manera exitosa. A continuación, encontrará los detalles de su inscripción:</p>
      <ul>
        <li><strong>CUI:</strong> ${cui}</li>
        <li><strong>Teléfono:</strong> ${telefono || '-'}</li>
        <li><strong>Correo:</strong> ${correo}</li>
        <li><strong>Dirección:</strong> ${direccion || '-'}</li>
        <li><strong>Fecha de Nacimiento:</strong> ${fn || '-'}</li>
        <li><strong>Turno / Nota:</strong> ${nota || '-'}</li>
        <li><strong>Sexo:</strong> ${sexo || '-'}</li>
      </ul>
      <p>Le agradecemos su confianza en la <strong>Hermandad Virgen de la Soledad</strong> y nos honra contar con su participación.</p>
      <p style="font-style: italic; color: #555;">"La devoción y el compromiso son la luz que guía nuestros pasos."</p>
      <p>Conserve este correo como comprobante de su registro.</p>
      <p>Atentamente,<br><strong>Hermandad Virgen de la Soledad</strong></p>
    </div>
  `,
  text: `
Registro Completado

Estimado/a ${nombres} ${apellidos},

Nos complace informarle que su registro ha sido procesado de manera exitosa. 
A continuación, encontrará los detalles de su inscripción:

CUI: ${cui}
Teléfono: ${telefono || '-'}
Correo: ${correo}
Dirección: ${direccion || '-'}
Fecha de Nacimiento: ${fn || '-'}
Turno / Nota: ${nota || '-'}
Sexo: ${sexo || '-'}

Le agradecemos su confianza en la Hermandad Virgen de la Soledad y nos honra contar con su participación.

"La devoción y el compromiso son la luz que guía nuestros pasos."

Conserve este correo como comprobante de su registro.

Atentamente,
Hermandad Virgen de la Soledad
  `,
  replyTo: process.env.CORREO_SISTEMA
});



    console.log("Correo enviado correctamente");
  } catch (err) {
    console.log("ERROR ENVIANDO CORREO:", err);
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