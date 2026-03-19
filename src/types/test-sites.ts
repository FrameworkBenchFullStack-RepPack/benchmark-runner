export type TestSiteConfig = {
  startCommand: string;
  startDetectionRegex: string;
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
