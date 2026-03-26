type ConfigStep = {
  command: string;
  regex: string;
};

export type DatabaseConfigType =
  | {
      submoduleName: string;
      prepare: ConfigStep;
      start: ConfigStep;
      reset: ConfigStep;
      connectionString: string;
    }
  | undefined;
