// settings.js: a mod's preferences from the `settings` key of its installed
// mod.json, merged over the defaults its code ships with. Herdr reloads the
// mod when that file is saved, so an edit applies at once. Unknown keys and
// values of the wrong type are reported, never fatal. Shared byte for byte
// between the mods in this repository.
import { readTextFile, appHome } from "herdr";

const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 };
// "450ms", "60s", "5m", or a plain number of milliseconds. Zero falls back,
// since these values pace timers.
export function duration(value, fallback) {
  if (typeof value === "number") return value > 0 ? value : fallback;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h)\s*$/.exec(String(value ?? ""));
  return (match && Math.round(Number(match[1]) * UNITS[match[2]])) || fallback;
}

const SIZES = { B: 1, KB: 1024, MB: 1024 * 1024 };
// "60KB", "2MB", or a plain number of bytes.
export function size(value, fallback) {
  if (typeof value === "number" && value >= 0) return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB)\s*$/i.exec(String(value ?? ""));
  return match ? Math.round(Number(match[1]) * SIZES[match[2].toUpperCase()]) : fallback;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Deep-merge `given` over `defaults`. The defaults define the keys and their
// types; a duration or size default is a string, and a number is accepted for
// it. Anything else that does not fit is skipped and named in `problems`.
export function mergeSettings(defaults, given, problems = [], path = "") {
  const result = { ...defaults };
  if (!isObject(given)) {
    if (given !== undefined) problems.push(`${path || "settings"} must be an object`);
    return result;
  }
  for (const [key, value] of Object.entries(given)) {
    const name = path ? `${path}.${key}` : key;
    if (!(key in defaults)) {
      problems.push(`${name} is not a setting`);
      continue;
    }
    const current = defaults[key];
    if (isObject(current)) result[key] = mergeSettings(current, value, problems, name);
    else if (typeof value === typeof current || (typeof current === "string" && typeof value === "number"))
      result[key] = value;
    else problems.push(`${name} should be a ${typeof current}`);
  }
  return result;
}

// The merged settings for `name` plus a list of problems to show the person.
export async function loadSettings(name, defaults) {
  const problems = [];
  let given = {};
  try {
    const raw = await readTextFile(`${appHome()}/mods/${name}/mod.json`);
    given = JSON.parse(raw ?? "{}").settings ?? {};
  } catch (e) {
    problems.push(`mod.json could not be read: ${e.message}`);
  }
  return { settings: mergeSettings(defaults, given, problems), problems };
}
