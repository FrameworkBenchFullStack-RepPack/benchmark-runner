export type PathBasedString = (projectPath: string) => string;

type CommandConfig = {
  command: string;
  environment?: Record<string, string | PathBasedString>;
  modifyWorkingPath?: PathBasedString;
};

export class Command {
  command: string;
  private environment?: Record<string, string | PathBasedString>;
  private modifyWorkingPath?: PathBasedString;

  constructor(config: CommandConfig) {
    this.command = config.command;
    this.environment = config.environment;
    this.modifyWorkingPath = config.modifyWorkingPath;
  }

  env(path: string) {
    if (!this.environment) return;

    const transformed: Record<string, string> = {};
    for (const [key, val] of Object.entries(this.environment)) {
      transformed[key] = typeof val === "string" ? val : val(path);
    }

    return transformed;
  }

  workingPath(path: string) {
    return this.modifyWorkingPath?.(path) ?? path;
  }
}

export type OutputChannel = "stdout" | "stderr";
export type StartDetectionRegex = {
  regex: string;
  channel: OutputChannel;
};

export type TestSiteConfig = {
  portIdentifier: string;
  start: Command;
  startDetectionRegex: StartDetectionRegex;
  prepare?: Command | Command[];
};

export type TestSiteConfigs = Record<string, TestSiteConfig>;
