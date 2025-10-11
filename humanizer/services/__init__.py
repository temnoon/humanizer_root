"""
Services package - Business logic layer

Services orchestrate:
- TRM core (density matrices, POVMs, verification)
- Database operations (SQLAlchemy)
- External systems (embedding models, LLMs)

Keep services thin - delegate to TRM core for quantum math.
"""

from .reading import ReadingService

__all__ = ["ReadingService"]
