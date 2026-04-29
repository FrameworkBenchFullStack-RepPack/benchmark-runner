export type TestSiteConfig = {
  prepare?: string;
  start: string;
  startDetectionRegex: string;
  environmentVariables?: Record<string, string>;
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
