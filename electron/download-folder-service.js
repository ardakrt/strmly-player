const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

function registerDownloadFolderHandlers({
  dialog,
  ensureConfigLoaded,
  ensureDir,
  getMainWindow,
  getMediaLibraryBaseDir,
  ipcMain,
  isSafeDownloadFolderSelection,
  queueConfigWrite,
  sendMoveProgress,
  shell,
}) {
  let pendingSelection = null;

  async function moveFileCrossDevice(srcPath, destPath) {
    try {
      await fs.promises.rename(srcPath, destPath);
    } catch (err) {
      if (err.code !== "EXDEV") throw err;
      await fs.promises.copyFile(srcPath, destPath);
      await fs.promises.unlink(srcPath);
    }
  }

  async function countFilesRecursive(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    let count = 0;
    for (const entry of entries) {
      count += entry.isDirectory()
        ? await countFilesRecursive(path.join(dir, entry.name))
        : Number(entry.isFile());
    }
    return count;
  }

  async function moveDirectoryContents(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const totalFiles = await countFilesRecursive(src);
    let filesMoved = 0;
    const moveEntry = async (entrySrc, entryDest) => {
      if (!fs.existsSync(entryDest)) fs.mkdirSync(entryDest, { recursive: true });
      const entries = await fs.promises.readdir(entrySrc, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(entrySrc, entry.name);
        const destPath = path.join(entryDest, entry.name);
        if (entry.isDirectory()) {
          await moveEntry(srcPath, destPath);
          try {
            fs.rmdirSync(srcPath);
          } catch {}
          continue;
        }
        if (!entry.isFile()) continue;
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch {}
        }
        await moveFileCrossDevice(srcPath, destPath);
        filesMoved += 1;
        sendMoveProgress({
          progress:
            totalFiles > 0
              ? Math.min(100, Math.round((filesMoved / totalFiles) * 100))
              : 0,
          currentFile: entry.name,
          filesMoved,
          totalFiles,
        });
      }
    };
    await moveEntry(src, dest);
  }

  ipcMain.handle("open-downloads-folder", async () => {
    try {
      await ensureConfigLoaded();
      const downloadsDir = ensureDir(getMediaLibraryBaseDir());
      await shell.openPath(downloadsDir);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("select-downloads-folder", async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      pendingSelection = null;
      return { canceled: true };
    }
    pendingSelection = {
      token: randomUUID(),
      folderPath: path.resolve(result.filePaths[0]),
    };
    return {
      canceled: false,
      filePath: pendingSelection.folderPath,
      selectionToken: pendingSelection.token,
    };
  });

  ipcMain.handle(
    "set-downloads-folder",
    async (_event, { folderPath, moveExisting, selectionToken }) => {
      try {
        const selectedFolder = pendingSelection;
        pendingSelection = null;
        if (
          !isSafeDownloadFolderSelection(
            folderPath,
            selectionToken,
            selectedFolder,
          )
        ) {
          return {
            success: false,
            error: "Invalid download folder selection",
          };
        }
        const config = await ensureConfigLoaded();
        const oldPath = getMediaLibraryBaseDir();
        const newPath = path.resolve(folderPath);
        if (oldPath === newPath) return { success: true };
        if (moveExisting && fs.existsSync(oldPath)) {
          sendMoveProgress({
            progress: 0,
            currentFile: "",
            filesMoved: 0,
            totalFiles: 0,
          });
          await moveDirectoryContents(oldPath, newPath);
          sendMoveProgress({
            progress: 100,
            currentFile: "",
            filesMoved: 0,
            totalFiles: 0,
          });
        }
        config.customDownloadsPath = newPath;
        await queueConfigWrite();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("get-downloads-folder", async () => {
    await ensureConfigLoaded();
    return getMediaLibraryBaseDir();
  });
}

module.exports = { registerDownloadFolderHandlers };
