import express from "express";
import cors from "cors";
import mysql from "mysql2";
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
  host: "bj3fh6z8bbrahbsbfbhy-mysql.services.clever-cloud.com",
  user: "uevjslvu5wpmi87t",
  password: "4r6r9xPecTRyfvYXFScJ",
  database: "bj3fh6z8bbrahbsbfbhy",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false
  }
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

app.post("/api/devotos", (req, res) => {
  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  if (!cui || !nombres || !apellidos || !correo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error verificando registro" });

    if (results.length > 0) {
      const sql = `
        UPDATE devotos
        SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=?
        WHERE cui=?
      `;
      const params = [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui];

      db.query(sql, params, err2 => {
        if (err2) return res.status(500).json({ error: "Error al actualizar registro" });
        res.json({ message: "Actualizado correctamente" });
      });
    } else {
      const sql = `
        INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo];

      db.query(sql, params, err3 => {
        if (err3) return res.status(500).json({ error: "Error al guardar registro" });
        res.json({ message: "Registrado correctamente" });
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
