#!/usr/bin/env python3
"""
Seeder script to populate Supabase 'historical_reports' table over Supabase HTTPS API.
"""

import json
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environment or .env file.")
        return
    json_path = os.path.join(os.path.dirname(__file__), "historical_reports_seed.json")
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        reports = json.load(f)

    print("Connecting to Supabase via HTTPS client...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"Seeding {len(reports)} historical reports...")
    success_count = 0
    for report in reports:
        try:
            client.table("historical_reports").upsert(report).execute()
            print(f"  OK Upserted: {report['id']} - {report['title']}")
            success_count += 1
        except Exception as e:
            print(f"  FAILED on {report['id']}: {e}")

    print(f"\nCompleted: {success_count}/{len(reports)} historical reports seeded into Supabase.")

if __name__ == "__main__":
    main()
