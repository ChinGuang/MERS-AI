"""
One-off seed script for EmergencyDispatchServiceLocation - currently empty in
every environment, which meant location_agent_module.py's nearest-station
lookup had nothing to search over. Run once (from inside backend/, with your
venv active):

    python seed_dispatch_locations.py

Safe to re-run - it skips seeding if any rows already exist.

Coordinates below are approximate Klang Valley station locations for local
testing/demo purposes, not verified precise addresses - replace with your
real service center list before relying on this for anything but testing.
"""

from database import SessionLocal
from models.schema import EmergencyDispatchServiceLocation
from uuid_v7.base import uuid7

SEED_LOCATIONS = [
    {
        "department": "Fire and Rescue Department",
        "station_name": "Balai Bomba Hang Tuah",
        "address": "Jalan Hang Tuah, Kuala Lumpur",
        "latitude": 3.1390,
        "longitude": 101.7050,
    },
    {
        "department": "Fire and Rescue Department",
        "station_name": "Balai Bomba Cheras",
        "address": "Jalan Cheras, Kuala Lumpur",
        "latitude": 3.1073,
        "longitude": 101.7325,
    },
    {
        "department": "Ambulance / Emergency Medical Services",
        "station_name": "Hospital Kuala Lumpur EMS Station",
        "address": "Jalan Pahang, Kuala Lumpur",
        "latitude": 3.1730,
        "longitude": 101.7030,
    },
    {
        "department": "Fire and Rescue Department",
        "station_name": "Balai Bomba Petaling Jaya",
        "address": "Jalan Yong Shook Lin, Petaling Jaya, Selangor",
        "latitude": 3.1073,
        "longitude": 101.6068,
    },
    {
        "department": "Ambulance / Emergency Medical Services",
        "station_name": "Subang Jaya EMS Station",
        "address": "USJ, Subang Jaya, Selangor",
        "latitude": 3.0435,
        "longitude": 101.5871,
    },
    {
        "department": "Fire and Rescue Department",
        "station_name": "Balai Bomba Ampang",
        "address": "Jalan Ampang, Ampang, Selangor",
        "latitude": 3.1500,
        "longitude": 101.7600,
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing_count = db.query(EmergencyDispatchServiceLocation).count()
        if existing_count > 0:
            print(f"[seed] {existing_count} EmergencyDispatchServiceLocation rows already exist - skipping.")
            return

        for entry in SEED_LOCATIONS:
            db.add(EmergencyDispatchServiceLocation(id=uuid7(), **entry))
        db.commit()
        print(f"[seed] inserted {len(SEED_LOCATIONS)} EmergencyDispatchServiceLocation rows.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
