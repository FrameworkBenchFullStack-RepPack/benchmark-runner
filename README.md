# Benchmark Runner

A CLI tool for running performance-based benchmarks in the Firefox Browser using Selenium and the Firefox Profiler.

## Setup

### 1. Clone the Repository

To clone the repository run the following git command:

```bash
git clone https://github.com/FrameworkBenchFullStack-RepPack/benchmark-runner.git
cd ./benchmark-runner
```

### 2. Configure the Project

After cloning, initialize and install dependencies:

```bash
git submodule update --init --remote --merge
npm install
```

### 3. (Optional) Obtain an executable of process-energy-measurement

To enable energy measurement of the server process, an executable of process-energy-measurement must be provided. To obtain one, follow the guide in the [process-energy-measurement repository](https://github.com/FrameworkBenchFullStack-RepPack/process-energy-measurement).

## Running the Benchmark Runner

The project provides a single script:

```bash
npm run bm
```

To view available options and usage details, run:

```bash
npm run bm -- --help
```

This outputs the following:

```
> benchmark-runner@2.0.0 bm
> tsx src/index.ts --help

Usage: Benchmark Runner [options]

A CLI for running performance focused benchmarks in the Firefox browser, using selenium

Options:
  -V, --version                        output the version number
  -p, --port                           specify port used for serving the websites
  -d, --debug                          launch browser instances with debugger
  --entries <entries>                  specify the buffer size used in the profiler (default: "20000000")
  --interval <interval>                specify the profiler logging interval (ms) (default: "100")
  --features <features...>             specify the logged features. Available features: stackwalk, js, cpu, memory, nostacksampling, mainthreadio, fileioall, nomarkerstacks, seqstyle,
                                       screenshots, ipcmessages, jsallocations, audiocallbacktracing, bandwidth, sandbox, flows, cpuallthreads, samplingallthreads, markersallthreads,
                                       unregisteredthreads, processcpu, power, tracing (default: ["power","bandwidth"])
  --threads <threads...>               specify the logged threads. Available threads: GeckoMain, Compositor, DOM Worker, Renderer, RendererBackend, Timer, StyleThread, Socket Thread,
                                       StreamTrans, ImgDecoder, DNS Resolver, TaskController (default: ["GeckoMain"])
  --repetitions <repetitions...>       specify the number of test repetitions (default: "1")
  --benchmarks <benchmarks...>         specify the benchmarks. Available benchmarks: navigate-all-pages, navigate-static, subpage-faq, subpage-home, subpage-list, subpage-live,
                                       subpage-tooltips
  --test-sites <test-sites...>         specify the test-sites. Available test-sites: test
  --process-energy-measurement <path>  path to the process-energy-measurement executable. Enables measuring the server process
  -h, --help                           display help for command
```

## License

This project is licensed under the [MIT License](https://github.com/FrameworkBench-RepPack/benchmark-runner/blob/main/LICENSE).
