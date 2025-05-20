import React, { useState } from "react";
import axios from "axios";

function GeminiTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/gemini", { prompt });
      setResponse(res.data.output);
    } catch (err) {
      console.error(err);
      setResponse("Erreur de génération.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Test Gemini</h2>
      <textarea
        rows="4"
        cols="60"
        placeholder="Entre ton prompt ici..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <br />
      <button onClick={handleSubmit} style={{ marginTop: 10 }}>Envoyer</button>

      <h3>Réponse :</h3>
      <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ccc", padding: "10px" }}>
        {response}
      </div>
    </div>
  );
}

export default GeminiTest;
