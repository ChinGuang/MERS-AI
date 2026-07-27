from pydantic import BaseModel

class GeocodeDetailDto(BaseModel):
    coordinates: tuple[float, float]
    address: str