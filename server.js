require('dotenv').config(); // Cargar las variables de entorno desde el archivo .env

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors'); // Importar CORS

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para todas las solicitudes
app.use(cors());

// Habilitar parseo de JSON para solicitudes POST
app.use(bodyParser.json());

// Configurar base de datos SQLite
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        return console.error(`Error al conectar con la base de datos: ${err.message}`);
    }
    console.log('Conectado a la base de datos SQLite en memoria.');
});

// Crear tabla de usuarios y descargas
db.serialize(() => {
    db.run(`
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            edicion TEXT NOT NULL,
            enlace_unico TEXT NOT NULL,
            descargado INTEGER DEFAULT 0
        )
    `);
    console.log('Tabla "usuarios" creada.');
});

// Ruta para registrar usuarios y generar enlace único
app.post('/registrar', (req, res) => {
    const { email, edicion } = req.body;

    if (!email || !edicion) {
        return res.status(400).json({ error: 'Correo y número de edición son requeridos.' });
    }

    // Generar enlace único
    const enlaceUnico = crypto.randomBytes(16).toString('hex');

    // Insertar usuario en la base de datos
    const query = `INSERT INTO usuarios (email, edicion, enlace_unico) VALUES (?, ?, ?)`;
    db.run(query, [email, edicion, enlaceUnico], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'El correo ya está registrado.' });
            }
            return res.status(500).json({ error: 'Error al registrar usuario.' });
        }

        console.log(`Usuario registrado con éxito: ${email}, edición: ${edicion}, enlace: ${enlaceUnico}`);

        // Responder al cliente con el enlace único
        res.json({ mensaje: 'Registro exitoso.', enlace: `/descargar/${enlaceUnico}` });
    });
});

// Ruta para manejar descarga
app.get('/descargar/:enlaceUnico', (req, res) => {
    const enlaceUnico = req.params.enlaceUnico;

    // Verificar si el enlace es válido y no ha sido usado
    const query = `SELECT * FROM usuarios WHERE enlace_unico = ? AND descargado = 0`;
    db.get(query, [enlaceUnico], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al verificar enlace.' });
        }

        if (!row) {
            return res.status(400).json({ error: 'Enlace inválido o ya utilizado.' });
        }

        // Marcar enlace como utilizado
        const updateQuery = `UPDATE usuarios SET descargado = 1 WHERE enlace_unico = ?`;
        db.run(updateQuery, [enlaceUnico], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error al actualizar estado de descarga.' });
            }

            // Enviar archivo como respuesta
            const filePath = 'ruta/al/archivo/descarga.pdf'; // Cambiar por la ruta real del archivo
            res.download(filePath, 'archivo.pdf', (err) => {
                if (err) {
                    console.error('Error al enviar archivo:', err);
                }
            });
        });
    });
});

// Ruta para obtener los registros de usuarios
app.get('/registros', (req, res) => {
    const query = `SELECT id, email, edicion, enlace_unico, descargado FROM usuarios`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error al consultar los registros:', err);
            return res.status(500).json({ error: 'Error al consultar los registros.' });
        }

        // Devolver los registros en formato JSON
        res.json(rows);
    });
});
const path = require('path');
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
// Ruta para servir el formulario HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'formulario_ingreso.html'));
});

