const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const path = require('path');

// Config Multer
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// 🔧 Création automatique de la table réclamations
pool.query(`
    CREATE TABLE IF NOT EXISTS reclamations (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        reclamation TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'moyenne',
        file_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).then(() => {
    console.log("✅ Table 'reclamations' prête");
}).catch(err => {
    console.error("❌ Erreur lors de la création de la table :", err);
});

// 📩 Route POST /api/reclamations
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { category, reclamation, priority } = req.body;
        const filePath = req.file ? req.file.filename : null;

        if (!category || !reclamation) {
            return res.status(400).json({ message: "Champs obligatoires manquants." });
        }

        await pool.query(
            `INSERT INTO reclamations (category, reclamation, priority, file_path)
             VALUES ($1, $2, $3, $4)`,
            [category, reclamation, priority || 'moyenne', filePath]
        );

        res.status(200).json({ message: 'Réclamation enregistrée avec succès.' });
    } catch (error) {
        console.error("Erreur réclamation :", error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route GET : récupérer toutes les réclamations
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM reclamations ORDER BY created_at DESC`);
        res.json(result.rows);
    } catch (error) {
        console.error("Erreur récupération :", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});


module.exports = router;
