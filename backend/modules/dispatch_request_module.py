from sqlalchemy.orm import Session
from uuid_v7.base import uuid7

from models.dto.dispatch_request import CreateDispatchRequestPayload
from models.schema import DispatchRequest
from modules import db_module

def create_dispatch_request(payload: CreateDispatchRequestPayload, db: Session) -> DispatchRequest:
    dispatch_request_payload = (payload.model_dump() | {"id": uuid7()})
    new_dispatch_request = db_module.init_data(dispatch_request_payload, db, DispatchRequest)
    return new_dispatch_request