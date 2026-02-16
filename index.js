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
        subject: "Comprobante de Registro",
        html: `<h2>Registro completado</h2>
               <p>Estimado/a ${nombres} ${apellidos},</p>
               <p>Su registro fue procesado correctamente.</p>
               <p><strong>CUI:</strong> ${cui}</p>
               <p><strong>Turno:</strong> ${nota || '-'} </p>
               <p>Conserve este correo como comprobante.</p>`
      });

      console.log("Correo enviado correctamente");
      return true;
    } catch (err) {
      console.log("ERROR ENVIANDO CORREO:", err);
      return false;
    }
  };

  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], async (err, results) => {
    if (err) return res.status(500).json({ error: "Error verificando registro" });

    if (results.length > 0) {
      const sql = `UPDATE devotos SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=? WHERE cui=?`;
      const params = [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui];

      db.query(sql, params, async err2 => {
        if (err2) return res.status(500).json({ error: "Error al actualizar registro" });

        await enviarCorreo();
        res.json({ message: "Actualizado correctamente y correo enviado" });
      });
    } else {
      const sql = `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo];

      db.query(sql, params, async err3 => {
        if (err3) return res.status(500).json({ error: "Error al guardar registro" });

        await enviarCorreo();
        res.json({ message: "Registrado correctamente y correo enviado" });
      });
    }
  });
});

app.get("/api/all", (req, res) => {
  db.query("SELECT * FROM devotos ORDER BY fecha_registro DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "Error cargando registros" });
    res.json(results);
  });
});

app.get("/healthz", (req, res) => res.send("OK"));

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
