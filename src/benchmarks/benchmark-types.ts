import { BuilderOptions } from "../utilities/browser-utilities/driver-builder";
import { ProfilerOptions } from "../utilities/browser-utilities/profiler-helper";

type BenchmarkInput = {
  framework: string;
  repetition: number;
  resultsPath: string;
  link: string;
  profilerOptions: ProfilerOptions;
  driverOptions?: BuilderOptions;
  setServerResultPath: (path: string) => void;
  startServerMeasurement: () => void;
  stopServerMeasurement: () => void;
};

export default BenchmarkInput;
