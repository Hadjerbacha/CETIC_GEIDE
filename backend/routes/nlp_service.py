from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse  # <-- Ajoutez cette importation
from transformers import pipeline
from pydantic import BaseModel
import logging
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NLP Classification Service")

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClassificationRequest(BaseModel):
    text: str
    categories: list[str] | None = None

# Utilisez un modèle plus léger pour de meilleures performances
# Dans nlp_service.py
classifier = pipeline(
    "zero-shot-classification",
    model="typeform/distilbert-base-uncased-mnli",  # modèle plus léger
    device=-1,  # CPU (ou 0 si GPU disponible)
    framework="pt"
)

@app.post("/classify")
async def classify_document(request: ClassificationRequest):
    try:
        if not request.text or len(request.text) < 20:
            return {"category": "autre", "confidence": 0.0}
            
        text = request.text[:1024]  # Limitez encore plus
        categories = request.categories or ["contrat","facture", "demande_conge",  "cv","rapport", "autre"]
        
        # Ajoutez un timeout pour la classification
        result = classifier(
            text,
            candidate_labels=categories,
            multi_label=False
        )
        
        return {
            "category": result["labels"][0],
            "confidence": float(result["scores"][0])
        }
        
    except Exception as e:
        logging.error(f"Erreur de classification: {str(e)}")
        return {"category": "autre", "confidence": 0.0}
    


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.middleware("http")
async def add_cors_header(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0",
        port=5001,
        workers=1,  # Réduire à 1 worker pour éviter les conflits
        timeout_keep_alive=30
    )

