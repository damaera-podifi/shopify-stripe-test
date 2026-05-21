import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export function dataFilePath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readJsonFile<T>(filename: string): Promise<T> {
  await ensureDataDir();
  const filePath = dataFilePath(filename);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(`Missing data file: data/${filename}`);
    }
    throw error;
  }
}

export async function readJsonFileOrDefault<T>(
  filename: string,
  defaultValue: T,
): Promise<T> {
  await ensureDataDir();
  const filePath = dataFilePath(filename);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return defaultValue;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(
  filename: string,
  data: T,
): Promise<void> {
  await ensureDataDir();
  const filePath = dataFilePath(filename);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
