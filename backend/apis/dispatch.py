from fastapi import APIRouter
import os
import googlemaps
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

router = APIRouter(prefix="/dispatch", tags=["dispatch"])

class Transcript(BaseModel):
    transcript: str

@router.post('')
async def get_dispatch(transcript: Transcript):
    # Initialize Google Maps Client
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_KEY)

    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", api_key=GEMINI_API_KEY)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
                You are a helpful emergency dispatcher. Based on the provided caller input transcript, please identify the location name/address & the most suitable type of dispatch station to respond to the emergency situation. Output json format with the following keys: 'location' & 'service'.

                2. Categorize the needed emergency service:
                    - Fire / Explosion / Trapped -> 'bomba'
                    - Medical Emergency / Injuries -> 'ambulance'
                    - Crime / Traffic / Robbery -> 'police'
                    - Maritime / Water Rescue -> 'maritime'
                    - Floods / Natural Disasters -> 'civil_defense'
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
            transcript.transcript
        }
    })

    # print(ai_msg)
    # print(ai_msg["location"])

    def location2Coordinate(location_name: str) -> tuple:
        # This function will take the location name/address and convert it to coordinates (latitude, longitude)
        # You can use a geocoding API like Google Maps Geocoding API for this purpose.
        geocode_result = gmaps.geocode(location_name)
        if geocode_result:
            location = geocode_result[0]['geometry']['location']
            return (location['lat'], location['lng'])
        return None

    loc =location2Coordinate(ai_msg["location"])
    print(loc)

    ######## Google Map API Key #############

    # Input data
    input_data = ai_msg
    input_coords = loc

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
        target_service = data_input.get("service", "").strip().lower()
        
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


    # Run the function
    result = find_nearest_station_by_traffic(input_data, input_coords, gmaps)

    if result:
        print(result)
        # station, details = result
        # print("Fastest Station Found (with real-time traffic):")
        # print(json.dumps(station, indent=2))
        # print(f"\nEstimated Travel Time: {details['duration_text']}")
        # print(f"Driving Distance: {details['distance_text']}")
    return {
        "source": (str(loc[0]), str(loc[1])),
        "destination": (result[0]['latitude'], result[0]['longitude'])
    }