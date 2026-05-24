declare module "heic-convert" {
  type HeicConvertInput =
    | Buffer
    | ArrayBuffer
    | Uint8Array
    | Uint8ClampedArray;

  interface HeicConvertOptions {
    buffer: HeicConvertInput;
    format: "JPEG" | "PNG";
    quality?: number;
  }

  function convert(options: HeicConvertOptions): Promise<ArrayBuffer>;

  export = convert;
}
