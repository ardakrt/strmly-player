import React from 'react';
import { LikeBurstButton } from './LikeBurstButton';

export const LikeBurstButtonPreview: React.FC = () => {
  return (
    <div className="p-6 max-w-md mx-auto bg-neutral-950 text-neutral-100 rounded-2xl border border-white/10 space-y-4 shadow-2xl my-8">
      <div className="border-b border-white/10 pb-3">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-200">
          LikeBurstButton — 8-State Visual Test Matrix
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Hallmark component verification preview for all interactive states.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">1. Default</span>
          <LikeBurstButton state="default" isLiked={false} label="Favori" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">2. Hover</span>
          <LikeBurstButton state="hover" isLiked={false} label="Favori" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">3. Focus</span>
          <LikeBurstButton state="focus" isLiked={false} label="Favori" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">4. Active</span>
          <LikeBurstButton state="active" isLiked={true} label="Favori" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">5. Disabled</span>
          <LikeBurstButton state="disabled" isLiked={false} label="Favori" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">6. Loading</span>
          <LikeBurstButton state="loading" isLiked={false} label="Kaydediliyor" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">7. Error</span>
          <LikeBurstButton state="error" isLiked={false} label="Hata" />
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
          <span className="text-neutral-400">8. Success</span>
          <LikeBurstButton state="success" isLiked={true} label="Eklendi" />
        </div>
      </div>
    </div>
  );
};

export default LikeBurstButtonPreview;
