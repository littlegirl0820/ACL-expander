const AC_LIBRARY_USE_RE = /^\s*use\s+ac_library::([\s\S]*?);/gm;
const AC_LIBRARY_PATH_RE = /\bac_library::([A-Za-z_][A-Za-z0-9_]*)(?:::\s*([A-Za-z_][A-Za-z0-9_]*))?/g;
const EXTERN_CRATE_RE = /^(\s*)extern\s+crate\s+ac_library\s*;\s*$/gm;

function addWithDependencies(moduleName, bundle, outputModules) {
  if (!bundle.outputListAll.includes(moduleName) || outputModules.has(moduleName)) {
    return;
  }

  outputModules.add(moduleName);
  for (const dependency of bundle.dependencyList[moduleName] ?? []) {
    addWithDependencies(dependency, bundle, outputModules);
  }
}

function addSymbolModule(symbol, bundle, outputModules) {
  if (symbol === "*") {
    for (const moduleName of bundle.outputListAll) {
      addWithDependencies(moduleName, bundle, outputModules);
    }
    return;
  }

  if (bundle.outputListAll.includes(symbol)) {
    addWithDependencies(symbol, bundle, outputModules);
    return;
  }

  const mappedModule = bundle.symbolMap[symbol];
  if (mappedModule) {
    addWithDependencies(mappedModule, bundle, outputModules);
  }
}

function collectFromUseClause(clause, bundle, outputModules) {
  const normalized = clause.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return;
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    for (const item of normalized.slice(1, -1).split(",")) {
      const symbol = item.trim().split(/\s+as\s+/)[0]?.trim();
      if (symbol) {
        addSymbolModule(symbol, bundle, outputModules);
      }
    }
    return;
  }

  const firstSegment = normalized.split("::")[0]?.trim();
  if (!firstSegment) {
    return;
  }

  if (bundle.outputListAll.includes(firstSegment)) {
    addWithDependencies(firstSegment, bundle, outputModules);
    return;
  }

  addSymbolModule(firstSegment.split(/\s+as\s+/)[0].trim(), bundle, outputModules);
}

function collectOutputModules(sourceCode, bundle) {
  const outputModules = new Set();

  for (const match of sourceCode.matchAll(AC_LIBRARY_USE_RE)) {
    collectFromUseClause(match[1], bundle, outputModules);
  }

  for (const match of sourceCode.matchAll(AC_LIBRARY_PATH_RE)) {
    const first = match[1];
    const second = match[2] ?? null;
    if (bundle.outputListAll.includes(first)) {
      addWithDependencies(first, bundle, outputModules);
      continue;
    }
    if (second !== null) {
      addSymbolModule(second, bundle, outputModules);
      continue;
    }
    addSymbolModule(first, bundle, outputModules);
  }

  return [...outputModules].sort();
}

function outputFile(moduleName, bundle) {
  const lines = [`pub mod ${moduleName} {`];
  lines.push(...bundle.files[moduleName].split(/\r?\n/));
  lines.push("}");
  return lines;
}

function buildExpandedLibrary(outputModules, bundle) {
  const lines = [bundle.header];

  for (const moduleName of outputModules) {
    lines.push(...outputFile(moduleName, bundle));
  }

  for (const moduleName of outputModules) {
    if (!moduleName.startsWith("internal")) {
      lines.push(`use ${moduleName}::*;`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function rewriteSource(sourceCode) {
  EXTERN_CRATE_RE.lastIndex = 0;
  let rewritten = sourceCode.replace(EXTERN_CRATE_RE, "$1// extern crate ac_library;");
  rewritten = rewritten.replace(AC_LIBRARY_USE_RE, (match, clause, offset, source) => {
    const indentMatch = match.match(/^(\s*)use\s+/);
    const indent = indentMatch ? indentMatch[1] : "";
    const previousChar = offset > 0 ? source[offset - 1] : "\n";
    if (previousChar !== "\n" && previousChar !== "\r") {
      return match;
    }
    return `${indent}// ${match.trim()}`;
  });
  rewritten = rewritten.replace(/\bac_library::/g, "");
  return rewritten;
}

export function expandRustAclSource(sourceCode, bundle) {
  const outputModules = collectOutputModules(sourceCode, bundle);
  if (outputModules.length === 0) {
    return {
      code: sourceCode,
      usedBundle: false,
      outputModules: [],
    };
  }

  return {
    code: `${buildExpandedLibrary(outputModules, bundle)}\n${rewriteSource(sourceCode)}`,
    usedBundle: true,
    outputModules,
  };
}
