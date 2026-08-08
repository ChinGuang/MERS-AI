from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from environment import GEMINI_API_KEY, LLM_MODEL_USED


class LiveExtractedIncident(BaseModel):
    title: str
    location: str | None = None
    type: str | None = None


SYSTEM_PROMPT = """You are an AI emergency dispatch analyst. Extract the incident title, location, and type from this partial emergency call transcript.

- title: A concise title for the incident (required)
- location: Where the incident occurred (address, intersection, area) — use null if unclear
- type: The type of incident — one of: medical, fire, crime, accident, flood (use null if unclear)

Only extract information that is explicitly stated or implied. Do not fabricate."""

parser = PydanticOutputParser(pydantic_object=LiveExtractedIncident)

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "Partial transcript:\n\n{transcript}\n\n{format_instructions}"),
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

live_chain = prompt | llm | extract_step | parser
