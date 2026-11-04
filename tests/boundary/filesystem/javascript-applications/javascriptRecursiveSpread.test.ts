import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";

import { analyzeJavaScriptApplication } from "../../../support/javascriptApplicationScope.js";
import { javascriptApplicationAnalysisResultSchema } from "../../../../src/domain/javascript/javascriptApplicationAnalysis.js";
import { createTestTempDirectory } from "../../../fixtures/temporaryDirectory.js";

it("parses a file that spreads a self-recursive call result and reads its members", async () => {
  const root = await createTestTempDirectory("rea-js-recursive-spread-");
  const app = join(root, "app");
  await mkdir(app);
  await writeFile(
    join(app, "package.json"),
    JSON.stringify({ name: "app", version: "1.0.0", main: "index.js" }),
  );
  await writeFile(
    join(app, "index.js"),
    [
      "function f(o) {",
      "  const stay = f(o);",
      '  return { ...stay, c: stay.sc.startsWith("k") };',
      "}",
      "module.exports = f;",
      "",
    ].join("\n"),
  );
  const analyzed = await analyzeJavaScriptApplication({ input_path: app });
  if (!analyzed.ok) throw analyzed.error;
  const result = javascriptApplicationAnalysisResultSchema.parse(
    analyzed.value.normalized_result,
  );
  expect(result.statistics.parsed_javascript_files).toBe(1);
  expect(JSON.stringify(result)).not.toContain("Maximum call stack");
  // The bounded read stays visible as limited coverage, not a complete parse.
  const asset = result.graph.nodes.find(
    (node) => node.kind === "javascript-asset",
  );
  expect(asset?.observations[0]?.properties).toMatchObject({
    parse_status: "partial",
    analysis_coverage: {
      examination: { status: "limited", electron_call_paths_limited: true },
    },
  });
});
