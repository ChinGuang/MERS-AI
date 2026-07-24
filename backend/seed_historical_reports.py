#!/usr/bin/env python3
"""
Seeder script to populate Supabase 'historical_reports' table over Supabase HTTPS API.
"""

import json
import os
from supabase import create_client

SUPABASE_URL = "https://wxkzqctcvvenrtcbotkm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a3pxY3RjdnZlbnJ0Y2JvdGttIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgwMTk2MCwiZXhwIjoyMDk3Mzc3OTYwfQ.2F7_WNlhJOIdwz-KC6XsCma0KXzZuC-jVNkax1Xx0Ic"

def main():
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
            print(f"  ✓ Upserted: {report['id']} - {report['title']}")
            success_count += 1
        except Exception as e:
            print(f"  ✗ Failed on {report['id']}: {e}")

    print(f"\nCompleted: {success_count}/{len(reports)} historical reports seeded into Supabase.")

if __name__ == "__main__":
    main()
