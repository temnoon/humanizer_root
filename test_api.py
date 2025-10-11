#!/usr/bin/env python3
"""
Quick test script for Humanizer API

Tests the quantum reading endpoints.
"""

import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000"


async def test_api():
    """Test all API endpoints."""

    async with httpx.AsyncClient() as client:
        print("🧪 Testing Humanizer API\n")

        # 1. Health check
        print("1. Health Check...")
        response = await client.get(f"{BASE_URL}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}\n")

        # 2. List POVM packs
        print("2. List POVM Packs...")
        response = await client.get(f"{BASE_URL}/povm/list")
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Available packs: {[p['name'] for p in data['packs']]}\n")

        # 3. Start reading session
        print("3. Start Reading Session...")
        reading_request = {
            "text": "The mind constructs reality through language.",
            "povm_packs": ["tetralemma", "tone"],
            "trm_rank": 64
        }
        response = await client.post(
            f"{BASE_URL}/reading/start",
            json=reading_request
        )
        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            reading_data = response.json()
            reading_id = reading_data["reading_id"]
            print(f"   Reading ID: {reading_id}")
            print(f"   Step: {reading_data['step']}")
            print(f"   Halt probability: {reading_data['halt_p']}")

            # Print tetralemma readings
            if "tetralemma" in reading_data['povm_readings']:
                tetralemma = reading_data['povm_readings']['tetralemma']
                print(f"   Tetralemma:")
                for corner, prob in tetralemma.items():
                    bar = "█" * int(prob * 40)
                    print(f"     {corner:10s}: {prob:.3f} {bar}")
            print()

            # 4. Execute step
            print("4. Execute TRM Step...")
            step_request = {
                "reading_id": reading_id,
                "max_steps": 1
            }
            response = await client.post(
                f"{BASE_URL}/reading/step",
                json=step_request
            )
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                step_data = response.json()
                print(f"   Step: {step_data['step']}")
                print(f"   Summary: {step_data['dy_summary']}")
                print(f"   ρ distance: {step_data['rho_delta']:.4f}")
                print(f"   Halt probability: {step_data['halt_p']}")

                if step_data.get('corner_views'):
                    print(f"   Corner views available: {list(step_data['corner_views'].keys())}")
                print()

            # 5. Measure with additional POVM
            print("5. Measure with Ontology POVM...")
            measure_request = {
                "reading_id": reading_id,
                "povm_pack": "ontology"
            }
            response = await client.post(
                f"{BASE_URL}/reading/measure",
                json=measure_request
            )
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                measure_data = response.json()
                print(f"   Ontology readings:")
                for axis, prob in measure_data['readings'].items():
                    bar = "█" * int(prob * 40)
                    print(f"     {axis:15s}: {prob:.3f} {bar}")
                print()

            # 6. Get trace
            print("6. Get Reading Trace...")
            response = await client.get(
                f"{BASE_URL}/reading/{reading_id}/trace"
            )
            print(f"   Status: {response.status_code}")

            if response.status_code == 200:
                trace_data = response.json()
                print(f"   Total steps: {len(trace_data['steps'])}")
                print(f"   Original text: {trace_data['original_text']}")
                if trace_data['metrics'].get('rho_distances'):
                    print(f"   ρ distances: {trace_data['metrics']['rho_distances']}")
                print()

        print("✅ API testing complete!")


if __name__ == "__main__":
    asyncio.run(test_api())
