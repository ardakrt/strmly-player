import Aurora from './Aurora';

interface SplashScreenProps {
  splashStatus: string;
}

export function SplashScreen({ splashStatus }: SplashScreenProps) {
  return (
    <div
      id="app-boot-splash"
      className="cinema-boot"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="cinema-boot__ambient" aria-hidden="true" />

      <div className="cinema-boot__aurora" aria-hidden="true">
        <Aurora
          colorStops={["#ffffff", "#ffffff", "#ffffff"]}
          amplitude={0.8}
          blend={0.45}
        />
      </div>

      <main className="cinema-boot__identity">
        <div className="cinema-boot__brand" aria-hidden="true">
          <img className="cinema-boot__mark" src="./icon.png" width="88" height="88" alt="" />
          <h1>STRMLY</h1>
        </div>
        <div className="cinema-boot__status">
          <span className="cinema-boot__status-label">{splashStatus}</span>
          <span className="cinema-boot__progress" aria-hidden="true"><i /></span>
        </div>
      </main>
    </div>
  );
}
