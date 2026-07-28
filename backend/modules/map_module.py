import requests
from environment import GOOGLE_MAPS_API_KEY
from models.dto.map import GeocodeDetailDto

geocode_map_api_url = "https://geocode.googleapis.com/v4/geocode/address/"

def get_location_details(location_name: str) -> GeocodeDetailDto | None:
    url = f"{geocode_map_api_url}{location_name}"
    params = {"key": GOOGLE_MAPS_API_KEY}
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        result = response.json()
        print(f"Geocode result: {result["results"][0]["formattedAddress"]}")
        if len(result["results"]) > 0:
            return GeocodeDetailDto(coordinates=(result["results"][0]["location"]["latitude"], result["results"][0]["location"]["longitude"]), address=result["results"][0]["formattedAddress"])
        else:
            return None
    else:
        return None
