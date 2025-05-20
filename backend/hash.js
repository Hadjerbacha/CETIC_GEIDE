// hash.js
const bcrypt = require("bcrypt");

const run = async () => {
  const password = "hadjer";
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  console.log("Mot de passe hashé :", hashed);
};

run();
