import { ACL_HEADERS } from "./acl-headers.js";
import { expandAclSource } from "./expander.js";
import { PYTHON_ACL_MODULES } from "./python-acl-modules.js";
import { expandPythonAclSource } from "./python-expander.js";
import { RUST_ACL_BUNDLE } from "./rust-acl-bundle.js";
import { expandRustAclSource } from "./rust-expander.js";

const CPP_SAMPLE_CODE = `#include <bits/stdc++.h>
#include <atcoder/dsu>
using namespace std;

int main() {
    atcoder::dsu uf(5);
    uf.merge(0, 1);
    uf.merge(3, 4);
    cout << uf.same(0, 1) << " " << uf.same(1, 2) << "\\n";
}
`;

const PYTHON_SAMPLE_CODE = `from atcoder.dsu import DSU

def main() -> None:
    uf = DSU(5)
    uf.merge(0, 1)
    uf.merge(3, 4)
    print(uf.same(0, 1), uf.same(1, 2))


if __name__ == "__main__":
    main()
`;

const RUST_SAMPLE_CODE = `use ac_library::Dsu;

fn main() {
    let mut uf = Dsu::new(5);
    uf.merge(0, 1);
    uf.merge(3, 4);
    println!("{} {}", uf.same(0, 1), uf.same(1, 2));
}
`;

const LANGUAGE_CONFIG = {
  cpp: {
    sampleCode: CPP_SAMPLE_CODE,
    downloadName: "combined.cpp",
    expand(source) {
      const result = expandAclSource(source, ACL_HEADERS);
      return {
        code: result.code,
        issues: result.missingHeaders,
        issueLabel: "Missing header",
      };
    },
  },
  python: {
    sampleCode: PYTHON_SAMPLE_CODE,
    downloadName: "combined.py",
    expand(source) {
      const result = expandPythonAclSource(source, PYTHON_ACL_MODULES);
      return {
        code: result.code,
        issues: result.missingModules,
        issueLabel: "Missing module",
      };
    },
  },
  rust: {
    sampleCode: RUST_SAMPLE_CODE,
    downloadName: "combined.rs",
    expand(source) {
      const result = expandRustAclSource(source, RUST_ACL_BUNDLE);
      return {
        code: result.code,
        issues: [],
        issueLabel: "",
      };
    },
  },
};

const inputCode = document.querySelector("#inputCode");
const outputCode = document.querySelector("#outputCode");
const statusMessage = document.querySelector("#statusMessage");
const expandButton = document.querySelector("#expandButton");
const sampleButton = document.querySelector("#sampleButton");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const languageSelect = document.querySelector("#languageSelect");

function currentLanguage() {
  return LANGUAGE_CONFIG[languageSelect.value] ? languageSelect.value : "cpp";
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function expandCurrentSource() {
  const language = currentLanguage();
  const config = LANGUAGE_CONFIG[language];
  const source = inputCode.value.trim().length > 0 ? inputCode.value : config.sampleCode;
  const result = config.expand(source);
  outputCode.value = result.code;

  if (result.issues.length > 0) {
    setStatus(`${result.issueLabel}: ${result.issues.join(", ")}`);
    return;
  }

  setStatus("Expanded successfully.");
}

async function copyOutput() {
  if (!outputCode.value) {
    setStatus("Nothing to copy.");
    return;
  }

  await navigator.clipboard.writeText(outputCode.value);
  setStatus("Copied to clipboard.");
}

function downloadOutput() {
  if (!outputCode.value) {
    setStatus("Nothing to download.");
    return;
  }

  const blob = new Blob([outputCode.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = LANGUAGE_CONFIG[currentLanguage()].downloadName;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${anchor.download}.`);
}

sampleButton.addEventListener("click", () => {
  inputCode.value = LANGUAGE_CONFIG[currentLanguage()].sampleCode;
  setStatus("Sample code loaded.");
});

expandButton.addEventListener("click", expandCurrentSource);
copyButton.addEventListener("click", () => {
  copyOutput().catch(() => setStatus("Clipboard copy failed."));
});
downloadButton.addEventListener("click", downloadOutput);
languageSelect.addEventListener("change", () => {
  inputCode.value = LANGUAGE_CONFIG[currentLanguage()].sampleCode;
  expandCurrentSource();
});

inputCode.value = CPP_SAMPLE_CODE;
expandCurrentSource();
