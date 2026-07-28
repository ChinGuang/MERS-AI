"""
One-off diagnostic: lists which Gemini models your API key can actually use
for the Live/Realtime API (the "bidiGenerateContent" method worker.py needs).

worker.py's `google.beta.realtime.RealtimeModel(model="gemini-2.0-flash-exp", ...)`
failed with a 1008 policy violation - that model name isn't valid for the
direct Gemini API (Live models have a distinct set of names/aliases from
regular text models, and this shifts over time). Rather than guess a model
name a third time, run this against your own GEMINI_API_KEY to get the real
answer, then update LIVEKIT_LLM_MODEL in your .env to whatever it prints.

Run (from inside backend/, venv active):
    python -m livekit_agent.list_gemini_live_models
"""

from google import genai

from livekit_agent.config import GEMINI_API_KEY, require


def main() -> None:
    api_key = require(GEMINI_API_KEY, "GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    print("Models that support the Live API (bidiGenerateContent):\n")
    found = False
    for model in client.models.list():
        actions = getattr(model, "supported_actions", None) or []
        if "bidiGenerateContent" in actions:
            found = True
            print(f"  {model.name}")

    if not found:
        print("  (none found - double check GEMINI_API_KEY is set and has Live API access)")


if __name__ == "__main__":
    main()
