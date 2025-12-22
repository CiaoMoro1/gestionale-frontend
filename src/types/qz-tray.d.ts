declare module "qz-tray" {
  export type QZRawData = {
    type: "raw";
    format?: "command" | "pdf" | "image" | "html";
    data: string;
  };

  export type QZConfig = unknown;

  export interface QZWebsocket {
    isActive(): boolean;
    connect(options?: {
      usingSecure?: boolean;
      host?: string | string[];
      port?: { secure?: number[]; insecure?: number[] };
      keepAlive?: number;
      retries?: number;
      delay?: number;
    }): Promise<void>;
    disconnect(): Promise<void>;
  }

  export interface QZSecurity {
    setCertificatePromise(
      promiseHandler: (() => Promise<string>) | ((resolve: (cert: string | null) => void, reject: (err: unknown) => void) => void),
      options?: { rejectOnFailure?: boolean },
    ): void;

    setSignaturePromise(promiseFactory: (toSign: string) => Promise<string>): void;

    setSignatureAlgorithm(algorithm: "SHA1" | "SHA256" | "SHA512"): void;
  }

  export interface QZPrinters {
    getDefault(signature?: string, signingTimestamp?: number): Promise<string>;
    find(query?: string, signature?: string, signingTimestamp?: number): Promise<string | string[]>;
  }

  export interface QZConfigs {
    create(printer: string, options?: Record<string, unknown>): QZConfig;
  }

  export interface QZTray {
    websocket: QZWebsocket;
    security: QZSecurity;
    printers: QZPrinters;
    configs: QZConfigs;

    print(cfg: QZConfig, data: QZRawData[]): Promise<void>;
  }

  const qz: QZTray;
  export default qz;
}
