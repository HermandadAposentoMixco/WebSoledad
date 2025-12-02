import express from "express";
import cors from "cors";
import mysql from "mysql2";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 4000;

// 🛠️ Configuración de conexión MySQL (Clever Cloud)
const db = mysql.createConnection({
  host: "bj3fh6z8bbrahbsbfbhy-mysql.services.clever-cloud.com",
  user: "uevjslvu5wpmi87t",
  password: "4r6r9xPecTRyfvYXFScJ",
  database: "bj3fh6z8bbrahbsbfbhy",
  port: 3306,
  ssl: { require: true }
});


// 🔗 Conectar a MySQL
db.connect(err => {
  if (err) return console.error("❌ Error al conectar a MySQL:", err.message);
  console.log("✅ Conectado a MySQL (Clever Cloud)");
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.get("/api/status", (req, res) => {
  res.send("Backend funcionando ✅");
});

// 📌 Obtener devoto por CUI
app.get("/api/devotos/:cui", (req, res) => {
  const { cui } = req.params;
  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la consulta" });
    if (results.length === 0) return res.status(404).json({ message: "No encontrado" });
    res.json(results[0]);
  });
});

// 📝 Registrar o actualizar devoto
app.post("/api/devotos", (req, res) => {
  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  if (!cui || !nombres || !apellidos || !correo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Verificar si ya existe
  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error verificando registro" });

    if (results.length > 0) {
      // Actualizar
      const sql = `UPDATE devotos
                   SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=?
                   WHERE cui=?`;
      const params = [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui];

      db.query(sql, params, err2 => {
        if (err2) return res.status(500).json({ error: "Error al actualizar registro" });
        res.json({ message: "Actualizado correctamente", devoto: { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } });
      });
    } else {
      // Insertar nuevo
      const sql = `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo];

      db.query(sql, params, err3 => {
        if (err3) return res.status(500).json({ error: "Error al guardar registro" });
        res.json({ message: "Registrado correctamente", devoto: { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } });
      });
    }
  });
});

// 🔍 Buscar por nombre o teléfono
app.get("/api/search", (req, res) => {
  const q = `%${req.query.q || ""}%`;
  db.query(`SELECT * FROM devotos WHERE nombres LIKE ? OR apellidos LIKE ? OR telefono LIKE ?`, [q, q, q], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la búsqueda" });
    res.json(results);
  });
});

// 📋 Obtener todos los registros
app.get("/api/all", (req, res) => {
  db.query("SELECT * FROM devotos ORDER BY fecha_registro DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "Error cargando registros" });
    res.json(results);
  });
});

// Servir frontend público
app.use(express.static(path.join(__dirname, "public")));

// Esto debe ir DESPUÉS de servir archivos estáticos
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

