#!/bin/bash

# This runs basically to ensure that no "extra" stuff gets included in a minimal build of thorish.
# esbuild/friends can get confused about what has side-effects, so if this errors out, probably mark
# more stuff with `/* @__PURE__ */`.

set -eu

echo "Checking Browser..."
esbuild --bundle build-test/entrypoint-browser.ts --format=esm > build-test/actual-browser.js
diff build-test/expected-browser.js build-test/actual-browser.js

echo "Checking Node..."
esbuild --bundle build-test/entrypoint-node.ts --format=esm --platform=node > build-test/actual-node.js
diff build-test/expected-node.js build-test/actual-node.js

echo "Ok!"
