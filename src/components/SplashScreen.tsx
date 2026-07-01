interface SplashScreenProps {
  activeAccent: string;
  splashStatus: string;
}

export function SplashScreen({ activeAccent, splashStatus }: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#040405] text-white flex flex-col items-center justify-center select-none font-sans">
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.018] blur-[140px] pointer-events-none transition-all duration-1000 animate-pulse-slow"
        style={{
          left: 'calc(50% - 250px)',
          top: 'calc(50% - 250px)',
          backgroundColor: activeAccent,
        }}
      />

      <div className="relative flex flex-col items-center splash-enter">
        <div className="relative w-20 h-20 flex items-center justify-center animate-pulse-slow">
          <div className="absolute inset-0 rounded-[24px] bg-white/[0.01] border border-white/[0.04] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]" />
          <img src="./icon.png" className="w-12 h-12 object-contain opacity-80" alt="Strmly Logo" />
        </div>

        <h1
          className="text-xl font-light tracking-[0.45em] text-white/85 uppercase mt-8 pl-[0.45em] transition-all duration-1000"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          STRMLY
        </h1>

        <div className="relative h-[2px] w-28 overflow-hidden rounded-full bg-white/[0.06] mt-8">
          <div
            className="absolute inset-y-0 left-0 w-1/2 rounded-full splash-progress"
            style={{
              backgroundColor: activeAccent,
              boxShadow: `0 0 8px ${activeAccent}`,
            }}
          />
        </div>

        <span
          className="text-[10px] tracking-[0.2em] text-white/30 uppercase font-semibold mt-4 transition-all duration-300 min-h-[16px] text-center px-4"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {splashStatus}
        </span>
      </div>
    </div>
  );
}
