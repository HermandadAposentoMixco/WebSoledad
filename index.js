import express from "express";
import cors from "cors";
import mysql from "mysql2";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import fs from "fs";
import os from "os";

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

    // =========================
    // CREAR PDF
    // =========================
   const filePath = path.join(os.tmpdir(), `comprobante_${cui}.pdf`);
const doc = new PDFDocument({ margin: 40 });

const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

// Logo
try {
const logoPath = path.join(__dirname, "public", "escudoSoledad.png");
doc.image(logoPath, 200, 30, { width: 180 });

} catch {}

doc.moveDown(6);
doc.fontSize(18).text("HERMANDAD VIRGEN DE LA SOLEDAD MIXCO", { align: "center" });

doc.moveDown();
doc.fontSize(12).text(`Nombre: ${nombres} ${apellidos}`);
doc.text(`CUI: ${cui}`);
doc.text(`Correo: ${correo}`);
doc.text(`Teléfono: ${telefono || "-"}`);
doc.text(`Dirección: ${direccion || "-"}`);
doc.text(`Turno: ${nota || "-"}`);
doc.text(`Sexo: ${sexo || "-"}`);
doc.text(`Fecha nacimiento: ${fn || "-"}`);

doc.moveDown();
doc.text("Su registro fue procesado correctamente.");
doc.text("Presente este documento el día de entrega de cartulina.");

doc.end();

// ✅ Esperar correctamente a que termine
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});

    // =========================
    // ENVIAR CORREO
    // =========================
    await transporter.sendMail({
      from: `"Hermandad Virgen de la Soledad" <${process.env.CORREO_SISTEMA}>`,
      to: correo,
      subject: "Confirmación de Registro - Hermandad Virgen de la Soledad",

      html: `
      <div style="font-family:Arial">

        <img src="cid:logo" style="width:200px"><br><br>

        <h2>Registro completado</h2>

        <p>
        Estimado Devota(o) <b>${nombres} ${apellidos}</b>, con gran gozo espiritual
        comunicamos que la Hermandad de la Virgen de la Soledad ha registrado su pre-inscripción.
        </p>

        <p><b>CUI:</b> ${cui}</p>
        <p><b>Turno:</b> ${nota || '-'}</p>

        <p>Adjunto encontrará su comprobante oficial en PDF.</p>

        <p>¡Que la fe y la devoción sigan guiando nuestro caminar!</p>

      </div>
      `,

      attachments: [
  {
    filename: `Comprobante_${cui}.pdf`,
    path: filePath
  },
  {
    filename: "logo.png",
    path: path.join(__dirname, "public", "escudoSoledad.png"),
    cid: "logo"
  }
],
      replyTo: process.env.CORREO_SISTEMA
    });

    console.log("Correo enviado correctamente");

    // =========================
    // BORRAR PDF (MUY IMPORTANTE)
    // =========================
    try {
  fs.unlinkSync(filePath);
} catch {}


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
