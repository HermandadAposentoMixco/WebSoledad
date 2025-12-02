import express from "express";
import cors from "cors";
import mysql from "mysql2";

const app = express();
const PORT = process.env.PORT || 4000;

// Servir archivos estáticos (solo si tienes carpeta PUBLIC)
app.use(express.static("public"));

// Conexión MySQL Clever Cloud
const db = mysql.createConnection({
  host: "bj3fh6z8bbrahbsbfbhy-mysql.services.clever-cloud.com",
  user: "uevjslvu5wpmi87t",
  password: "4r6r9xPecTRyfvYXFScJ",
  database: "bj3fh6z8bbrahbsbfbhy",
  port: 3306,
  ssl: { require: true }
});

// Conectar MySQL
db.connect(err => {
  if (err) return console.error("❌ Error al conectar:", err.message);
  console.log("✅ Conectado a MySQL");
});

app.use(cors());
app.use(express.json());

// Endpoint raíz (IMPORTANTE)
app.get("/", (req, res) => {
  res.send("API de Devotos funcionando correctamente 🔥");
});

// Obtener devoto por CUI
app.get("/api/devotos/:cui", (req, res) => {
  const { cui } = req.params;
  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la consulta" });
    if (results.length === 0) return res.status(404).json({ message: "No encontrado" });
    res.json(results[0]);
  });
});

// Registrar o actualizar devoto
app.post("/api/devotos", (req, res) => {
  const { cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo } = req.body;

  if (!cui || !nombres || !apellidos || !correo) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  db.query("SELECT * FROM devotos WHERE cui = ?", [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error verificando registro" });

    if (results.length > 0) {
      const sql = `UPDATE devotos
        SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=?
        WHERE cui=?`;

      const params = [nombres, apellidos, telefono, correo, direccion, fn, nota, sexo, cui];

      db.query(sql, params, err2 => {
        if (err2) return res.status(500).json({ error: "Error al actualizar" });
        res.json({ message: "Actualizado correctamente" });
      });

    } else {
      const sql = `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = [cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo];

      db.query(sql, params, err3 => {
        if (err3) return res.status(500).json({ error: "Error al guardar" });
        res.json({ message: "Registrado correctamente" });
      });
    }
  });
});

// Buscar por nombre o teléfono
app.get("/api/search", (req, res) => {
  const q = `%${req.query.q || ""}%`;
  db.query(
    `SELECT * FROM devotos WHERE nombres LIKE ? OR apellidos LIKE ? OR telefono LIKE ?`,
    [q, q, q],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Error en la búsqueda" });
      res.json(results);
    }
  );
});

// Obtener todos
app.get("/api/all", (req, res) => {
  db.query("SELECT * FROM devotos ORDER BY fecha_registro DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "Error cargando registros" });
    res.json(results);
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend escuchando en http://localhost:${PORT}`);
});
