function isNameStart(char) {
  return /[A-Za-z_]/.test(char);
}

function isNameChar(char) {
  return /[A-Za-z0-9_]/.test(char);
}

function isStringPrefix(text) {
  return /^[rRuUbBfF]+$/.test(text);
}

function skipString(source, start) {
  let index = start;

  while (index < source.length && isNameChar(source[index])) {
    index += 1;
  }

  let quoteIndex = start;
  if (index > start && isStringPrefix(source.slice(start, index))) {
    quoteIndex = index;
  }

  const quote = source[quoteIndex];
  if (quote !== "'" && quote !== '"') {
    return null;
  }

  const triple = source.slice(quoteIndex, quoteIndex + 3) === quote.repeat(3);
  let cursor = quoteIndex + (triple ? 3 : 1);
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (triple) {
      if (source.slice(cursor, cursor + 3) === quote.repeat(3)) {
        return cursor + 3;
      }
      cursor += 1;
      continue;
    }
    if (source[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }

  return source.length;
}

function tokenizePython(source) {
  const tokens = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const char = source[index];

    if (char === " " || char === "\t" || char === "\f") {
      index += 1;
      continue;
    }

    if (char === "\\") {
      if (source[index + 1] === "\r" && source[index + 2] === "\n") {
        index += 3;
        line += 1;
        continue;
      }
      if (source[index + 1] === "\n") {
        index += 2;
        line += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (char === "\r") {
      if (source[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }
      tokens.push({ type: "NEWLINE", line });
      line += 1;
      continue;
    }

    if (char === "\n") {
      tokens.push({ type: "NEWLINE", line });
      index += 1;
      line += 1;
      continue;
    }

    if (char === "#") {
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") {
        index += 1;
      }
      continue;
    }

    if (isNameStart(char)) {
      const stringEnd = skipString(source, index);
      if (stringEnd !== null) {
        const consumed = source.slice(index, stringEnd);
        const newlineCount = (consumed.match(/\r\n|\r|\n/g) || []).length;
        index = stringEnd;
        line += newlineCount;
        continue;
      }

      let end = index + 1;
      while (end < source.length && isNameChar(source[end])) {
        end += 1;
      }
      const value = source.slice(index, end);
      let type = "NAME";
      if (value === "import") {
        type = "IMPORT";
      } else if (value === "from") {
        type = "FROM";
      } else if (value === "as") {
        type = "AS";
      }
      tokens.push({ type, value, line });
      index = end;
      continue;
    }

    if (char === "'" || char === '"') {
      const stringEnd = skipString(source, index);
      const consumed = source.slice(index, stringEnd);
      const newlineCount = (consumed.match(/\r\n|\r|\n/g) || []).length;
      index = stringEnd;
      line += newlineCount;
      continue;
    }

    if (char === ".") {
      tokens.push({ type: "DOT", line });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "COMMA", line });
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "LPAREN", line });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", line });
      index += 1;
      continue;
    }
    if (char === ";") {
      tokens.push({ type: "SEMICOLON", line });
      index += 1;
      continue;
    }

    index += 1;
  }

  return tokens;
}

function parseDottedName(tokens, startIndex) {
  let index = startIndex;
  if (tokens[index]?.type !== "NAME") {
    return null;
  }

  let name = tokens[index].value;
  let endIndex = index + 1;
  index += 1;

  while (tokens[index]?.type === "DOT" && tokens[index + 1]?.type === "NAME") {
    name += `.${tokens[index + 1].value}`;
    index += 2;
    endIndex = index;
  }

  return { name, endIndex };
}

function parseAlias(tokens, startIndex) {
  const dotted = parseDottedName(tokens, startIndex);
  if (!dotted) {
    return null;
  }

  let index = dotted.endIndex;
  let asname = null;
  if (tokens[index]?.type === "AS" && tokens[index + 1]?.type === "NAME") {
    asname = tokens[index + 1].value;
    index += 2;
  }

  return {
    name: dotted.name,
    asname,
    endIndex: index,
  };
}

function consumeSeparators(tokens, startIndex, parenthesisDepth) {
  let index = startIndex;
  let depth = parenthesisDepth;
  let ended = false;
  let endLine = tokens[startIndex - 1]?.line ?? 1;

  while (index < tokens.length) {
    const token = tokens[index];
    endLine = token.line;

    if (token.type === "LPAREN") {
      depth += 1;
      index += 1;
      continue;
    }
    if (token.type === "RPAREN") {
      if (depth === 0) {
        ended = true;
        break;
      }
      depth -= 1;
      index += 1;
      continue;
    }
    if (token.type === "COMMA") {
      index += 1;
      continue;
    }
    if (token.type === "NEWLINE") {
      index += 1;
      if (depth === 0) {
        ended = true;
        break;
      }
      continue;
    }
    if (token.type === "SEMICOLON") {
      index += 1;
      ended = true;
      break;
    }
    break;
  }

  return { index, depth, ended, endLine };
}

function skipParenthesizedNewlines(tokens, startIndex, parenthesisDepth) {
  let index = startIndex;
  let depth = parenthesisDepth;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "LPAREN") {
      depth += 1;
      index += 1;
      continue;
    }
    if (token.type === "NEWLINE" && depth > 0) {
      index += 1;
      continue;
    }
    break;
  }

  return { index, depth };
}

function parseAtcoderImports(source) {
  const tokens = tokenizePython(source);
  const imports = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "IMPORT") {
      const statementLine = token.line;
      let cursor = index + 1;
      let parenthesisDepth = 0;
      const parsedImports = [];
      let statementEndLine = statementLine;

      while (cursor < tokens.length) {
        const skipped = skipParenthesizedNewlines(tokens, cursor, parenthesisDepth);
        cursor = skipped.index;
        parenthesisDepth = skipped.depth;

        const alias = parseAlias(tokens, cursor);
        if (!alias) {
          break;
        }
        parsedImports.push(alias);
        cursor = alias.endIndex;

        const separators = consumeSeparators(tokens, cursor, parenthesisDepth);
        cursor = separators.index;
        parenthesisDepth = separators.depth;
        statementEndLine = separators.endLine;
        if (separators.ended) {
          index = cursor - 1;
          break;
        }
      }

      if (parsedImports.length === 0) {
        continue;
      }
      for (const alias of parsedImports) {
        if (!alias.name.startsWith("atcoder")) {
          continue;
        }
        imports.push({
          lineno: statementLine,
          endLineno: statementEndLine,
          importFrom: null,
          name: alias.name,
          asname: alias.asname,
        });
      }
      continue;
    }

    if (token.type !== "FROM") {
      continue;
    }

    const moduleInfo = parseDottedName(tokens, index + 1);
    if (!moduleInfo || !moduleInfo.name.startsWith("atcoder") || tokens[moduleInfo.endIndex]?.type !== "IMPORT") {
      continue;
    }

    const statementLine = token.line;
    const importFrom = moduleInfo.name;
    let cursor = moduleInfo.endIndex + 1;
    let parenthesisDepth = 0;
    const parsedImports = [];
    let statementEndLine = statementLine;
    while (cursor < tokens.length) {
      const skipped = skipParenthesizedNewlines(tokens, cursor, parenthesisDepth);
      cursor = skipped.index;
      parenthesisDepth = skipped.depth;

      const alias = parseAlias(tokens, cursor);
      if (!alias) {
        break;
      }
      parsedImports.push(alias);
      cursor = alias.endIndex;

      const separators = consumeSeparators(tokens, cursor, parenthesisDepth);
      cursor = separators.index;
      parenthesisDepth = separators.depth;
      statementEndLine = separators.endLine;
      if (separators.ended) {
        index = cursor - 1;
        break;
      }
    }

    if (parsedImports.length === 0) {
      continue;
    }
    for (const alias of parsedImports) {
      imports.push({
        lineno: statementLine,
        endLineno: statementEndLine,
        importFrom,
        name: alias.name,
        asname: alias.asname,
      });
    }
  }

  return imports;
}

function resolveModuleName(importFrom, name, modules) {
  if (importFrom === null) {
    return name;
  }

  const nestedModuleName = `${importFrom}.${name}`;
  if (modules[nestedModuleName] !== undefined) {
    return nestedModuleName;
  }
  return importFrom;
}

class ModuleImporter {
  constructor(modules) {
    this.modules = modules;
    this.importedModules = [];
    this.missingModules = new Set();
  }

  importModule(importFrom, name, asname = null) {
    let result = "";
    const moduleName = resolveModuleName(importFrom, name, this.modules);
    const source = this.modules[moduleName];

    if (source === undefined) {
      this.missingModules.add(moduleName);
      return result;
    }

    if (!this.importedModules.includes(moduleName)) {
      this.importedModules.push(moduleName);

      const imports = parseAtcoderImports(source);
      const importLines = [];
      for (const importInfo of imports) {
        result += this.importModule(importInfo.importFrom, importInfo.name, importInfo.asname);
        for (let line = importInfo.lineno - 1; line < importInfo.endLineno; line += 1) {
          importLines.push(line);
        }
      }

      const modules = moduleName.split(".");
      for (let index = 0; index < modules.length - 1; index += 1) {
        result += this.importModule(null, modules.slice(0, index + 1).join("."));
      }

      const lines = source.split(/\r?\n/);
      for (const line of importLines) {
        if (lines[line] !== undefined) {
          lines[line] = `# ${lines[line]}`;
        }
      }

      const codeVariable = `_${moduleName.replaceAll(".", "_")}_code`;
      result += `${codeVariable} = """\n`;
      result += `${lines.join("\n")}`;
      result += `"""\n\n`;
      result += `${moduleName} = types.ModuleType('${moduleName}')\n`;

      const imported = [];
      for (const importInfo of imports) {
        if (importInfo.importFrom === null) {
          const importedModules = importInfo.name.split(".");
          for (let index = 0; index < importedModules.length; index += 1) {
            const importName = importedModules.slice(0, index + 1).join(".");
            if (imported.includes(importName)) {
              continue;
            }
            imported.push(importName);
            result += `${moduleName}.__dict__['${importName}'] = ${importName}\n`;
          }
        } else {
          result += `${moduleName}.__dict__['${importInfo.name}'] = ${importInfo.importFrom}.${importInfo.name}\n`;
        }
      }

      result += `exec(${codeVariable}, ${moduleName}.__dict__)\n`;
    }

    if (importFrom === null) {
      if (asname === null) {
        if (name !== moduleName) {
          result += `${name} = ${moduleName}\n`;
        }
      } else {
        result += `${asname} = ${moduleName}\n`;
      }
    } else if (asname === null) {
      if (name !== `${importFrom}.${name}`) {
        result += `${name} = ${importFrom}.${name}\n`;
      }
    } else {
      result += `${asname} = ${importFrom}.${name}\n`;
    }

    return `${result}\n`;
  }
}

export function expandPythonAclSource(sourceCode, modules) {
  const imports = parseAtcoderImports(sourceCode);
  const importer = new ModuleImporter(modules);
  const importLines = [];
  let result = "import types\n\n";

  for (const importInfo of imports) {
    result += importer.importModule(importInfo.importFrom, importInfo.name, importInfo.asname);
    for (let line = importInfo.lineno - 1; line < importInfo.endLineno; line += 1) {
      importLines.push(line);
    }
  }

  const lines = sourceCode.split(/\r?\n/);
  for (const line of importLines) {
    if (lines[line] !== undefined) {
      lines[line] = `# ${lines[line]}`;
    }
  }
  result += lines.join("\n");

  return {
    code: result,
    missingModules: [...importer.missingModules].sort(),
  };
}
