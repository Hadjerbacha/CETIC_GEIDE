# generate_workflow.py
import sys
import json

description = sys.argv[1]

# Traitement simple pour l'exemple
workflow = {
    "workflow_name": "Généré depuis description",
    "steps": [
        {"title": "Analyser la demande", "assigned_to": "Chef de projet", "order": 1},
        {"title": "Préparer les documents", "assigned_to": "Employé", "order": 2},
        {"title": "Valider avec le directeur", "assigned_to": "Directeur", "order": 3},
        {"title": "Archiver le workflow", "assigned_to": "Administrateur", "order": 4}
    ]
}

print(json.dumps(workflow))
