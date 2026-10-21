import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { AnalysisInputError } from "../domain/analysisErrorCore.js";
import { projectAnalysisError } from "../domain/analysisErrorProjection.js";
import { startFirmwareDeadline } from "./FirmwareDeadline.js";
import type { FirmwareFileAccess } from "./FirmwareFiles.js";
import { publishFirmwareExtraction } from "./FirmwarePublication.js";
import type { normalizeUnblobReport } from "./FirmwareReports.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const publish = (outputDirectory: string) => {
  const deadline = startFirmwareDeadline("publication", 30_000);
  return publishFirmwareExtraction({
    files: {} as FirmwareFileAccess,
    workspacePath: outputDirectory,
    deadline,
    outputDirectory,
    entries: [],
    normalized: { files: new Map() } as unknown as ReturnType<
      typeof normalizeUnblobReport
    >,
    selection: { offset: 0, length: 1, sha256: "0".repeat(64) },
    maxDepth: 1,
    engine: {} as Parameters<typeof publishFirmwareExtraction>[0]["engine"],
    signal: deadline.signal,
    retainCleanup: () => {
      throw new Error("No destination was created");
    },
  });
};

it.each([
  [
    "an existing directory",
    "existing",
    "Extraction output root already exists",
  ],
  [
    "a directory under a missing parent",
    join("missing", "output"),
    "Extraction output parent is unavailable",
  ],
  [
    "a directory under a regular file",
    join("file", "output"),
    "Extraction output parent is not a directory",
  ],
])(
  "refuses %s as caller input without changing it",
  async (_label, relative, message) => {
    const root = await mkdtemp(join(tmpdir(), "rea-firmware-destination-"));
    roots.push(root);
    await mkdir(join(root, "existing"));
    await writeFile(join(root, "existing", "kept"), "kept");
    await writeFile(join(root, "file"), "file");
    const failure = await publish(join(root, relative)).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    expect(failure).toBeInstanceOf(AnalysisInputError);
    expect(projectAnalysisError(failure as AnalysisInputError)).toMatchObject({
      code: "invalid_request",
      category: "invalid_input",
      recovery: {
        kind: "inspect_input_contract",
        operation: "extract_firmware",
      },
      details: {
        issues: [
          { path: ["output_directory"], reason: "invalid_value", message },
        ],
      },
    });
    expect(await readdir(join(root, "existing"))).toEqual(["kept"]);
    expect((await readdir(root)).sort()).toEqual(["existing", "file"]);
  },
);
