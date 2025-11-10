#!/bin/bash

# Fix AuthContext
sed -i '' 's/import { createContext, useContext, useState, ReactNode } from '\''react'\'';/import { createContext, useContext, useState } from '\''react'\'';\nimport type { ReactNode } from '\''react'\'';/' src/core/context/AuthContext.tsx

# Fix CanvasContext
sed -i '' 's/import { createContext, useContext, useState, ReactNode } from '\''react'\'';/import { createContext, useContext, useState } from '\''react'\'';\nimport type { ReactNode } from '\''react'\'';/' src/core/context/CanvasContext.tsx

# Fix tool-registry
sed -i '' 's/import { ReactNode } from "react";/import type { ReactNode } from "react";/' src/core/tool-registry.tsx

# Fix LeftPanel - remove unused useEffect
sed -i '' 's/import { useState, useEffect } from '\''react'\'';/import { useState } from '\''react'\'';/' src/features/archive/LeftPanel.tsx

# Fix CanvasContext.test
sed -i '' 's/import { render, screen, waitFor, beforeEach } from/import { render, screen, waitFor } from/' src/core/context/CanvasContext.test.tsx
sed -i '' 's/import { createContext, useContext, useState, ReactNode } from '\''react'\'';/import { createContext, useContext, useState } from '\''react'\'';\nimport type { ReactNode } from '\''react'\'';/' src/core/context/CanvasContext.test.tsx

# Fix test-utils
sed -i '' 's/import { ReactElement } from '\''react'\'';/import type { ReactElement } from '\''react'\'';/' src/test/test-utils.tsx
sed -i '' 's/import { render, RenderOptions } from/import { render } from/' src/test/test-utils.tsx
sed -i '' $'1 a\\\nimport type { RenderOptions } from '\''@testing-library/react'\'';\n' src/test/test-utils.tsx

echo "Type-only imports fixed"
