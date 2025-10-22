"""
Tests for TRM Core - Ensure quantum formalism is correct
"""

import numpy as np
import pytest
from humanizer.core.trm.density import construct_density_matrix, rho_distance, DensityMatrix
from humanizer.core.trm.povm import (
    create_random_povm_pack,
    get_all_packs,
    apply_born_rule,
)
from humanizer.core.trm.verification import verify_transformation


class TestDensityMatrix:
    """Test density matrix construction and properties."""

    def test_construct_density_matrix(self):
        """Test basic ρ construction."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        rho = construct_density_matrix(embedding, rank=64)

        # Check shape
        assert rho.rho.shape == (64, 64)
        assert len(rho.eigenvalues) == 64

        # Check PSD (all eigenvalues non-negative)
        assert np.all(rho.eigenvalues >= -1e-10)

        # Check normalization
        trace = np.trace(rho.rho)
        assert abs(trace - 1.0) < 1e-6, f"Tr(ρ) = {trace}, expected 1.0"

        # Check symmetry
        assert np.allclose(rho.rho, rho.rho.T), "ρ must be symmetric"

    def test_purity_bounds(self):
        """Test that purity is in valid range [0, 1]."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        rho = construct_density_matrix(embedding, rank=64)

        # Purity must be in [1/d, 1]
        assert 0 < rho.purity <= 1.0
        assert rho.purity >= 1 / 64  # Lower bound for mixed state

    def test_entropy_non_negative(self):
        """Test that entropy is non-negative."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        rho = construct_density_matrix(embedding, rank=64)

        assert rho.entropy >= 0, "Entropy must be non-negative"

    def test_rho_distance(self):
        """Test distance between density matrices."""
        np.random.seed(42)
        embedding1 = np.random.randn(384)
        embedding1 /= np.linalg.norm(embedding1)

        embedding2 = embedding1 + 0.1 * np.random.randn(384)
        embedding2 /= np.linalg.norm(embedding2)

        rho1 = construct_density_matrix(embedding1, rank=64)
        rho2 = construct_density_matrix(embedding2, rank=64)

        distance = rho_distance(rho1, rho2)

        # Distance should be in [0, 1]
        assert 0 <= distance <= 1, f"Distance = {distance}, expected [0, 1]"

        # Distance to self should be 0
        distance_self = rho_distance(rho1, rho1)
        assert distance_self < 1e-6, "Distance to self should be 0"

    def test_serialization(self):
        """Test that density matrix can be serialized."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        rho = construct_density_matrix(embedding, rank=64)

        # Serialize
        data = rho.to_dict()

        # Check keys
        assert "eigenvalues" in data
        assert "top_eigenvectors" in data
        assert "rank" in data
        assert "purity" in data
        assert "entropy" in data

        # Check values
        assert len(data["eigenvalues"]) == 64
        assert data["rank"] == 64


class TestPOVM:
    """Test POVM operators and measurements."""

    def test_povm_pack_creation(self):
        """Test creating a POVM pack."""
        pack = create_random_povm_pack("test", ["A", "B", "C"], rank=64, seed=42)

        assert pack.name == "test"
        assert len(pack.operators) == 3
        assert pack.rank == 64

    def test_povm_sum_to_identity(self):
        """Test that POVM operators sum to identity."""
        pack = create_random_povm_pack("test", ["A", "B"], rank=64, seed=42)

        # Sum operators
        total = np.zeros((64, 64))
        for op in pack.operators:
            total += op.E

        # Check sum ≈ I
        identity = np.eye(64)
        diff = np.linalg.norm(total - identity)
        assert diff < 0.1, f"Σ E_i deviation from I: {diff}"

    def test_born_rule_probabilities(self):
        """Test that Born rule gives valid probabilities."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        rho = construct_density_matrix(embedding, rank=64)
        pack = create_random_povm_pack("test", ["A", "B", "C"], rank=64, seed=42)

        readings = pack.measure(rho)

        # Check all probabilities in [0, 1]
        for axis, prob in readings.items():
            assert 0 <= prob <= 1, f"{axis}: p={prob}, expected [0, 1]"

        # Check sum ≈ 1
        total = sum(readings.values())
        assert abs(total - 1.0) < 1e-6, f"Σp = {total}, expected 1.0"

    def test_predefined_packs(self):
        """Test that all predefined POVM packs work."""
        packs = get_all_packs(rank=64)

        expected_packs = ["tetralemma", "tone", "ontology", "pragmatics", "audience"]
        for pack_name in expected_packs:
            assert pack_name in packs, f"Missing pack: {pack_name}"

        # Test measuring with each pack
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)
        rho = construct_density_matrix(embedding, rank=64)

        for pack_name, pack in packs.items():
            readings = pack.measure(rho)

            # Check valid probabilities
            total = sum(readings.values())
            assert abs(total - 1.0) < 1e-6, f"{pack_name}: Σp = {total}"

    def test_tetralemma_pack(self):
        """Test tetralemma pack specifically."""
        from humanizer.core.trm.povm import create_tetralemma_pack

        pack = create_tetralemma_pack(rank=64)

        assert pack.name == "tetralemma"
        assert len(pack.operators) == 4

        # Check axis names
        axis_names = [op.name for op in pack.operators]
        expected = ["A", "¬A", "both", "neither"]
        assert axis_names == expected, f"Got {axis_names}, expected {expected}"


class TestVerification:
    """Test transformation verification."""

    def test_verify_transformation(self):
        """Test basic verification."""
        np.random.seed(42)

        # Create before/after embeddings
        embedding_before = np.random.randn(384)
        embedding_before /= np.linalg.norm(embedding_before)

        # Simulate transformation (small perturbation)
        embedding_after = embedding_before + 0.1 * np.random.randn(384)
        embedding_after /= np.linalg.norm(embedding_after)

        # Verify
        result = verify_transformation(
            embedding_before=embedding_before,
            embedding_after=embedding_after,
            povm_pack_name="tone",
            target_axis="analytical",
            target_threshold=0.05,
            rank=64,
        )

        # Check result structure
        assert isinstance(result.success, bool)
        assert isinstance(result.alignment, float)
        assert isinstance(result.magnitude, float)
        assert isinstance(result.povm_readings_before, dict)
        assert isinstance(result.povm_readings_after, dict)
        assert isinstance(result.rho_distance, float)

        # Check bounds
        assert -1 <= result.alignment <= 1
        assert result.magnitude >= 0
        assert 0 <= result.rho_distance <= 1

    def test_no_movement(self):
        """Test verification when no movement occurs."""
        np.random.seed(42)

        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        # Same embedding before and after
        result = verify_transformation(
            embedding_before=embedding,
            embedding_after=embedding,
            povm_pack_name="tone",
            target_axis="analytical",
            target_threshold=0.05,
            rank=64,
        )

        # Should detect no movement
        assert result.magnitude < 1e-6
        assert result.rho_distance < 1e-6

    def test_invalid_pack_name(self):
        """Test error handling for invalid POVM pack."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        with pytest.raises(ValueError, match="Unknown POVM pack"):
            verify_transformation(
                embedding_before=embedding,
                embedding_after=embedding,
                povm_pack_name="nonexistent",
                target_axis="foo",
                rank=64,
            )

    def test_invalid_axis(self):
        """Test error handling for invalid axis."""
        np.random.seed(42)
        embedding = np.random.randn(384)
        embedding /= np.linalg.norm(embedding)

        with pytest.raises(ValueError, match="Unknown axis"):
            verify_transformation(
                embedding_before=embedding,
                embedding_after=embedding,
                povm_pack_name="tone",
                target_axis="nonexistent_axis",
                rank=64,
            )

    def test_serialization(self):
        """Test that verification result can be serialized."""
        np.random.seed(42)
        embedding_before = np.random.randn(384)
        embedding_before /= np.linalg.norm(embedding_before)

        embedding_after = embedding_before + 0.1 * np.random.randn(384)
        embedding_after /= np.linalg.norm(embedding_after)

        result = verify_transformation(
            embedding_before=embedding_before,
            embedding_after=embedding_after,
            povm_pack_name="tone",
            target_axis="analytical",
            rank=64,
        )

        # Serialize
        data = result.to_dict()

        # Check keys
        assert "success" in data
        assert "alignment" in data
        assert "povm_readings_before" in data
        assert "povm_readings_after" in data


# Run tests manually (for testing without pytest)
if __name__ == "__main__":
    print("Running TRM Core Tests...\n")

    test_density = TestDensityMatrix()
    test_density.test_construct_density_matrix()
    print("✅ Density matrix construction")

    test_density.test_purity_bounds()
    print("✅ Purity bounds")

    test_density.test_entropy_non_negative()
    print("✅ Entropy non-negative")

    test_density.test_rho_distance()
    print("✅ ρ distance")

    test_povm = TestPOVM()
    test_povm.test_povm_pack_creation()
    print("✅ POVM pack creation")

    test_povm.test_povm_sum_to_identity()
    print("✅ POVM sum to identity")

    test_povm.test_born_rule_probabilities()
    print("✅ Born rule probabilities")

    test_povm.test_predefined_packs()
    print("✅ Predefined POVM packs")

    test_verify = TestVerification()
    test_verify.test_verify_transformation()
    print("✅ Transformation verification")

    test_verify.test_no_movement()
    print("✅ No movement detection")

    print("\n✅ All tests passed!")
