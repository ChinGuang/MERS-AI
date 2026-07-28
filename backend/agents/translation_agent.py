"""
Language detection + English translation for caller transcript lines.

Malaysia is multiracial - callers may speak English, Malay, Mandarin/Cantonese
Chinese, Tamil, or occasionally something else. Dispatchers need to read the
transcript in whatever language the caller actually used, with an English
line underneath for anyone who doesn't read it. This runs once per persisted
utterance (see async_context_managers/transcript_process_consumer.py), same
Gemini model/pattern as location_agent_module.py and the incident extractor.
"""

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from environment import GEMINI_API_KEY

MODEL = "gemini-2.5-flash"


class TranslatedUtterance(BaseModel):
    language: str = Field(
        description="ISO 639-1 code for the detected language, e.g. 'en', 'ms', 'zh', 'ta'."
    )
    is_english: bool = Field(description="True if the text is already in English.")
    english_translation: str | None = Field(
        default=None,
        description="Faithful English translation of the text. Null when is_english is true.",
    )


llm = ChatGoogleGenerativeAI(model=MODEL, temperature=0.0, api_key=GEMINI_API_KEY)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You detect the language of one short line spoken during a Malaysian emergency
            call and, if it isn't English, translate it into English.

            Callers may speak English, Malay (Bahasa Malaysia), Mandarin or Cantonese Chinese,
            Tamil, or occasionally another language. Code-switching mid-sentence is common in
            Malaysia (e.g. Manglish) - pick whichever language is dominant in the line.

            This translation is read by an emergency dispatcher, not for style: keep it literal
            and faithful to the original meaning, including names, numbers, and locations exactly
            as spoken. Do not add commentary. Return JSON only.""",
        ),
        ("human", "{text}"),
    ]
)

translation_chain = prompt | llm.with_structured_output(TranslatedUtterance)


def detect_and_translate(text: str) -> TranslatedUtterance | None:
    """
    Best-effort - callers should treat a None return as "couldn't translate
    this line" rather than blocking transcript persistence on it.
    """
    if not text or not text.strip():
        return None
    try:
        return translation_chain.invoke({"text": text})
    except Exception as e:
        print(f"[translation_agent] failed to translate {text!r}: {e}")
        return None
