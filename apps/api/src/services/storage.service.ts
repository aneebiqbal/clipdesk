import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { config } from "../lib/config";

/** Storage abstraction so a future S3 implementation can replace the local driver. */
export interface Storage {
  readonly root: string;
  resolve(rel: string): string;
  exists(rel: string): boolean;
  ensureDir(rel: string): Promise<void>;
  write(rel: string, data: Buffer | Readable): Promise<void>;
  delete(rel: string): Promise<void>;
  removeDir(rel: string): Promise<void>;
  stat(rel: string): Promise<fs.Stats>;
}

export class LocalStorage implements Storage {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  resolve(rel: string): string {
    const abs = path.resolve(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new Error(`Path escapes storage root: ${rel}`);
    }
    return abs;
  }

  exists(rel: string): boolean {
    return fs.existsSync(this.resolve(rel));
  }

  async ensureDir(rel: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.resolve(rel)), { recursive: true });
  }

  async write(rel: string, data: Buffer | Readable): Promise<void> {
    const abs = this.resolve(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(abs, data);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(abs);
      data.on("error", reject);
      ws.on("error", reject);
      ws.on("finish", () => resolve());
      data.pipe(ws);
    });
  }

  async delete(rel: string): Promise<void> {
    await fs.promises.rm(this.resolve(rel), { force: true });
  }

  async removeDir(rel: string): Promise<void> {
    await fs.promises.rm(this.resolve(rel), { recursive: true, force: true });
  }

  async stat(rel: string): Promise<fs.Stats> {
    return fs.promises.stat(this.resolve(rel));
  }
}

export const storage = new LocalStorage(config.OUTPUT_DIR);
export const uploadStorage = new LocalStorage(config.UPLOAD_DIR);
