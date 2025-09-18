declare module "js-yaml" {
  export interface DumpOptions {
    indent?: number;
    lineWidth?: number;
    noRefs?: boolean;
    noCompatMode?: boolean;
    condenseFlow?: boolean;
    quotingType?: '"' | "'";
    forceQuotes?: boolean;
    sortKeys?: boolean | ((a: any, b: any) => number);
    replacer?: (key: string, value: any) => any;
    skipInvalid?: boolean;
    flowLevel?: number;
    styles?: { [key: string]: any };
    schema?: any;
    schemaOptions?: any;
  }

  export interface LoadOptions {
    filename?: string;
    onWarning?: (warning: any) => void;
    schema?: any;
    json?: boolean;
    strict?: boolean;
    prettyErrors?: boolean;
  }

  export function dump(obj: any, options?: DumpOptions): string;
  export function load(str: string, options?: LoadOptions): any;
  export function loadAll(
    str: string,
    iterator?: (doc: any) => void,
    options?: LoadOptions,
  ): any[];
  export function safeDump(obj: any, options?: DumpOptions): string;
  export function safeLoad(str: string, options?: LoadOptions): any;
  export function safeLoadAll(
    str: string,
    iterator?: (doc: any) => void,
    options?: LoadOptions,
  ): any[];
}
