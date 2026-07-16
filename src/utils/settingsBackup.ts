export interface PreparedSettingsBackup {
  localEntries: Record<string, string>;
  diskEntries: Record<string, unknown>;
}

export function prepareSettingsImport(value: unknown): PreparedSettingsBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid settings backup');
  }

  const localEntries: Record<string, string> = {};
  const diskEntries: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      !/^[a-zA-Z0-9_-]+$/.test(key) ||
      key.length > 160
    ) {
      throw new Error(`Invalid settings key: ${key}`);
    }
    const serialized = String(rawValue);
    localEntries[key] = serialized;
    try {
      diskEntries[key] = JSON.parse(serialized);
    } catch {
      diskEntries[key] = serialized;
    }
  }
  return { localEntries, diskEntries };
}
