import React, { lazy, Suspense } from 'react';

const ProfileScreen = lazy(() => import('./ProfileScreen').then(m => ({ default: m.ProfileScreen })));

interface ProfileScreenWrapperProps {
  profilesHook: any;
  isParsing: boolean;
  toast: { show: boolean; message: string };
  activeTheme: string;
  accentStyles: React.CSSProperties;
}

export function ProfileScreenWrapper({
  profilesHook,
  isParsing,
  toast,
  activeTheme,
  accentStyles
}: ProfileScreenWrapperProps) {
  return (
    <Suspense fallback={null}>
      <ProfileScreen
        profiles={profilesHook.profiles}
        profileSelectMode={profilesHook.profileSelectMode}
        profileFormName={profilesHook.profileFormName}
        profileFormAvatar={profilesHook.profileFormAvatar}
        profileContentPreferences={profilesHook.profileContentPreferences}
        editingProfileId={profilesHook.editingProfileId}
        profilePlaylistType={profilesHook.profilePlaylistType}
        profileM3uUrl={profilesHook.profileM3uUrl}
        profileXtreamUrl={profilesHook.profileXtreamUrl}
        profileXtreamUser={profilesHook.profileXtreamUser}
        profileXtreamPass={profilesHook.profileXtreamPass}
        profileAutoUpdateIntervalHours={profilesHook.profileAutoUpdateIntervalHours}
        avatarSearchQuery={profilesHook.avatarSearchQuery}
        avatarSearchResults={profilesHook.avatarSearchResults}
        avatarSearchLoading={profilesHook.avatarSearchLoading}
        trendingAvatars={profilesHook.trendingAvatars}
        localSeries={profilesHook.localSeries}
        selectedSeriesForCast={profilesHook.selectedSeriesForCast}
        seriesCast={profilesHook.seriesCast}
        castLoading={profilesHook.castLoading}
        isParsing={isParsing}
        profileSetupStatus={profilesHook.profileSetupStatus}
        profileEntryReady={profilesHook.profileEntryReady}
        toast={toast}
        activeTheme={activeTheme}
        accentStyles={accentStyles}
        setProfileSelectMode={profilesHook.setProfileSelectMode}
        setProfileFormName={profilesHook.setProfileFormName}
        setProfileFormAvatar={profilesHook.setProfileFormAvatar}
        setProfileContentPreferences={profilesHook.setProfileContentPreferences}
        setEditingProfileId={profilesHook.setEditingProfileId}
        setProfilePlaylistType={profilesHook.setProfilePlaylistType}
        setProfileM3uUrl={profilesHook.setProfileM3uUrl}
        setProfileXtreamUrl={profilesHook.setProfileXtreamUrl}
        setProfileXtreamUser={profilesHook.setProfileXtreamUser}
        setProfileXtreamPass={profilesHook.setProfileXtreamPass}
        setProfileAutoUpdateIntervalHours={profilesHook.setProfileAutoUpdateIntervalHours}
        setAvatarSearchQuery={profilesHook.setAvatarSearchQuery}
        setAvatarSearchResults={profilesHook.setAvatarSearchResults}
        setSelectedSeriesForCast={profilesHook.setSelectedSeriesForCast}
        setSeriesCast={profilesHook.setSeriesCast}
        onSelectProfile={profilesHook.handleSelectProfile}
        onSaveProfile={profilesHook.handleSaveProfile}
        onDeleteProfile={profilesHook.handleDeleteProfile}
        onAvatarSearch={profilesHook.handleAvatarSearch}
        onFetchSeriesCast={profilesHook.handleFetchSeriesCast}
      />
    </Suspense>
  );
}
