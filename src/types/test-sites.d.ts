export type Command = {
  command: string;
  modifyWorkingPath?: (projectPath: string) => string;
};

export type TestSiteConfig = {
  prepare?: Command | Command[];
  start: Command;
  startDetectionRegex: string;
  environmentVariables: {
    portIdentifier: string;
    prepare?: { [key: string]: string };
    start?: { [key: string]: string };
  };
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
