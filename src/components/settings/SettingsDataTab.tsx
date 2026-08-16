import {
  PageHeader,
  SettingRow,
  StatBox,
  dangerButton,
  secondaryButton,
} from "../SettingsControls";

interface SettingsDataTabProps {
  language: "tr" | "en";
  t: (key: string) => string;
  watchHistoryCount: number;
  favoritesCount: number;
  totalContent: number;
  onClearRecentlyWatched: () => void;
  onClearFavorites: () => void;
  onExportSettings: () => void;
  onImportSettings: (file?: File) => void;
}

export function SettingsDataTab({
  language,
  t,
  watchHistoryCount,
  favoritesCount,
  totalContent,
  onClearRecentlyWatched,
  onClearFavorites,
  onExportSettings,
  onImportSettings,
}: SettingsDataTabProps) {
  return (
    <>
      <PageHeader title={language === "tr" ? "Veri Yönetimi" : "Data Management"} description={t("settings.details.dataPage")} />
      <div className="mb-5 grid gap-3.5 sm:grid-cols-3">
        <StatBox label={language === "tr" ? "İzleme Geçmişi" : "Watch History"} value={watchHistoryCount} />
        <StatBox label={language === "tr" ? "Favorilerim" : "Favorites"} value={favoritesCount} />
        <StatBox label={language === "tr" ? "Toplam İçerik" : "Total Content"} value={totalContent} />
      </div>
      <div>
        <SettingRow title={language === "tr" ? "İzleme Geçmişi" : "Watch History"} description={t("settings.details.history")}>
          <button type="button" className={dangerButton} onClick={onClearRecentlyWatched}>{language === "tr" ? "Geçmişi Temizle" : "Clear History"}</button>
        </SettingRow>
        <SettingRow title={language === "tr" ? "Favorilerim" : "Favorites"} description={t("settings.details.favorites")}>
          <button type="button" className={dangerButton} onClick={onClearFavorites}>{language === "tr" ? "Favorileri Temizle" : "Clear Favorites"}</button>
        </SettingRow>
        <SettingRow title={language === "tr" ? "Yerel Ayar Yedekleme" : "Local Settings Backup"} description={t("settings.details.backup")}>
          <div className="flex items-center gap-2">
            <button type="button" className={secondaryButton} onClick={onExportSettings}>{language === "tr" ? "Yedeği Dışa Aktar" : "Export Backup"}</button>
            <label className={secondaryButton}>
              {language === "tr" ? "Yedeği İçe Aktar" : "Import Backup"}
              <input type="file" accept=".json" className="hidden" onChange={(event) => onImportSettings(event.target.files?.[0])} />
            </label>
          </div>
        </SettingRow>
      </div>
    </>
  );
}
