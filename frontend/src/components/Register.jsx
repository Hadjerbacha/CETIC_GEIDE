import { useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";

const Register = () => {
	const [data, setData] = useState({
		name: "",
        prenom: "",
		email: "",
		password: "",
		role: "employe",
	});
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const url = "http://localhost:5000/api/auth/register";
			const { data: res } = await axios.post(url, data);
			setSuccess(res.message);
			setTimeout(() => {
				window.location = "/";
			}, 1500);
		} catch (error) {
			if (
				error.response &&
				error.response.status >= 400 &&
				error.response.status <= 500
			) {
				setError(error.response.data.message);
			}
		}
	};

	return (
		<div className={styles.login_container}>
			<div className={styles.login_form_container}>
				<div className={styles.left}>
					<form className={styles.form_container} onSubmit={handleSubmit}>
						<h2>Créer un compte</h2>
						<input
							type="text"
							placeholder="Nom"
							name="name"
							onChange={handleChange}
							value={data.name}
							required
							className={styles.input}
						/>
                        <input
							type="text"
							placeholder="Prenom"
							name="prenom"
							onChange={handleChange}
							value={data.prenom}
							required
							className={styles.input}
						/>
						<input
							type="email"
							placeholder="Email"
							name="email"
							onChange={handleChange}
							value={data.email}
							required
							className={styles.input}
						/>
						<input
							type="password"
							placeholder="Mot de passe"
							name="password"
							onChange={handleChange}
							value={data.password}
							required
							className={styles.input}
						/>
						<select
							name="role"
							onChange={handleChange}
							value={data.role}
							required
							className={styles.input}
						>
							<option value="">-- Choisir un rôle --</option>
							<option value="admin">Administrateur</option>
							<option value="directeur">Directeur</option>
							<option value="chef">Chef de département</option>
							<option value="employe">Employé</option>
						</select>

						{error && <div className={styles.error_msg}>{error}</div>}
						{success && <div className={styles.success_msg}>{success}</div>}

						<button type="submit" className={styles.green_btn}>
							Enregistrer
						</button>
					</form>
				</div>
			</div>
		</div>
	);
};

export default Register;
