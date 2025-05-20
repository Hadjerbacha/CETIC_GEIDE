// script pour ajouter un user
const bcrypt = require("bcrypt");
const pool = require("./config/db");

(async () => {
  const email = "admin@example.com";
  const password = await bcrypt.hash("123456", 10);
  const role = "admin";
  await pool.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
    [email, password, role]
  );
  console.log("Utilisateur ajouté !");
})();
