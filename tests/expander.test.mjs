import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ACL_HEADERS } from "../src/acl-headers.js";
import { expandAclSource } from "../src/expander.js";
import { PYTHON_ACL_MODULES } from "../src/python-acl-modules.js";
import { expandPythonAclSource } from "../src/python-expander.js";
import { RUST_ACL_BUNDLE } from "../src/rust-acl-bundle.js";
import { expandRustAclSource } from "../src/rust-expander.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

{
  const source = `#include <bits/stdc++.h>
#include <atcoder/dsu>

int main() {}
`;

  const result = expandAclSource(source, ACL_HEADERS);
  assert.equal(result.missingHeaders.length, 0);
  assert.match(result.code, /namespace atcoder/);
  assert.match(result.code, /struct dsu/);
  assert.ok(!result.code.includes("#include <atcoder/dsu>"));
}

{
  const source = `#include <atcoder/all>
#include <atcoder/dsu>
`;

  const result = expandAclSource(source, ACL_HEADERS);
  assert.equal(result.missingHeaders.length, 0);
  assert.equal((result.code.match(/struct dsu/g) || []).length, 1);
}

{
  const source = `#include <atcoder/not_found>`;
  const result = expandAclSource(source, ACL_HEADERS);
  assert.deepEqual(result.missingHeaders, ["atcoder/not_found"]);
}

{
  const source = fs.readFileSync(
    path.join(fixturesDir, "include_unusual_format.cpp"),
    "utf8",
  );
  const result = expandAclSource(source, ACL_HEADERS);
  assert.equal(result.missingHeaders.length, 0);
  assert.equal((result.code.match(/struct dsu/g) || []).length, 1);
  assert.match(result.code, /#include <cstdio>/);
}

{
  const source = fs.readFileSync(
    path.join(fixturesDir, "comment_out.cpp"),
    "utf8",
  );
  const result = expandAclSource(source, ACL_HEADERS);
  assert.equal(result.missingHeaders.length, 0);
  assert.ok(result.code.includes("// #include <atcoder/dsu>"));
  assert.ok(result.code.includes("/* #include <atcoder/dsu> */"));
}

{
  const source = `#include <atcoder/dsu>\nint main() {}\n`;
  const result = expandAclSource(source, ACL_HEADERS, { origname: "main.cpp" });
  assert.match(result.code, /#line 2 "main.cpp"/);
}

{
  const source = `  #include <atcoder/dsu>\n`;
  const result = expandAclSource(source, ACL_HEADERS);
  assert.equal(result.code, source);
}

{
  const source = `from atcoder.dsu import DSU\n\nuf = DSU(3)\n`;
  const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
  assert.deepEqual(result.missingModules, []);
  assert.match(result.code, /import types/);
  assert.match(result.code, /atcoder\.dsu = types\.ModuleType\('atcoder\.dsu'\)/);
  assert.match(result.code, /class DSU/);
  assert.match(result.code, /# from atcoder\.dsu import DSU/);
}

{
  const source = `import atcoder.segtree as seg\n`;
  const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
  assert.deepEqual(result.missingModules, []);
  assert.match(result.code, /atcoder\._bit = types\.ModuleType\('atcoder\._bit'\)/);
  assert.match(result.code, /seg = atcoder\.segtree/);
}

{
  const source = `from atcoder.not_found import Thing\n`;
  const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
  assert.deepEqual(result.missingModules, ["atcoder.not_found"]);
}

{
  const source = `from atcoder.segtree import (\n  SegTree,\n)\n`;
  const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
  assert.deepEqual(result.missingModules, []);
  assert.match(result.code, /class SegTree/);
  assert.match(result.code, /# from atcoder\.segtree import \(/);
  assert.match(result.code, /#   SegTree,/);
}

{
  const source = `def build():\n    from atcoder.dsu import DSU\n    return DSU(2)\n`;
  const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
  assert.deepEqual(result.missingModules, []);
  assert.match(result.code, /#     from atcoder\.dsu import DSU/);
  assert.match(result.code, /def build\(\):/);
}

{
  const source = `use ac_library::Dsu;\n\nfn main() {\n    let mut uf = Dsu::new(2);\n    uf.merge(0, 1);\n}\n`;
  const result = expandRustAclSource(source, RUST_ACL_BUNDLE);
  assert.equal(result.usedBundle, true);
  assert.deepEqual(result.outputModules, ["dsu"]);
  assert.match(result.code, /\/\/https:\/\/github\.com\/rust-lang-ja\/ac-library-rs/);
  assert.match(result.code, /pub mod dsu \{/);
  assert.match(result.code, /pub struct Dsu/);
  assert.match(result.code, /use dsu::\*;/);
  assert.match(result.code, /\/\/ use ac_library::Dsu;/);
}

{
  const source = `extern crate ac_library;\nuse ac_library::Dsu;\n`;
  const result = expandRustAclSource(source, RUST_ACL_BUNDLE);
  assert.match(result.code, /\/\/ extern crate ac_library;/);
}

{
  const source = `use ac_library::{Max, Segtree};\n`;
  const result = expandRustAclSource(source, RUST_ACL_BUNDLE);
  assert.deepEqual(result.outputModules, ["internal_bit", "internal_type_traits", "segtree"]);
  assert.match(result.code, /pub mod segtree \{/);
  assert.match(result.code, /pub mod internal_bit \{/);
  assert.match(result.code, /use segtree::\*;/);
}

console.log("expander tests passed");
