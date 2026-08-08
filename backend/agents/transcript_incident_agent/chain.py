from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_google_genai import ChatGoogleGenerativeAI

from agents.transcript_incident_agent.models import ExtractedIncident
from environment import GEMINI_API_KEY, LLM_MODEL_USED


def format_utterances(utterances: list) -> str:
    lines = []
    for u in utterances:
        role = u.role or "unknown"
        sec = u.start_duration / 1000 if u.start_duration else 0
        lines.append(f"[{sec:06.1f}] {role}: {u.transcript}")
    return "\n".join(lines)

SYSTEM_PROMPT = """You are an AI emergency dispatch analyst. Your task is to extract structured incident information from a 999 emergency call transcript.

The transcript is a dialogue between a dispatcher/call-taker (agent) and a caller or field units (user).

Extract the following fields from the transcript:
- type: The type of incident (medical, fire, crime, accident, flood)
- coordinates: [latitude, longitude] if location coordinates are mentioned, otherwise null
- title: A concise title for the incident (required)
- location: Where the incident occurred (address, intersection, area)
- ai_confidence: Your confidence score (0.0 to 1.0) in the accuracy of your extraction
- ai_summary: A brief paragraph summarizing the incident
- severity: Severity level (CRITICAL, URGENT, MODERATE, RESOLVED)
- priority: Priority level (1 highest to 5 lowest)
- occur_date_time: When the incident occurred if mentioned
- distress_score: Estimated caller distress level (0.0 to 1.0)
- panic_level: A SHORT category only - exactly one of: Low, Moderate, High, Severe.
  Never a sentence or explanation - put any reasoning/quotes in `contradiction` or
  `ai_summary` instead, never in this field.
- caller_name: The caller's own first name or full name, ONLY if they state it
  themselves during the call (e.g. "This is Ramesh", caller introduces themselves, or
  the operator addresses them by a name the caller confirmed). Null if never stated -
  do not guess or infer a name from context.
- entities: List of entities mentioned (people, vehicles, weapons, locations, etc.)
- reason: The reasoning for the incident type classification
- contradiction: Any contradictory information in the transcript
- sop_citation: Any standard operating procedure citations mentioned
- sop_procedure: Steps or procedures mentioned for handling the incident
- responder: Responder information mentioned
- timeline: Chronological events mentioned in the transcript

Only extract information that is explicitly stated or strongly implied in the transcript. Do not fabricate information."""

parser = PydanticOutputParser(pydantic_object=ExtractedIncident)

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "Here is the emergency call transcript:\n\n{transcript}\n\n{format_instructions}"),
]).partial(format_instructions=parser.get_format_instructions())

llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL_USED,
    api_key=GEMINI_API_KEY,
    temperature=0.1,
)

def _extract_content(msg):
    content = msg.content
    if isinstance(content, list):
        parts = [p["text"] for p in content if isinstance(p, dict) and p.get("type") == "text"]
        return parts[0] if parts else ""
    return content

extract_step = RunnableLambda(_extract_content)

chain = prompt | llm | extract_step | parser
