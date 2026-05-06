import { readFileSync } from "fs";
import { resolve } from "path";

// Load root .env so integration tests that need DATABASE_URL can connect.
// Only sets variables not already present in the environment.
try {
  const env = readFileSync(resolve(__dirname, "../../.env"), "utf-8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^#\s][^=]*)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
} catch {
  // no .env file present, skip
}
