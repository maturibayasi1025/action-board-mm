declare module "js-yaml" {
  export interface Schema {
    name: string;
    explicit: unknown[];
    implicit: unknown[];
    fallback: unknown[];
  }

  export interface YAMLError extends Error {
    reason: string;
    mark?: {
      name: string | null;
      buffer: string;
      position: number;
      line: number;
      column: number;
    };
  }

  export interface DumpOptions {
    indent?: number;
    lineWidth?: number;
    noRefs?: boolean;
    noCompatMode?: boolean;
    condenseFlow?: boolean;
    quotingType?: '"' | "'";
    forceQuotes?: boolean;
    sortKeys?: boolean | ((a: string, b: string) => number);
    replacer?: (key: string, value: unknown) => unknown;
    skipInvalid?: boolean;
    flowLevel?: number;
    styles?: { [key: string]: unknown };
    schema?: Schema;
    schemaOptions?: Record<string, unknown>;
  }

  export interface LoadOptions {
    filename?: string;
    onWarning?: (warning: YAMLError) => void;
    schema?: Schema;
    json?: boolean;
    strict?: boolean;
    prettyErrors?: boolean;
  }

  export function dump(obj: unknown, options?: DumpOptions): string;
  export function load(str: string, options?: LoadOptions): unknown;
  export function loadAll(
    str: string,
    iterator?: (doc: unknown) => void,
    options?: LoadOptions,
  ): unknown[];
  export function safeDump(obj: unknown, options?: DumpOptions): string;
  export function safeLoad(str: string, options?: LoadOptions): unknown;
  export function safeLoadAll(
    str: string,
    iterator?: (doc: unknown) => void,
    options?: LoadOptions,
  ): unknown[];
}
