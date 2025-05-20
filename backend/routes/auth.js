const express = require("express");
const router = express.Router();
const {
    getUsersController,
    login,
    register,
    updateUserController,
    deleteUserController,
    logout,
    getUserSessionsController
  } = require("../controllers/authController");

// Route pour récupérer tous les utilisateurs
router.get("/users", getUsersController); 
router.post("/login", login);
router.post("/register", register);

// ✅ Nouvelles routes :
router.put("/users/:id", updateUserController);
router.delete("/users/:id", deleteUserController);
router.post("/logout", logout);
router.get("/sessions", getUserSessionsController);

module.exports = router;


