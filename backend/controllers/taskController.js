// controllers/taskController.js
const nodemailer = require('nodemailer');



const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hadjerbachasais@gmail.com',
    pass: 'ieku nqme btfp xopo'
  }
});

const sendEmail = (to, { subject, text }) => {
  return transporter.sendMail({
    from: '"GED App" <tonemail@gmail.com>',
    to,
    subject,
    text
  });
};


const getUserTasks = async (req, res) => {
  try {
    const userId = req.user.id; // ID du user connecté
    const result = await pool.query(
      'SELECT * FROM tasks WHERE created_by = $1',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = { sendEmail, getUserTasks };