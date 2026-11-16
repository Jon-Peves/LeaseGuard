import io
import os
import sys
import time

from google import genai
from google.genai import types
from PIL import Image, ImageOps

MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=60_000),
)


def jpeg(path):
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    print(f"  {os.path.basename(path)}: original {img.size}", end="")
    img.thumbnail((1500, 1500))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    print(f" -> sent {img.size}, {len(out.getvalue()) // 1024} KB")
    return types.Part.from_bytes(data=out.getvalue(), mime_type="image/jpeg")


def run(name, contents, config=None):
    print(f"\n{name}")
    start = time.time()
    try:
        r = client.models.generate_content(model=MODEL, contents=contents, config=config)
        print(f"  OK in {time.time() - start:.1f}s: {(r.text or '')[:150]}")
    except Exception as e:
        print(f"  FAILED after {time.time() - start:.1f}s: {str(e)[:200]}")


print(f"Model: {MODEL}")
run("1) Text only", "Reply with just the word ok.")

baseline, current = jpeg(sys.argv[1]), jpeg(sys.argv[2])
prompt = "Image 1 is the baseline, image 2 is the current photo. Is there any damage in image 2 that isn't in image 1? Answer in one sentence."

run("2) Two photos, no schema, default settings", [baseline, current, prompt])

run(
    "3) Two photos, JSON + low thinking",
    [baseline, current, prompt],
    types.GenerateContentConfig(
        response_mime_type="application/json",
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
    ),
)
