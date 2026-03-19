export const MessageType = {
  Ready: 0,
  Start: 1,
  Stop: 2,
  SetOutputPath: 3,
  Terminate: 4,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

type DefaultMessage<T> = {
  type: MessageType;
  payload?: T;
};

export type MessageStructures = {
  [MessageType.Ready]: [DefaultMessage<{ message: string }>, null];
  [MessageType.Start]: [DefaultMessage<null>, null];
  [MessageType.Stop]: [DefaultMessage<null>, null];
  [MessageType.SetOutputPath]: [DefaultMessage<{ path: string }>, null];
  [MessageType.Terminate]: [DefaultMessage<null>, null];
};

export type WorkerData = {
  processMeasurementExecutable: string;
  measurementInterval: number;
  serverCommand: string;
  startDetectionRegex: string;
  serverPort: number;
};

/**
 * JSON formatted messages
 */

export const ProcessMessageTypes = {
  measurement_ready: "measurement_ready",
  measurement_start: "measurement_start",
  measurement_stop: "measurement_stop",
  set_output_path: "set_output_path",
  terminate: "terminate",
} as const;
export type ProcessMessageType =
  (typeof ProcessMessageTypes)[keyof typeof ProcessMessageTypes];

type ProcessMessagePayload = {
  [ProcessMessageTypes.measurement_ready]: null;
  [ProcessMessageTypes.measurement_start]: null;
  [ProcessMessageTypes.measurement_stop]: null;
  [ProcessMessageTypes.set_output_path]: {
    path: string;
  };
  [ProcessMessageTypes.terminate]: null;
};

export type ProcessMessage<T extends ProcessMessageType = ProcessMessageType> =
  {
    [K in T]: ProcessMessagePayload[K] extends null
      ? { type: K }
      : { type: K; payload: ProcessMessagePayload[K] };
  }[T];

export function checkIncomingJson(input: unknown): input is ProcessMessage {
  if (
    !(typeof input === "object") ||
    input === null ||
    !("type" in input) ||
    typeof input.type !== "string"
  )
    return false;

  switch (input.type) {
    case ProcessMessageTypes.measurement_ready:
      return true;
  }

  return false;
}
