import express from "express";
import cors from "cors";
import mysql from "mysql2";

const app = express();
const PORT = process.env.PORT || 3000;

// 🛠️ Configuración de conexión MySQL (Clever Cloud)
const db = mysql.createConnection({
  host: "bj3fh6z8bbrahbsbfbhy-mysql.services.clever-cloud.com",
  user: "uevjslvu5wpmi87t",
  password: "4r6r9xPecTRyfvYXFScJ",
  database: "bj3fh6z8bbrahbsbfbhy",
  port: 3306
});

// 🔗 Conectar a MySQL
db.connect(err => {
  if (err) {
    console.error("❌ Error al conectar a MySQL:", err.message);
  } else {
    console.log("✅ Conectado a MySQL (Clever Cloud)");
  }
});

app.use(cors());
app.use(express.json());

// 📌 Obtener devoto por CUI
app.get("/api/devotos/:cui", (req, res) => {
  const { cui } = req.params;
  const sql = "SELECT * FROM devotos WHERE cui = ?";
  db.query(sql, [cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la consulta" });
    if (results.length === 0)
      return res.status(404).json({ message: "No encontrado" });
    res.json(results[0]);
  });
});

// 📝 Registrar o actualizar devoto
app.post("/api/devotos", (req, res) => {
  const d = req.body;

  // Verificar si ya existe
  db.query("SELECT * FROM devotos WHERE cui = ?", [d.cui], (err, results) => {
    if (err) return res.status(500).json({ error: "Error verificando registro" });

    if (results.length > 0) {
      // Actualizar
      const sql = `UPDATE devotos
                   SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=?, fn=?, nota=?, sexo=?
                   WHERE cui=?`;
      const params = [
        d.nombres,
        d.apellidos,
        d.telefono,
        d.correo,
        d.direccion,
        d.fn,
        d.nota,
        d.sexo,
        d.cui
      ];
      db.query(sql, params, err2 => {
        if (err2) return res.status(500).json({ error: "Error al actualizar registro" });
        res.json({ message: "Actualizado correctamente", devoto: d });
      });
    } else {
      // Insertar nuevo
      const sql = `INSERT INTO devotos (cui, nombres, apellidos, telefono, correo, direccion, fn, nota, sexo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        d.cui,
        d.nombres,
        d.apellidos,
        d.telefono,
        d.correo,
        d.direccion,
        d.fn,
        d.nota,
        d.sexo
      ];
      db.query(sql, params, err3 => {
        if (err3) return res.status(500).json({ error: "Error al guardar registro" });
        res.json({ message: "Registrado correctamente", devoto: d });
      });
    }
  });
});

// 🔍 Buscar por nombre o teléfono
app.get("/api/search", (req, res) => {
  const q = `%${req.query.q || ""}%`;
  const sql = `SELECT * FROM devotos
               WHERE nombres LIKE ? OR apellidos LIKE ? OR telefono LIKE ?`;
  db.query(sql, [q, q, q], (err, results) => {
    if (err) return res.status(500).json({ error: "Error en la búsqueda" });
    res.json(results);
  });
});

// 📋 Obtener todos los registros
app.get("/api/all", (req, res) => {
  const sql = "SELECT * FROM devotos ORDER BY fecha_registro DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Error cargando registros" });
    res.json(results);
  });
});
app.get("/", (req, res) => res.send("Backend funcionando ✅"));


// 🚀 Iniciar servidor
app.listen(PORT, () =>
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`)
);
