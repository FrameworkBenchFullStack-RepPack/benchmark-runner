export const LOG_LEVELS = ["debug", "info", "warning", "error", "off"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && LOG_LEVELS.includes(value as LogLevel);
}

const LogLevelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  off: 4,
};

type EmittableLogLevel = Exclude<LogLevel, "off">;

class Logger {
  static #level: LogLevel = "error";

  static set level(level: LogLevel) {
    this.#level = level;
  }

  static log(messageLevel: EmittableLogLevel, ...content: any[]) {
    if (this.#level === "off") return;

    if (
      messageLevel !== "info" &&
      LogLevelOrder[messageLevel] < LogLevelOrder[this.#level]
    )
      return;

    console.log(`[${messageLevel}] `, ...content);
  }
}

export default Logger;
