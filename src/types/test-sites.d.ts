export type TestSiteConfigType = {
  prepare?: string;
  start: string;
  startDetectionRegex: string;
};

export type TestSiteConfigsType = Record<string, TestSiteConfigType>;
