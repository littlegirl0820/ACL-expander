const ATCODER_INCLUDE = /^#include\s*["<](atcoder\/[a-z_]*(|.hpp))[">]\s*$/;
const INCLUDE_GUARD = /#.*ATCODER_[A-Z_]*_HPP/;

function isIgnoredLine(line) {
  if (INCLUDE_GUARD.test(line)) {
    return true;
  }
  if (line.trim() === "#pragma once") {
    return true;
  }
  if (line.trim().startsWith("//")) {
    return true;
  }
  return false;
}

function findAcl(name, headers) {
  if (headers[name]) {
    return name;
  }
  throw new Error(`cannot find: ${name}`);
}

function expandAcl(path, headers, included, missingHeaders) {
  if (included.has(path)) {
    return [];
  }
  included.add(path);

  const source = headers[path];
  if (source === undefined) {
    missingHeaders.add(path);
    return [];
  }

  const result = [];
  for (const line of source.split(/\r?\n/)) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const match = line.match(ATCODER_INCLUDE);
    if (match) {
      try {
        result.push(...expandAcl(findAcl(match[1], headers), headers, included, missingHeaders));
      } catch {
        missingHeaders.add(match[1]);
      }
      continue;
    }

    result.push(line);
  }
  return result;
}

export function expandAclSource(sourceCode, headers, options = {}) {
  const included = new Set();
  const missingHeaders = new Set();
  const result = [];
  let lineNumber = 0;

  for (const line of sourceCode.split(/\r?\n/)) {
    lineNumber += 1;
    const match = line.match(ATCODER_INCLUDE);
    if (match) {
      try {
        result.push(...expandAcl(findAcl(match[1], headers), headers, included, missingHeaders));
        if (options.origname) {
          result.push(`#line ${lineNumber + 1} "${options.origname}"`);
        }
      } catch {
        missingHeaders.add(match[1]);
      }
      continue;
    }

    result.push(line);
  }

  return {
    code: result.join("\n"),
    missingHeaders: [...missingHeaders].sort(),
  };
}
