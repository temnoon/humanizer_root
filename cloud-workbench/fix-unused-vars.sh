#!/bin/bash

# Fix api.ts - TransformationHistoryItem is actually used, remove from error list
# Nothing to fix here, it's a false positive

# Fix Canvas.tsx unused 'text' and 'match' variables
sed -i '' 's/const { text, setText, metrics, setMetrics } = useCanvas();/const { setText, metrics, setMetrics } = useCanvas();/' src/features/canvas/Canvas.tsx

# Fix DialoguePanel unused onDefinitionReceived
sed -i '' 's/  onDefinitionReceived,$/  \/\/ onDefinitionReceived, \/\/ unused/' src/features/attributes/DialoguePanel.tsx

# Fix MultiReadingPanel unused QuantumStep and sessionId
sed -i '' 's/import { QuantumStep, QuantumSession } from/import { QuantumSession } from/' src/features/panels/MultiReadingPanel.tsx
sed -i '' 's/  const \[sessionId, setSessionId\] = useState<string | null>(null);/  const \[, setSessionId\] = useState<string | null>(null);/' src/features/panels/MultiReadingPanel.tsx

# Fix AllegoricalPanel unused incrementUsage
sed -i '' 's/const { user, isAuthenticated, incrementUsage } = useAuth();/const { user, isAuthenticated } = useAuth();/' src/features/panels/allegorical/AllegoricalPanel.tsx

# Fix MaieuticPanel unused 'i'
# This one requires manual fix since it's in a map function

echo "Unused variables cleaned"
