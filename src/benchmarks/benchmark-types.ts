import { BuilderOptions } from "../utilities/browser-utilities/driver-builder";
import { ProfilerOptions } from "../utilities/browser-utilities/profiler-helper";

type BenchmarkInput = {
  framework: string;
  iteration: number;
  warmupRound: number;
  resultsPath: string;
  link: string;
  profilerOptions: ProfilerOptions;
  driverOptions?: BuilderOptions;
  setResultPath: {
    server: (path: string) => void;
    database?: (path: string) => void;
  };
  startMeasurement: {
    server: () => void;
    database?: () => void;
  };
  stopMeasurement: {
    server: () => void;
    database?: () => void;
  };
};

export default BenchmarkInput;
