/**
 * Minimal ambient types for `mupdf`.
 *
 * The published package uses `exports`-based resolution, which this CommonJS
 * project's classic `moduleResolution: "Node"` cannot follow. We only use the
 * small rendering surface below, so declare it locally.
 */
declare module 'mupdf' {
  export class Matrix {
    static scale(x: number, y: number): Matrix;
  }

  export class ColorSpace {
    static readonly DeviceRGB: ColorSpace;
  }

  export class Pixmap {
    asPNG(): Uint8Array;
    destroy(): void;
  }

  export class Page {
    toPixmap(matrix: Matrix, colorspace: ColorSpace, alpha?: boolean, showExtras?: boolean): Pixmap;
    destroy(): void;
  }

  export class Document {
    static openDocument(from: Buffer | ArrayBuffer | Uint8Array | string, magic?: string): Document;
    countPages(): number;
    loadPage(index: number): Page;
    destroy(): void;
  }
}
