/**
 * Database Types
 */

import { Command, StartDetectionRegex } from "./test-sites";

type DatabaseCommand = {
  command: Command;
  regex?: StartDetectionRegex;
};

type DatabaseAction = Set<DatabaseCommand | "start-db">;

export type DatabaseConfigType = {
  submoduleName: string;
  start: DatabaseCommand;
  prepare: DatabaseAction;
  reset: DatabaseAction;
  port: number;
  connectionString: string;
};
