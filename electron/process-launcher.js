const { spawn } = require("child_process");

function spawnDetached(command, args, spawnImpl = spawn) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    try {
      child = spawnImpl(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (error) {
      resolve({ success: false, error });
      return;
    }
    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ success: true });
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      resolve({ success: false, error });
    });
  });
}

module.exports = { spawnDetached };
