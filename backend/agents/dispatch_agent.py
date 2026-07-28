from fastapi import APIRouter
import googlemaps
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from models.dto.voice_agent import DispatchInputPayload
from models.schema import DispatchRequest
from database import db_dependency
from environment import GEMINI_API_KEY, GOOGLE_MAPS_API_KEY

def get_dispatch(db: db_dependency, input_payload: DispatchInputPayload):
    # Initialize Google Maps Client
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", api_key=GEMINI_API_KEY)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
                You are an expert emergency dispatch analyst. Your task is to determine the primary emergency service needed based on the provided incident type ['medical', 'fire', 'crime', 'accident', 'flood'].

                    CLASSIFICATION RULES FOR 'service':
                    - 'bomba': Fires, explosions, chemical leaks, or structural entrapment/rescue.
                    - 'ambulance': Medical emergencies, heart attacks, severe illness, or direct physical injuries requiring medical care.
                    - 'police': Crimes, robberies, violence, traffic accidents/disturbances, or active safety threats.
                    - 'maritime': Water rescue, drowning, ocean/river vessel accidents, or off-shore emergencies.
                    - 'civil_defense': Floods, landslides, severe storms, natural disasters, or large-scale community relief/evacuation.

                    NOTE ON INCIDENT TYPES:
                    - Primary mapping guide:
                    * fire -> 'bomba'
                    * medical -> 'ambulance'
                    * crime -> 'police'
                    * accident -> 'police'
                    * flood -> 'civil_defense'

                    OUTPUT REQUIREMENTS:
                    Return strictly a single JSON object with no markdown formatting around it:
                    {{
                    "service_type": "<bomba | ambulance | police | maritime | civil_defense>"
                    }}
                """
            ),
            (
                "human",
                "{input}"
            ),
        ]
    )

    chain = prompt | llm | JsonOutputParser()

    ai_msg = chain.invoke({
        "input":
            {
                "incident_location": input_payload.incident_location,
                "incident_type": input_payload.incident_type
            }
    })

    print(ai_msg)

    # print(ai_msg["service_type"])

    def location2Coordinate(location_name: str) -> tuple:
        # This function will take the location name/address and convert it to coordinates (latitude, longitude)
        # You can use a geocoding API like Google Maps Geocoding API for this purpose.
        geocode_result = gmaps.geocode(location_name)
        if geocode_result:
            location = geocode_result[0]['geometry']['location']
            return (location['lat'], location['lng'])
        return None

    loc = location2Coordinate(input_payload.incident_location)
    print(loc)

    def find_nearest_station_by_traffic(data_input, user_coords, gmap_client, file_path="data/station.json"):
        # 1. Read / Load the station.json file
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                stations = json.load(file)
        except FileNotFoundError:
            print(f"Error: File '{file_path}' not found.")
            return None
        except json.JSONDecodeError:
            print(f"Error: Failed to parse '{file_path}'. Check JSON formatting.")
            return None

        # 2. Filter by service_type (case-insensitive)
        target_service = data_input.get("service_type", "").strip().lower()

        filtered_stations = [
            station
            for station in stations
            if station.get("service_type", "").strip().lower() == target_service
        ]

        if not filtered_stations:
            print(f"No stations found for service type: '{target_service}'")
            return None

        # Convert string lat/lng from JSON into float tuples for Google Maps API
        destinations = [
            (float(s["latitude"]), float(s["longitude"]))
            for s in filtered_stations
        ]

        # 3. Use gmap (Google Maps Distance Matrix API) to find the fastest route in real-time traffic
        try:
            matrix = gmap_client.distance_matrix(
                origins=[user_coords],
                destinations=destinations,
                mode="driving",
                departure_time="now"  # Enables real-time traffic duration
            )
        except Exception as e:
            print(f"Google Maps API Error: {e}")
            return None

        nearest_station = None
        fastest_time_seconds = float("inf")
        result_details = {}

        # Extract elements from API response
        elements = matrix["rows"][0]["elements"]

        for station, element in zip(filtered_stations, elements):
            if element.get("status") == "OK":
                # Real-time traffic duration (duration_in_traffic) takes priority over standard duration
                duration_data = element.get("duration_in_traffic") or element.get("duration")
                travel_time_seconds = duration_data["value"]

                if travel_time_seconds < fastest_time_seconds:
                    fastest_time_seconds = travel_time_seconds
                    nearest_station = station
                    result_details = {
                        "duration_text": duration_data["text"],
                        "distance_text": element["distance"]["text"],
                        "duration_seconds": travel_time_seconds
                    }

        if nearest_station:
            return nearest_station, result_details
        else:
            print("Could not compute routes to any of the matching stations.")
            return None

    # Input data
    input_data = ai_msg
    input_coords = loc

    # Run the function
    result = find_nearest_station_by_traffic(input_data, input_coords, gmaps)

    if result:
        print(result)
        station, details = result
        print("Fastest Station Found (with real-time traffic):")
        print(json.dumps(station, indent=2))
        print(station["id"])
        # print(f"\nEstimated Travel Time: {details['duration_text']}")
        # print(f"Driving Distance: {details['distance_text']}")
    return {
        "incident": (loc[0], loc[1]),
        "service_station": (float(result[0]['latitude']), float(result[0]['longitude'])),
        "distance": (result[1]['distance_text']),
        "ETA": (result[1]['duration_text']),
        "nearest_service_station_id": result[0]['id']
    }