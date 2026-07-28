from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apis.incidents import router as incident_router
from apis.dispatch import router as dispatch_router
from async_context_managers.lifespan import lifespan
from database import engine
from environment import ALLOW_ORIGINS
import models.schema as models

app = FastAPI(lifespan=lifespan)

def db_setup():
    models.Base.metadata.create_all(engine)

db_setup()

app.include_router(incident_router)
app.include_router(dispatch_router)
import apis.twilio_api
import apis.websocket
import apis.transcripts
import apis.database_event

origins = ALLOW_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)