import sys
import whisper
import json

model = whisper.load_model("base")
result = model.transcribe(sys.argv[1])
print(json.dumps({"text": result["text"]}))