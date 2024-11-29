"use strict";
const {
  __export,
  __toESM,
  __toCommonJS,
  __async
} = require('./esblib.cjs');


// src/repl.ts
var repl_exports = {};
__export(repl_exports, {
  startRepl: () => startRepl
});
module.exports = __toCommonJS(repl_exports);
var import_node_os = __toESM(require("os"), 1);
var import_node_path = __toESM(require("path"), 1);
var import_node_util = require("util");
var import_core = require("./core.cjs");
var import_vendor = require("./vendor.cjs");
function startRepl() {
  return __async(this, null, function* () {
    import_core.defaults.verbose = false;
    const r = (yield import("repl")).start({
      prompt: import_vendor.chalk.greenBright.bold("\u276F "),
      useGlobal: true,
      preview: false,
      writer(output) {
        if (output instanceof import_core.ProcessOutput) {
          return output.toString().replace(/\n$/, "");
        }
        return (0, import_node_util.inspect)(output, { colors: true });
      }
    });
    r.setupHistory(import_node_path.default.join(import_node_os.default.homedir(), ".zx_repl_history"), () => {
    });
  });
}
/* c8 ignore next 100 */
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  startRepl
});