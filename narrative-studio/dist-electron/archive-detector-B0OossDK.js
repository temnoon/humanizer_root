import { existsSync as r, statSync as d, readdirSync as a } from "node:fs";
import i from "node:path";
async function j(t) {
  if (!r(t))
    return {
      type: "unknown",
      needsExtraction: !1,
      needsImport: !1,
      path: t
    };
  const e = d(t);
  if (e.isFile() && t.toLowerCase().endsWith(".zip")) {
    const n = e.size;
    return {
      type: "zip",
      needsExtraction: !0,
      needsImport: !0,
      path: t,
      estimatedSize: n
    };
  }
  if (e.isDirectory()) {
    const n = r(i.join(t, ".embeddings.db")), s = r(i.join(t, "archive-config.json"));
    if (n || s) {
      const c = p(t);
      return {
        type: "humanizer-archive",
        needsExtraction: !1,
        needsImport: !1,
        path: t,
        conversationCount: c
      };
    }
    const o = r(i.join(t, "conversations.json")), u = f(t);
    if (o || u) {
      const c = await l(t);
      return {
        type: "openai-export",
        needsExtraction: !1,
        needsImport: !0,
        path: t,
        conversationCount: c
      };
    }
  }
  return {
    type: "unknown",
    needsExtraction: !1,
    needsImport: !1,
    path: t
  };
}
function f(t) {
  try {
    const e = a(t), n = /^\d{4}-\d{2}-\d{2}/;
    return e.some((s) => n.test(s));
  } catch {
    return !1;
  }
}
function p(t) {
  try {
    return a(t).filter((n) => {
      const s = i.join(t, n);
      return d(s).isDirectory() && !n.startsWith(".");
    }).length;
  } catch {
    return 0;
  }
}
async function l(t) {
  const e = i.join(t, "conversations.json");
  if (r(e))
    try {
      const { readFile: n } = await import("node:fs/promises"), s = await n(e, "utf-8"), o = JSON.parse(s);
      return Array.isArray(o) ? o.length : 0;
    } catch {
      return 0;
    }
  try {
    const n = a(t), s = /^\d{4}-\d{2}-\d{2}/;
    return n.filter((o) => s.test(o)).length;
  } catch {
    return 0;
  }
}
export {
  j as detectArchiveType
};
//# sourceMappingURL=archive-detector-B0OossDK.js.map
