# ACL Expander

ブラウザ上で C++ の `#include <atcoder/...>`、Python の `atcoder...` import、または Rust の `ac_library::...` 利用コードを展開し、提出用の単一ファイルを生成する静的サイトです。
入力コードはサーバに送られず、展開はクライアント側で行われます。

このツールは非公式です。ACL コードは公式 `atcoder/ac-library` に由来し、AtCoder Library 自体は `CC0-1.0` で配布されています。

公開 URL: https://littlegirl0820.github.io/ACL-expander/

## 使い方

上の URL を開いてコードを貼り付けるだけで使えます。

## License Notes

- このリポジトリ独自のコードは `MIT` ライセンスです。
- `src/acl-headers.js` に含まれる ACL ヘッダは `atcoder/ac-library` 由来で、`CC0-1.0` に従います。
- `src/python-acl-modules.js` に含まれる Python ACL モジュールは `not522/ac-library-python` 由来で、`MIT` に従います。
- `src/rust-acl-bundle.js` に含まれる Rust ACL モジュールは `rust-lang-ja/ac-library-rs` 由来で、`CC0-1.0` に従います。
- `tests/fixtures/` 配下の一部 fixture も `atcoder/ac-library` 由来で、`CC0-1.0` に従います。
