from fastapi import APIRouter
from agents.dispatch_agent import DispatchInputPayload
from database import db_dependency

router = APIRouter(prefix="/dispatch", tags=["dispatch"])

@router.post('')
async def get_dispatch(db: db_dependency, input_payload: DispatchInputPayload):
    return get_dispatch(db, input_payload)