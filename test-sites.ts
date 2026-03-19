import type { TestSiteConfigs } from "./src/types/test-sites";

const TestSites: TestSiteConfigs = {
  test: {
    startCommand:
      "/Volumes/Extra/Code/FrameworkBenchFullStack-RepPack/benchmark-runner/shell-test.sh",
    startDetectionRegex: "Starting counter",
  },
} as const;

export default TestSites;
