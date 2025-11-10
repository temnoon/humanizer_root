#!/bin/bash

# Fix AttributePreview
sed -i '' 's/import { AttributeDefinition, AttributeType } from/import type { AttributeDefinition, AttributeType } from/' src/features/attributes/AttributePreview.tsx

# Fix DialoguePanel
sed -i '' 's/import { DialogueMessage, AttributeDefinition } from/import type { DialogueMessage, AttributeDefinition } from/' src/features/attributes/DialoguePanel.tsx

# Fix ExampleStarters
sed -i '' 's/import { AttributeType, ExampleStarter } from/import type { AttributeType, ExampleStarter } from/' src/features/attributes/ExampleStarters.tsx

# Fix useAttributeExtraction
sed -i '' 's/import { AttributeType, DialogueMessage, ExtractAttributeResponse } from/import type { AttributeType, DialogueMessage, ExtractAttributeResponse } from/' src/features/attributes/useAttributeExtraction.ts

echo "Attribute imports fixed"
