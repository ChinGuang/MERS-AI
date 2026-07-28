from fastapi import FastAPI
from async_context_managers.lifespan2 import lifespan
from database import engine
import models.schema as models

app2 = FastAPI(lifespan=lifespan)

def db_setup():
    models.Base.metadata.create_all(engine)

db_setup()

