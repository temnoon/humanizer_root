#!/usr/bin/env python3
"""
Test transformation API with different scenarios:
1. Single message (short text)
2. Multiple messages (concatenated)
3. Long text (simulate entire conversation)
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_single_message():
    """Test 1: Single short message"""
    print("\n" + "="*60)
    print("TEST 1: Single Message Transformation")
    print("="*60)

    payload = {
        "text": "The quantum mechanical framework provides a comprehensive understanding of subatomic particle behavior.",
        "strength": 1.0,
        "use_examples": True,
        "n_examples": 3
    }

    print(f"Input text length: {len(payload['text'])} chars")
    print(f"Input: {payload['text'][:80]}...")

    start = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/llm",
            json=payload,
            timeout=30
        )
        elapsed = time.time() - start

        print(f"\nStatus: {response.status_code}")
        print(f"Time: {elapsed:.2f}s")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS")
            print(f"Output length: {len(result.get('text', ''))} chars")
            print(f"Output: {result.get('text', '')[:100]}...")
            print(f"Processing time: {result.get('processingTime', 0)}ms")
            return True
        else:
            print(f"❌ FAILED")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_multiple_messages():
    """Test 2: Multiple messages concatenated"""
    print("\n" + "="*60)
    print("TEST 2: Multiple Messages (Concatenated)")
    print("="*60)

    messages = [
        "First, we need to understand quantum superposition.",
        "This principle states that particles can exist in multiple states simultaneously.",
        "The act of measurement causes the wavefunction to collapse."
    ]

    combined_text = "\n\n".join(messages)

    payload = {
        "text": combined_text,
        "strength": 1.0,
        "use_examples": True,
        "n_examples": 3
    }

    print(f"Number of messages: {len(messages)}")
    print(f"Combined text length: {len(combined_text)} chars")
    print(f"Input:\n{combined_text[:150]}...")

    start = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/llm",
            json=payload,
            timeout=30
        )
        elapsed = time.time() - start

        print(f"\nStatus: {response.status_code}")
        print(f"Time: {elapsed:.2f}s")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS")
            print(f"Output length: {len(result.get('text', ''))} chars")
            print(f"Output:\n{result.get('text', '')[:200]}...")
            print(f"Processing time: {result.get('processingTime', 0)}ms")
            return True
        else:
            print(f"❌ FAILED")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_long_conversation():
    """Test 3: Long text (simulating entire conversation)"""
    print("\n" + "="*60)
    print("TEST 3: Long Conversation Text")
    print("="*60)

    # Simulate a longer conversation
    long_text = """
The fundamental principles of quantum mechanics have revolutionized our understanding of the physical universe.
At the subatomic level, particles exhibit behaviors that are fundamentally different from classical physics.

One of the most important concepts is wave-particle duality. This principle demonstrates that matter can exhibit
properties of both waves and particles, depending on the experimental setup used to observe it.

The Heisenberg Uncertainty Principle establishes fundamental limits on the precision with which certain pairs of
physical properties can be simultaneously known. This isn't a limitation of measurement technology, but rather
a fundamental property of quantum systems.

Quantum entanglement represents another counterintuitive phenomenon where particles become correlated in such
a way that the quantum state of each particle cannot be described independently of the others, even when
separated by large distances.
""".strip()

    payload = {
        "text": long_text,
        "strength": 1.0,
        "use_examples": True,
        "n_examples": 3
    }

    print(f"Text length: {len(long_text)} chars")
    print(f"Input:\n{long_text[:200]}...")

    start = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/llm",
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start

        print(f"\nStatus: {response.status_code}")
        print(f"Time: {elapsed:.2f}s")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS")
            print(f"Output length: {len(result.get('text', ''))} chars")
            print(f"Output:\n{result.get('text', '')[:300]}...")
            print(f"Processing time: {result.get('processingTime', 0)}ms")
            return True
        else:
            print(f"❌ FAILED")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_trm_endpoint():
    """Test 4: TRM endpoint with single message"""
    print("\n" + "="*60)
    print("TEST 4: TRM Endpoint (Single Message)")
    print("="*60)

    payload = {
        "text": "The quantum mechanical framework provides a comprehensive understanding of subatomic particle behavior.",
        "povm_pack": "tetralemma",
        "max_iterations": 3
    }

    print(f"Input text length: {len(payload['text'])} chars")

    start = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/trm",
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start

        print(f"\nStatus: {response.status_code}")
        print(f"Time: {elapsed:.2f}s")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS")
            print(f"Iterations: {result.get('iterations', 0)}")
            print(f"Convergence: {result.get('convergenceScore', 0):.3f}")
            print(f"Output: {result.get('text', '')[:100]}...")
            return True
        else:
            print(f"❌ FAILED")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_empty_text():
    """Test 5: Edge case - empty text"""
    print("\n" + "="*60)
    print("TEST 5: Edge Case - Empty Text")
    print("="*60)

    payload = {
        "text": "",
        "strength": 1.0
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/personify/llm",
            json=payload,
            timeout=10
        )

        print(f"Status: {response.status_code}")

        if response.status_code == 422:
            print(f"✅ Correctly rejected empty text")
            return True
        else:
            print(f"⚠️ Unexpected response: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


if __name__ == "__main__":
    print("\n" + "#"*60)
    print("# TRANSFORMATION API TEST SUITE")
    print("#"*60)

    results = {
        "Single Message": test_single_message(),
        "Multiple Messages": test_multiple_messages(),
        "Long Conversation": test_long_conversation(),
        "TRM Endpoint": test_trm_endpoint(),
        "Empty Text": test_empty_text()
    }

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name}: {status}")

    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
