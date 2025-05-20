from flask import Flask, request, jsonify
from transformers import pipeline

app = Flask(__name__)

# Modèle léger gratuit et local
generator = pipeline("text-generation", model="tiiuae/falcon-rw-1b")

@app.route('/suggest_description', methods=['POST'])
def suggest_description():
    data = request.get_json()
    title = data.get("title", "")
    if not title:
        return jsonify({"error": "Le titre est requis"}), 400

    prompt = f"Donne une description professionnelle et concise pour un workflow intitulé : {title}"
    try:
        result = generator(prompt, max_length=60, num_return_sequences=1)
        description = result[0]["generated_text"].replace(prompt, "").strip()
        return jsonify({"description": description})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=8000)
