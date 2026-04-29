export type TestSiteConfig = {
  prepare?: string;
  start: string;
  startDetectionRegex: string;
  environmentVariables: {
    portIdentifier: string;
    prepare?: { [key: string]: string };
    start?: { [key: string]: string };
  };
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
