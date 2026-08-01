function hasXtreamCredentials(playlist) {
  return Boolean(
    playlist &&
    typeof playlist.xtreamUrl === "string" && playlist.xtreamUrl.trim() &&
    typeof playlist.xtreamUser === "string" && playlist.xtreamUser.trim() &&
    typeof playlist.xtreamPass === "string" && playlist.xtreamPass.trim(),
  );
}

function normalizePlaylistName(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+xtream\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCandidateScore(target, candidate) {
  let score = 0;
  if (String(target.id || "") === String(candidate.id || "")) score += 100;

  const targetName = normalizePlaylistName(target.name);
  const candidateName = normalizePlaylistName(candidate.name);
  if (targetName && targetName === candidateName) score += 40;

  const targetGroups = Number(target.groupCount);
  const candidateGroups = Number(candidate.groupCount);
  if (targetGroups > 0 && targetGroups === candidateGroups) score += 20;

  const targetChannels = Number(target.channelCount);
  const candidateChannels = Number(candidate.channelCount);
  const tolerance = Math.max(10, Math.round(targetChannels * 0.05));
  if (
    targetChannels > 0 &&
    candidateChannels > 0 &&
    Math.abs(targetChannels - candidateChannels) <= tolerance
  ) {
    score += 10;
  }

  return score;
}

function recoverXtreamCredentials(config, profileId, playlistId) {
  const targetKey = `profile_${profileId}_cinema_playlists`;
  const targetPlaylists = config[targetKey];
  if (!Array.isArray(targetPlaylists)) return null;

  const targetIndex = targetPlaylists.findIndex(
    (playlist) => String(playlist?.id || "") === String(playlistId),
  );
  if (targetIndex < 0) return null;

  const target = targetPlaylists[targetIndex];
  if (hasXtreamCredentials(target)) return target;
  if (target?.playlistMode !== "xtream") return null;

  const candidates = [];
  for (const [key, value] of Object.entries(config)) {
    if (!/^profile_[a-zA-Z0-9_-]+_cinema_playlists$/.test(key) || !Array.isArray(value)) {
      continue;
    }
    for (const playlist of value) {
      if (!hasXtreamCredentials(playlist)) continue;
      candidates.push({ playlist, score: getCandidateScore(target, playlist) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 40 || (candidates[1] && candidates[1].score === best.score)) {
    return null;
  }

  const repaired = {
    ...target,
    xtreamUrl: best.playlist.xtreamUrl.trim(),
    xtreamUser: best.playlist.xtreamUser.trim(),
    xtreamPass: best.playlist.xtreamPass.trim(),
  };
  config[targetKey] = targetPlaylists.map((playlist, index) => (
    index === targetIndex ? repaired : playlist
  ));
  return repaired;
}

module.exports = {
  hasXtreamCredentials,
  recoverXtreamCredentials,
};
