import { existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
async function detectArchiveType(archivePath) {
  if (!existsSync(archivePath)) {
    return {
      type: "unknown",
      needsExtraction: false,
      needsImport: false,
      path: archivePath
    };
  }
  const stats = statSync(archivePath);
  if (stats.isFile() && archivePath.toLowerCase().endsWith(".zip")) {
    const fileSize = stats.size;
    return {
      type: "zip",
      needsExtraction: true,
      needsImport: true,
      path: archivePath,
      estimatedSize: fileSize
    };
  }
  if (stats.isDirectory()) {
    const hasEmbeddingsDb = existsSync(path.join(archivePath, ".embeddings.db"));
    const hasArchiveConfig = existsSync(path.join(archivePath, "archive-config.json"));
    if (hasEmbeddingsDb || hasArchiveConfig) {
      const conversationCount = countConversations(archivePath);
      return {
        type: "humanizer-archive",
        needsExtraction: false,
        needsImport: false,
        path: archivePath,
        conversationCount
      };
    }
    const hasConversationsJson = existsSync(path.join(archivePath, "conversations.json"));
    const hasDatedFolders = checkForDatedFolders(archivePath);
    if (hasConversationsJson || hasDatedFolders) {
      const conversationCount = await countOpenAIConversations(archivePath);
      return {
        type: "openai-export",
        needsExtraction: false,
        needsImport: true,
        path: archivePath,
        conversationCount
      };
    }
  }
  return {
    type: "unknown",
    needsExtraction: false,
    needsImport: false,
    path: archivePath
  };
}
function checkForDatedFolders(dirPath) {
  try {
    const entries = readdirSync(dirPath);
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    return entries.some((entry) => datePattern.test(entry));
  } catch {
    return false;
  }
}
function countConversations(archivePath) {
  try {
    const entries = readdirSync(archivePath);
    return entries.filter((entry) => {
      const fullPath = path.join(archivePath, entry);
      return statSync(fullPath).isDirectory() && !entry.startsWith(".");
    }).length;
  } catch {
    return 0;
  }
}
async function countOpenAIConversations(dirPath) {
  const conversationsPath = path.join(dirPath, "conversations.json");
  if (existsSync(conversationsPath)) {
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(conversationsPath, "utf-8");
      const data = JSON.parse(content);
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }
  try {
    const entries = readdirSync(dirPath);
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    return entries.filter((entry) => datePattern.test(entry)).length;
  } catch {
    return 0;
  }
}
export {
  detectArchiveType
};
//# sourceMappingURL=archive-detector-BBGQvmgj.js.map
