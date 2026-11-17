import "dotenv/config";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// The monorepo keeps one .env at the repository root, while scripts run from apps/api.
loadDotenv({ path: path.resolve(__dirname, "../../../../.env") });


const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8765),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  UPLOAD_DIR: z.string().min(1),
  OUTPUT_DIR: z.string().min(1),
  WORK_DIR: z.string().min(1),
  PYTHON_PATH: z.string().min(1).default("python"),
  GEMINI_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema>;

function load(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  // Resolve storage paths against the API package directory so they are stable
  // regardless of the process working directory.
  const base = path.resolve(__dirname, "../..");
  const absolute = (value: string): string =>
    path.isAbsolute(value) ? value : path.resolve(base, value);
  return {
    ...parsed.data,
    UPLOAD_DIR: absolute(parsed.data.UPLOAD_DIR),
    OUTPUT_DIR: absolute(parsed.data.OUTPUT_DIR),
    WORK_DIR: absolute(parsed.data.WORK_DIR),
  };
}

export const config = load();
