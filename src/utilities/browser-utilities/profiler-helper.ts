import { Driver } from "selenium-webdriver/firefox";
import { runScriptInChrome, runScriptInChromeAsync } from "./script-runners";

export enum ProfilerFeatures {
  "Native Stack" = "stackwalk",
  "JavaScript" = "js",
  "Cpu Utilization" = "cpu",
  "Memory Tracking" = "memory",
  "No Periodic Sampling" = "nostacksampling",
  "Main Thread File IO" = "mainthreadio",
  "All File IO" = "fileioall",
  "No Marker Stacks" = "nomarkerstacks",
  "Sequential Styling" = "seqstyle",
  "Screenshots" = "screenshots",
  "IPC Messages" = "ipcmessages",
  "JS Allocations" = "jsallocations",
  "Audio Callback Testing" = "audiocallbacktracing",
  "Network Bandwidth" = "bandwidth",
  "Sandbox Profiling" = "sandbox",
  "Flows" = "flows",
  "CPU Utilization - All Threads" = "cpuallthreads",
  "Periodic Sampling - All Threads" = "samplingallthreads",
  "Markers - All Threads" = "markersallthreads",
  "Unregistered Threads" = "unregisteredthreads",
  "Process CPU Utilization" = "processcpu",
  "Power Use" = "power",
  "JS Execution Tracing" = "tracing",
}

export enum ProfilerThreads {
  "GeckoMain" = "GeckoMain",
  "Compositor" = "Compositor",
  "DOM Worker" = "DOM Worker",
  "Renderer" = "Renderer",
  "RendererBackend" = "RendererBackend",
  "Timer" = "Timer",
  "StyleThread" = "StyleThread",
  "Socket Thread" = "Socket Thread",
  "StreamTrans" = "StreamTrans",
  "ImgDecoder" = "ImgDecoder",
  "DNS Resolver" = "DNS Resolver",
  "TaskController" = "TaskController",
}

export type ProfilerOptions = {
  entries: number;
  interval: number;
  features: ProfilerFeatures[];
  threads: ProfilerThreads[];
};

export default class ProfilerHandler {
  #driver: Driver;

  constructor(driver: Driver) {
    this.#driver = driver;
  }

  #startScript(options: ProfilerOptions): string {
    const featuresArray = `[${options.features
      .map((feature) => `"${feature}"`)
      .join(", ")}]`;
    const threadsArray = `[${options.threads
      .map((thread) => `"${thread}"`)
      .join(", ")}]`;

    return `
      return Services.profiler.StartProfiler(
          ${options.entries},
          ${options.interval},
          ${featuresArray},
          ${threadsArray}
        );
    `;
  }

  #pauseScript(): string {
    return `return Services.profiler.Pause();`;
  }

  #collectDataScript(filePath: string): string {
    // The last argument passed in the 'arguments' list is a callback
    // function to indicate that the async execution has finished.
    return `return Services.profiler.dumpProfileToFileAsync("${filePath}");`;
  }

  #endScript(): string {
    return `return Services.profiler.StopProfiler();`;
  }

  async start(options: ProfilerOptions) {
    console.log(this.#startScript(options));
    await runScriptInChrome(
      "PROFILER-START",
      this.#driver,
      this.#startScript(options),
    );
  }

  async end(filePath: string) {
    await runScriptInChrome(
      "PROFILER-PAUSE",
      this.#driver,
      this.#pauseScript(),
    );

    await runScriptInChrome(
      "PROFILER-COLLECT-DATA",
      this.#driver,
      this.#collectDataScript(filePath),
    );

    await runScriptInChrome("PROFILER-END", this.#driver, this.#endScript());
  }
}
