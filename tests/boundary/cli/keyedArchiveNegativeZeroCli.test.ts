import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "plist";
import { expect } from "vitest";

import { parseEvidence } from "../../../src/domain/evidence.js";
import { keyedArchiveResultSchema } from "../../../src/domain/apple/keyedArchive.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";

const xmlArchive = (real: string): Buffer =>
  Buffer.from(
    build({
      $archiver: "NSKeyedArchiver",
      $version: 100000,
      $objects: ["$null", "__VALUE__"],
      $top: { root: { CF$UID: 1 } },
    }).replace("<string>__VALUE__</string>", `<real>${real}</real>`),
  );

// Python plistlib binary output of the same archive with $objects[1] = -0.0;
// the real's IEEE 754 bytes are 80 00 00 00 00 00 00 00.
const binaryNegativeZeroArchive = Buffer.from(
  "YnBsaXN0MDDUAQIDBAUGCQxZJGFyY2hpdmVyWCRvYmplY3RzVCR0b3BYJHZlcnNpb25fEA9OU0tleWVkQXJjaGl2ZXKiBwhVJG51bGwjgAAAAAAAAADRCgtUcm9vdIABEgABhqAIERskKTJER01WWV5gAAAAAAAAAQEAAAAAAAAADQAAAAAAAAAAAAAAAAAAAGU=",
  "base64",
);

cliTest(
  "keeps the sign of a negative-zero real in keyed archive results",
  async ({ cli }) => {
    const directory = await createTestTempDirectory("rea-keyed-negative-zero-");
    const cases = [
      [
        "xml-negative-zero",
        xmlArchive("-0.0"),
        { $plist_type: "real", decimal: "-0" },
      ],
      [
        "binary-negative-zero",
        binaryNegativeZeroArchive,
        { $plist_type: "real", decimal: "-0" },
      ],
      ["xml-positive-zero", xmlArchive("0.0"), 0],
      ["xml-nonzero", xmlArchive("1.25"), 1.25],
    ] as const;
    for (const [name, bytes, expected] of cases) {
      const path = join(directory, `${name}.plist`);
      await writeFile(path, bytes);
      const output = await cli.run({
        arguments: ["inspect-keyed-archive", path, "--json"],
        environment: { REA_LOG_LEVEL: "silent", REA_ANALYSIS_PROVIDER: "auto" },
      });
      expect(output.exitCode, `${name}: ${output.stderr}`).toBe(0);
      const result = keyedArchiveResultSchema.parse(
        parseEvidence(output.json).normalized_result,
      );
      expect(
        result.objects.find(({ id }) => id === 1),
        name,
      ).toMatchObject({ kind: "scalar", status: "observed", value: expected });
    }
  },
);
