/**
 * Chromium refuses to start when its sandbox is unavailable, most often when
 * REA runs as root in a container. Playwright's own advice names a launch
 * option REA callers cannot set, so name REA's opt-out instead.
 */
const SANDBOX_FAILURE =
  /Chromium sandboxing failed|No usable sandbox|crbug\.com\/638180|as root without --no-sandbox/u;

export const CHROMIUM_SANDBOX_REMEDIATION =
  "Chromium could not start its sandbox on this host. Run REA as a user whose host supports the Chromium sandbox, or set REA_BROWSER_NO_SANDBOX=true to launch without it, then retry.";

/** Remediation for a launch failure caused by an unavailable Chromium sandbox. */
export const chromiumSandboxRemediation = (
  cause: unknown,
): string | undefined =>
  SANDBOX_FAILURE.test(cause instanceof Error ? cause.message : String(cause))
    ? CHROMIUM_SANDBOX_REMEDIATION
    : undefined;
