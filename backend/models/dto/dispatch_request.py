from uuid import UUID

from pydantic import BaseModel


class CreateDispatchRequestPayload(BaseModel):
    incident_fkid: UUID
    nearest_service_station_id: UUID
    incident_coordinate: list[float]
    incident_location: str
    distance: str
    eta: str