/* Hallmark · genre: atmospheric · macrostructure: Marquee Hero / Focus Stage · theme: Midnight (runtime accent) · nav: N9 edge-aligned · footer: none (app surface) */
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5 */
import { useEffect, useState, useCallback } from 'react';
import { Trash2, Pencil, ArrowUpRight } from 'lucide-react';
import type { Profile } from '../types';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { CreateProfileWizard } from './CreateProfileWizard';
import { useSettings } from '../context/SettingsContext';
import { DeleteProfileDialog } from './profile/DeleteProfileDialog';
import { ProfileSelectionStage } from './profile/ProfileSelectionStage';
import { EditProfileDialog } from './profile/EditProfileDialog';
import { ProfileEntryOverlay } from './profile/ProfileEntryOverlay';
import type { ProfileScreenProps } from './profile/profileScreenTypes';

export const ProfileScreen = (props: ProfileScreenProps) => {
  const {
    profiles, profileSelectMode, profileFormName, profileFormAvatar, profileContentPreferences,
    editingProfileId, profilePlaylistType, profileM3uUrl, profileXtreamUrl,
    profileXtreamUser, profileXtreamPass, profileAutoUpdateIntervalHours, avatarSearchQuery, avatarSearchResults,
    avatarSearchLoading, localSeries, selectedSeriesForCast,
    seriesCast, castLoading, isParsing, profileSetupStatus, profileEntryReady, toast, activeTheme, accentStyles,
    setProfileSelectMode, setProfileFormName, setProfileFormAvatar, setProfileContentPreferences,
    setEditingProfileId, setProfilePlaylistType, setProfileM3uUrl,
    setProfileXtreamUrl, setProfileXtreamUser, setProfileXtreamPass, setProfileAutoUpdateIntervalHours,
    setAvatarSearchQuery, setAvatarSearchResults, setSelectedSeriesForCast,
    setSeriesCast, onSelectProfile, onSaveProfile, onDeleteProfile,
    onAvatarSearch, onFetchSeriesCast
  } = props;

  const { t, language } = useSettings();

  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [focusedProfileId, setFocusedProfileId] = useState<string | null>(profiles[0]?.id ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileContextMenu, setProfileContextMenu] = useState<{ x: number; y: number; profile: Profile } | null>(null);
  const [enteringProfile, setEnteringProfile] = useState<Profile | null>(null);
  const [entryStage, setEntryStage] = useState(0);

  const enterProfile = (profile: Profile) => {
    setEnteringProfile(profile);
    setEntryStage(0);
    void Promise.resolve(onSelectProfile(profile.id)).catch(() => setEnteringProfile(null));
  };

  const handleDeleteConfirm = async () => {
    if (editingProfileId) {
      await onDeleteProfile(editingProfileId);
      setProfileSelectMode('select');
      setEditingProfileId(null);
      setIsAvatarPickerOpen(false);
      setShowDeleteConfirm(false);
    }
  };

  const openProfileEditor = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setProfileFormName(profile.name);
    setProfileFormAvatar(profile.avatarUrl);
    setProfileContentPreferences(profile.contentPreferences || []);
    setProfileAutoUpdateIntervalHours(profile.autoUpdateIntervalHours || 24);
    setProfileSelectMode('edit');
    setIsAvatarPickerOpen(false);
  };

  const profileContextItems: ContextMenuItem[] = profileContextMenu ? [
    {
      id: 'open-profile',
      label: language === 'tr' ? 'Profili aç' : 'Open Profile',
      icon: <ArrowUpRight size={16} />,
      onSelect: () => enterProfile(profileContextMenu.profile)
    },
    {
      id: 'edit-profile',
      label: language === 'tr' ? 'Profili düzenle' : 'Edit Profile',
      icon: <Pencil size={15} />,
      onSelect: () => openProfileEditor(profileContextMenu.profile)
    },
    {
      id: 'delete-profile',
      label: language === 'tr' ? 'Profili sil' : 'Delete Profile',
      icon: <Trash2 size={15} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => {
        const profile = profileContextMenu.profile;
        setEditingProfileId(profile.id);
        setProfileFormName(profile.name);
        setProfileFormAvatar(profile.avatarUrl);
        setShowDeleteConfirm(true);
      }
    }
  ] : [];

  const openCreateProfile = useCallback(() => {
    setProfileFormName('');
    setProfileFormAvatar('');
    setProfileContentPreferences([]);
    setSelectedSeriesForCast(null);
    setSeriesCast([]);
    setProfilePlaylistType('none');
    setProfileAutoUpdateIntervalHours(24);
    setEditingProfileId(null);
    setProfileSelectMode('create');
    setIsAvatarPickerOpen(false);
  }, [
    setEditingProfileId,
    setProfileAutoUpdateIntervalHours,
    setProfileContentPreferences,
    setProfileFormAvatar,
    setProfileFormName,
    setProfilePlaylistType,
    setProfileSelectMode,
    setSelectedSeriesForCast,
    setSeriesCast
  ]);

  useEffect(() => {
    const canFocusAddProfile = profileSelectMode === 'select' && profiles.length < 5;
    const focusedProfileStillExists = focusedProfileId === null
      ? canFocusAddProfile
      : profiles.some(profile => profile.id === focusedProfileId);

    if (!focusedProfileStillExists) {
      setFocusedProfileId(profiles[0]?.id ?? null);
    }
  }, [focusedProfileId, profileSelectMode, profiles]);

  useEffect(() => {
    if (!isParsing || !enteringProfile || profileSetupStatus.active) return;
    const timers = [
      window.setTimeout(() => setEntryStage(1), 450),
      window.setTimeout(() => setEntryStage(2), 1100)
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [isParsing, enteringProfile, profileSetupStatus.active]);

  useEffect(() => {
    if (profileEntryReady && enteringProfile) setEntryStage(3);
  }, [profileEntryReady, enteringProfile]);

  return (
    <div
      className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${activeTheme}`}
      style={accentStyles}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#050506]" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(5,5,6,0.24)_0%,rgba(5,5,6,0.08)_38%,rgba(3,3,4,0.72)_100%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_180px_70px_rgba(0,0,0,0.62)]" />
      {isParsing && (
        <ProfileEntryOverlay
          avatar={profileFormAvatar}
          enteringProfile={enteringProfile}
          entryStage={entryStage}
          language={language}
          profileName={profileFormName}
          setupMayTakeTimeMessage={t('profiles.messages.setupMayTakeTime')}
          setupStatus={profileSetupStatus}
          t={t}
        />
      )}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[5000] px-5 py-3.5 bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3.5 shadow-2xl max-w-sm animate-scale-in">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)] animate-ping" />
          <span className="text-xs font-semibold text-neutral-200 tracking-wide">{toast.message}</span>
        </div>
      )}

      <ProfileSelectionStage
        focusedProfileId={focusedProfileId}
        language={language}
        mode={profileSelectMode === 'manage' ? 'manage' : 'select'}
        onCreate={openCreateProfile}
        onEdit={openProfileEditor}
        onEnter={enterProfile}
        onFocusProfile={setFocusedProfileId}
        onModeChange={setProfileSelectMode}
        onOpenContextMenu={(event, profile) => {
          event.preventDefault();
          event.stopPropagation();
          setFocusedProfileId(profile.id);
          setProfileContextMenu({ x: event.clientX, y: event.clientY, profile });
        }}
        profiles={profiles}
        t={t}
      />
      {profileContextMenu && (
        <ContextMenu
          x={profileContextMenu.x}
          y={profileContextMenu.y}
          title={profileContextMenu.profile.name}
          subtitle={language === 'tr' ? 'Profil işlemleri' : 'Profile Actions'}
          items={profileContextItems}
          onClose={() => setProfileContextMenu(null)}
        />
      )}

      {profileSelectMode === 'create' && (
        <CreateProfileWizard
          name={profileFormName}
          avatar={profileFormAvatar}
          contentPreferences={profileContentPreferences}
          playlistType={profilePlaylistType}
          m3uUrl={profileM3uUrl}
          xtreamUrl={profileXtreamUrl}
          xtreamUser={profileXtreamUser}
          xtreamPass={profileXtreamPass}
          updateInterval={profileAutoUpdateIntervalHours}
          avatarSearchQuery={avatarSearchQuery}
          avatarSearchResults={avatarSearchResults}
          avatarSearchLoading={avatarSearchLoading}
          localSeries={localSeries}
          selectedSeriesForCast={selectedSeriesForCast}
          seriesCast={seriesCast}
          castLoading={castLoading}
          isSaving={isParsing}
          onNameChange={setProfileFormName}
          onAvatarChange={setProfileFormAvatar}
          onContentPreferencesChange={setProfileContentPreferences}
          onPlaylistTypeChange={setProfilePlaylistType}
          onM3uUrlChange={setProfileM3uUrl}
          onXtreamUrlChange={setProfileXtreamUrl}
          onXtreamUserChange={setProfileXtreamUser}
          onXtreamPassChange={setProfileXtreamPass}
          onUpdateIntervalChange={setProfileAutoUpdateIntervalHours}
          onAvatarSearchQueryChange={setAvatarSearchQuery}
          onAvatarSearchResultsChange={setAvatarSearchResults}
          onSelectedSeriesForCastChange={setSelectedSeriesForCast}
          onSeriesCastChange={setSeriesCast}
          onAvatarSearch={onAvatarSearch}
          onFetchSeriesCast={onFetchSeriesCast}
          onClose={() => {
            setProfileSelectMode('select');
            setEditingProfileId(null);
          }}
          onSave={onSaveProfile}
        />
      )}
        {profileSelectMode === 'edit' && (
          <EditProfileDialog
            isAvatarPickerOpen={isAvatarPickerOpen}
            onAvatarPickerOpenChange={setIsAvatarPickerOpen}
            onClose={() => {
              setProfileSelectMode(editingProfileId ? 'manage' : 'select');
              setEditingProfileId(null);
              setIsAvatarPickerOpen(false);
            }}
            onDeleteRequest={() => setShowDeleteConfirm(true)}
            screenProps={props}
          />
        )}

      {showDeleteConfirm && (
        <DeleteProfileDialog
          cancelLabel={t('common.cancel')}
          language={language}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          profileName={profileFormName}
          title={t('profiles.deleteProfileTitle')}
        />
      )}
    </div>
  );
};
