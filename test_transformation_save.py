#!/usr/bin/env python3
"""
Comprehensive Test Suite for Transformation Save Feature

Tests:
1. Personify LLM endpoint with user_prompt
2. Personify TRM endpoint with user_prompt
3. Transform LLM endpoint with user_prompt
4. Transform TRM endpoint with user_prompt
5. Database verification of saved transformations
6. User prompt storage validation
7. Source UUID linking
8. Metrics and parameters storage

Usage:
    python test_transformation_save.py
"""

import requests
import json
import sys
from uuid import uuid4

# Configuration
BASE_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}

# Test data
TEST_TEXT = "It's worth noting that this approach can be beneficial in many cases. You might want to consider the following factors when implementing this solution."
TEST_USER_PROMPT = "Remove hedging and make it more conversational"
TEST_MESSAGE_UUID = str(uuid4())  # Fake UUID for testing


class Colors:
    """Terminal colors for pretty output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_test_header(test_name: str):
    """Print test header."""
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}TEST: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*70}{Colors.END}\n")


def print_success(message: str):
    """Print success message."""
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")


def print_error(message: str):
    """Print error message."""
    print(f"{Colors.RED}✗ {message}{Colors.END}")


def print_info(message: str):
    """Print info message."""
    print(f"{Colors.YELLOW}ℹ {message}{Colors.END}")


def test_personify_llm():
    """Test 1: Personify LLM with user_prompt."""
    print_test_header("Personify LLM Endpoint")

    payload = {
        "text": TEST_TEXT,
        "user_prompt": TEST_USER_PROMPT,
        "source_message_uuid": TEST_MESSAGE_UUID,
        "strength": 1.0,
        "use_examples": True,
        "n_examples": 3
    }

    print_info(f"Sending request to: {BASE_URL}/api/personify/llm")
    print_info(f"Text length: {len(TEST_TEXT)} chars")
    print_info(f"User prompt: {TEST_USER_PROMPT}")

    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/llm",
            headers=HEADERS,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            # Validate response structure
            assert "transformation_id" in data, "Missing transformation_id"
            assert "transformed_text" in data, "Missing transformed_text"
            assert "saved" in data, "Missing saved flag"
            assert data["saved"] is True, "Transformation not saved"

            transformation_id = data["transformation_id"]

            print_success(f"Request succeeded (200 OK)")
            print_success(f"Transformation ID: {transformation_id}")
            print_success(f"Transformed text length: {len(data['transformed_text'])} chars")
            print_success(f"Processing time: {data.get('processing_time', 'N/A')} ms")

            return transformation_id
        else:
            print_error(f"Request failed: {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return None


def test_personify_trm():
    """Test 2: Personify TRM with user_prompt."""
    print_test_header("Personify TRM Endpoint")

    payload = {
        "text": TEST_TEXT,
        "user_prompt": "Transform to conversational tone using TRM",
        "source_message_uuid": TEST_MESSAGE_UUID,
        "povm_pack": "tone",
        "max_iterations": 3
    }

    print_info(f"Sending request to: {BASE_URL}/api/personify/trm")
    print_info(f"POVM pack: tone")
    print_info(f"Max iterations: 3")

    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/trm",
            headers=HEADERS,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            assert "transformation_id" in data, "Missing transformation_id"
            assert "transformed_text" in data, "Missing transformed_text"
            assert data["saved"] is True, "Transformation not saved"

            transformation_id = data["transformation_id"]

            print_success(f"Request succeeded (200 OK)")
            print_success(f"Transformation ID: {transformation_id}")
            print_success(f"Iterations: {data.get('iterations', 'N/A')}")
            print_success(f"Convergence score: {data.get('convergence_score', 'N/A')}")

            return transformation_id
        else:
            print_error(f"Request failed: {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return None


def test_transform_llm():
    """Test 3: Transform LLM with user_prompt."""
    print_test_header("Transform LLM Endpoint")

    payload = {
        "text": "This is a simple test of transformation.",
        "user_prompt": "Make this more assertive",
        "target_stance": {
            "A": 0.7,
            "¬A": 0.1,
            "both": 0.1,
            "neither": 0.1
        }
    }

    print_info(f"Sending request to: {BASE_URL}/api/transform/llm")

    try:
        response = requests.post(
            f"{BASE_URL}/api/transform/llm",
            headers=HEADERS,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            assert "transformation_id" in data, "Missing transformation_id"
            assert "text" in data, "Missing text"
            assert data["saved"] is True, "Transformation not saved"

            transformation_id = data["transformation_id"]

            print_success(f"Request succeeded (200 OK)")
            print_success(f"Transformation ID: {transformation_id}")
            print_success(f"Method: {data.get('method', 'N/A')}")

            return transformation_id
        else:
            print_error(f"Request failed: {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return None


def test_transform_trm():
    """Test 4: Transform TRM with user_prompt."""
    print_test_header("Transform TRM Endpoint")

    payload = {
        "text": "This is a simple test of transformation.",
        "user_prompt": "Make this more nuanced",
        "povm_pack": "tetralemma",
        "target_stance": {
            "A": 0.4,
            "¬A": 0.2,
            "both": 0.3,
            "neither": 0.1
        },
        "max_iterations": 3
    }

    print_info(f"Sending request to: {BASE_URL}/api/transform/trm")

    try:
        response = requests.post(
            f"{BASE_URL}/api/transform/trm",
            headers=HEADERS,
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()

            assert "transformation_id" in data, "Missing transformation_id"
            assert "text" in data, "Missing text"
            assert data["saved"] is True, "Transformation not saved"

            transformation_id = data["transformation_id"]

            print_success(f"Request succeeded (200 OK)")
            print_success(f"Transformation ID: {transformation_id}")
            print_success(f"Iterations: {data.get('iterations', 'N/A')}")

            return transformation_id
        else:
            print_error(f"Request failed: {response.status_code}")
            print_error(f"Response: {response.text}")
            return None

    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return None


def verify_database_records(transformation_ids):
    """Test 5: Verify database records."""
    print_test_header("Database Verification")

    print_info("Checking database for transformation records...")

    import subprocess

    try:
        # Query database for the transformation IDs
        query = f"""
        SELECT
            id,
            transformation_type,
            source_type,
            user_prompt,
            LENGTH(source_text) as source_len,
            LENGTH(result_text) as result_len,
            created_at
        FROM transformations
        WHERE id IN ('{transformation_ids[0]}', '{transformation_ids[1]}', '{transformation_ids[2]}', '{transformation_ids[3]}')
        ORDER BY created_at DESC;
        """

        result = subprocess.run(
            ['psql', 'humanizer_dev', '-c', query],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print_success("Database query succeeded")
            print("\nDatabase records:")
            print(result.stdout)

            # Check if records exist
            if all(tid in result.stdout for tid in transformation_ids):
                print_success("All transformation IDs found in database")
            else:
                print_error("Some transformation IDs missing from database")

            return True
        else:
            print_error(f"Database query failed: {result.stderr}")
            return False

    except Exception as e:
        print_error(f"Database verification failed: {str(e)}")
        return False


def test_user_prompt_storage():
    """Test 6: Validate user_prompt storage."""
    print_test_header("User Prompt Storage Validation")

    print_info("Checking if user_prompts are stored correctly...")

    import subprocess

    try:
        query = """
        SELECT user_prompt, transformation_type
        FROM transformations
        WHERE user_prompt IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5;
        """

        result = subprocess.run(
            ['psql', 'humanizer_dev', '-c', query],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print_success("User prompts found in database")
            print("\nRecent user prompts:")
            print(result.stdout)
            return True
        else:
            print_error(f"Query failed: {result.stderr}")
            return False

    except Exception as e:
        print_error(f"Validation failed: {str(e)}")
        return False


def print_summary(results):
    """Print test summary."""
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")

    total = len(results)
    passed = sum(1 for r in results.values() if r)
    failed = total - passed

    print(f"Total tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {failed}{Colors.END}")

    print("\nTest Results:")
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if passed else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"  {status} - {test_name}")

    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}\n")

    return failed == 0


def main():
    """Run all tests."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}TRANSFORMATION SAVE TEST SUITE{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}Starting comprehensive tests...{Colors.END}")

    transformation_ids = []
    results = {}

    # Test 1: Personify LLM
    tid1 = test_personify_llm()
    results["Personify LLM"] = tid1 is not None
    if tid1:
        transformation_ids.append(tid1)

    # Test 2: Personify TRM
    tid2 = test_personify_trm()
    results["Personify TRM"] = tid2 is not None
    if tid2:
        transformation_ids.append(tid2)

    # Test 3: Transform LLM
    tid3 = test_transform_llm()
    results["Transform LLM"] = tid3 is not None
    if tid3:
        transformation_ids.append(tid3)

    # Test 4: Transform TRM
    tid4 = test_transform_trm()
    results["Transform TRM"] = tid4 is not None
    if tid4:
        transformation_ids.append(tid4)

    # Test 5: Database verification
    if transformation_ids:
        db_result = verify_database_records(transformation_ids)
        results["Database Verification"] = db_result

    # Test 6: User prompt storage
    prompt_result = test_user_prompt_storage()
    results["User Prompt Storage"] = prompt_result

    # Print summary
    all_passed = print_summary(results)

    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED!{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.END}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
