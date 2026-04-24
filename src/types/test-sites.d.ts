export type TestSiteConfig = {
  prepare?: string;
  start: string;
  startDetectionRegex: string;
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
