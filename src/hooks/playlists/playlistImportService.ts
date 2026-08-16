import { DEFAULT_AUTO_UPDATE_INTERVAL_HOURS } from "../../constants";
import type { SavedPlaylist } from "../../types";
import { parseM3UAsync } from "../../utils/m3uParser";
import type { Language } from "../../utils/translations";
import { getCacheBustedUrl } from "./playlistHelpers";

export interface ParsedPlaylistImport {
  items: Awaited<ReturnType<typeof parseM3UAsync>>["items"];
  groups: string[];
  revision?: string;
}

export async function fetchPlaylistImport(
  url: string,
  language: Language,
): Promise<ParsedPlaylistImport> {
  const response = await fetch(getCacheBustedUrl(url), {
    cache: "no-store",
    headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" },
  });
  if (!response.ok) {
    throw new Error(
      language === "tr"
        ? `HTTP Hatası: ${response.status}`
        : `HTTP Error: ${response.status}`,
    );
  }
  return parsePlaylistImport(await response.arrayBuffer(), language);
}

export async function parsePlaylistImport(
  data: ArrayBuffer,
  language: Language,
): Promise<ParsedPlaylistImport> {
  const parsed = await parseM3UAsync(data);
  if (parsed.items.length === 0) {
    throw new Error(
      language === "tr"
        ? "Çözümlenebilir kanal bulunamadı!"
        : "No playable channels found!",
    );
  }
  return {
    items: parsed.items,
    groups: parsed.groups,
    revision: parsed.revision,
  };
}

interface ImportedPlaylistOptions {
  name: string;
  parsed: ParsedPlaylistImport;
  mode?: "m3u" | "xtream";
  url?: string;
  xtream?: {
    url: string;
    user: string;
    pass: string;
  };
}

export function createImportedPlaylist({
  name,
  parsed,
  mode,
  url,
  xtream,
}: ImportedPlaylistOptions): SavedPlaylist {
  return {
    id: Date.now().toString(),
    name,
    channelCount: parsed.items.length,
    groupCount: parsed.groups.length,
    groups: parsed.groups,
    playlistMode: mode,
    url,
    xtreamUrl: xtream?.url,
    xtreamUser: xtream?.user,
    xtreamPass: xtream?.pass,
    autoUpdateIntervalHours: DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
    lastAutoUpdatedAt: Date.now(),
    contentRevision: parsed.revision,
  };
}
