import express from "express";
import cors from "cors";
import mysql from "mysql2";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

// --------------------------------------------------
const app = express();
const PORT = process.env.PORT || 4000;
const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// MIDDLEWARES
// --------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// VERIFICAR VARIABLES
// --------------------------------------------------
console.log("Correo sistema:", process.env.CORREO_SISTEMA);
console.log("Pass correo existe?:", !!process.env.PASS_CORREO);

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
// SERVIR FRONTEND
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
// GET DEVOTO
// --------------------------------------------------
app.get("/api/devotos/:cui", (req, res) => {

  const { cui } = req.params;

  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {

    if (err) {
      console.log("ERROR GET:", err);
      return res.status(500).json({ error: "Error en la consulta" });
    }

    if (results.length === 0)
      return res.status(404).json({ message: "No encontrado" });

    res.json(results[0]);
  });
});

// --------------------------------------------------
// POST DEVOTO (ENVÍA PDF)
// --------------------------------------------------
app.post("/api/devotos", upload.single("pdf"), async (req, res) => {

  try {

    if (!req.file || !req.body.datos)
      return res.status(400).json({ error: "Datos incompletos" });

    const datos = JSON.parse(req.body.datos);
    const pdfBuffer = req.file.buffer;

    // ---- GUARDAR EN BD ----
    await db.promise().query(
      `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       nombres=VALUES(nombres),
       apellidos=VALUES(apellidos),
       telefono=VALUES(telefono),
       correo=VALUES(correo),
       direccion=VALUES(direccion),
       fn=VALUES(fn),
       nota=VALUES(nota),
       sexo=VALUES(sexo)`,
      [
        datos.cui,
        datos.nombres,
        datos.apellidos,
        datos.telefono,
        datos.correo,
        datos.direccion,
        datos.fn,
        datos.nota,
        datos.sexo
      ]
    );

    // RESPONDER RÁPIDO (Render feliz)
    res.json({ ok: true });

    // ---- ENVIAR CORREO EN SEGUNDO PLANO ----
    transporter.sendMail({
      from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
      to: datos.correo,
      subject: "Comprobante de Registro",
      text: `Hola ${datos.nombres} ${datos.apellidos},

Su registro fue realizado correctamente.

Adjunto encontrará su comprobante oficial.
Preséntelo el día de la procesión.

Dios le bendiga.`,
      attachments: [
        {
          filename: `comprobante_${datos.cui}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    })
    .then(() => console.log("📧 Correo enviado a:", datos.correo))
    .catch(e => console.log("⚠️ Error enviando correo:", e.message));

  } catch (err) {
    console.log("ERROR POST:", err);
    res.status(500).json({ error: "No se pudo guardar en la base de datos" });
  }

});

// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});