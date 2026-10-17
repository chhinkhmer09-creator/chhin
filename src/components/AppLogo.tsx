import React, { useId } from 'react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  isAnimated?: boolean;
}

export function AppLogoIcon({
  size = 'md',
  className = '',
  isAnimated = true,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isAnimated?: boolean;
}) {
  const rawId = useId();
  // Safe sanitized SVG id prefix without colons
  const uid = `logo-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Dimensions map
  const pixelSizes = {
    sm: 44,
    md: 62,
    lg: 104,
    xl: 148,
  };

  const px = pixelSizes[size] || 62;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        isAnimated ? 'animate-badge-float' : ''
      } ${className}`}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Outer glow filters */}
          <filter id={`neon-glow-cyan-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id={`neon-glow-magenta-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id={`badge-glow-${uid}`} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Badge Dark Cyber Background */}
          <linearGradient id={`badge-bg-${uid}`} x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="45%" stopColor="#0a0f1d" />
            <stop offset="100%" stopColor="#2e0854" />
          </linearGradient>

          {/* Glowing Border: Cyan -> Sky -> Purple -> Magenta */}
          <linearGradient id={`neon-border-${uid}`} x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f5ff" />
            <stop offset="38%" stopColor="#38bdf8" />
            <stop offset="72%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>

          {/* Orbital rings gradient */}
          <linearGradient id={`orbital-cyan-magenta-${uid}`} x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.95" />
            <stop offset="48%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.95" />
          </linearGradient>

          {/* Sound wave bars gradient */}
          <linearGradient id={`wave-grad-${uid}`} x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* SRT text metallic gradient */}
          <linearGradient id={`srt-grad-${uid}`} x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="60%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>

          {/* Holographic light sheen gradient */}
          <linearGradient id={`sheen-grad-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Film Card Clip for light sheen */}
          <clipPath id={`film-clip-${uid}`}>
            <rect x="0" y="0" width="76" height="86" rx="12" />
          </clipPath>
        </defs>

        {/* Ambient audio sonar pulse rings expanding outwards */}
        {isAnimated && (
          <g>
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#00f5ff"
              className="animate-sonar-1"
            />
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke="#ec4899"
              className="animate-sonar-2"
            />
          </g>
        )}

        {/* Ambient back energetic aura glowing */}
        <circle
          cx="96"
          cy="96"
          r="74"
          fill="#00f5ff"
          opacity="0.25"
          filter={`url(#badge-glow-${uid})`}
          className={isAnimated ? 'animate-pulse' : ''}
        />
        <circle
          cx="134"
          cy="126"
          r="66"
          fill="#ec4899"
          opacity="0.28"
          filter={`url(#badge-glow-${uid})`}
          className={isAnimated ? 'animate-pulse' : ''}
          style={{ animationDelay: '1.2s' }}
        />

        {/* Outer orbital cosmic rings tilted at -26 degrees */}
        <g transform="rotate(-26 100 100)">
          {/* Orbital path used for continuous satellite motion */}
          <path
            id={`orbit-path-${uid}`}
            d="M 13 100 a 87 48 0 1 0 174 0 a 87 48 0 1 0 -174 0"
            fill="none"
          />

          {/* Main fast glowing orbital laser stream */}
          <ellipse
            cx="100"
            cy="100"
            rx="87"
            ry="48"
            stroke={`url(#orbital-cyan-magenta-${uid})`}
            strokeWidth="3.2"
            fill="none"
            filter={`url(#neon-glow-cyan-${uid})`}
            strokeDasharray="120 20 40 16 60 14"
            className={isAnimated ? 'animate-orbit-stream' : ''}
          />

          {/* Secondary counter-rotating orbital stream */}
          <ellipse
            cx="100"
            cy="100"
            rx="93"
            ry="53"
            stroke={`url(#orbital-cyan-magenta-${uid})`}
            strokeWidth="1.6"
            strokeOpacity="0.75"
            fill="none"
            strokeDasharray="70 25 110 35"
            className={isAnimated ? 'animate-orbit-counter' : ''}
          />

          {/* Continually racing glowing photon nodes orbiting 360 along the tilted ellipse */}
          {isAnimated ? (
            <>
              {/* Cyan orbital comet */}
              <circle r="3.8" fill="#00f5ff" filter={`url(#neon-glow-cyan-${uid})`}>
                <animateMotion dur="3.6s" repeatCount="indefinite">
                  <mpath href={`#orbit-path-${uid}`} />
                </animateMotion>
              </circle>
              {/* Sky blue secondary satellite */}
              <circle r="2.4" fill="#38bdf8">
                <animateMotion dur="3.6s" begin="0.9s" repeatCount="indefinite">
                  <mpath href={`#orbit-path-${uid}`} />
                </animateMotion>
              </circle>
              {/* Magenta orbital comet */}
              <circle r="3.8" fill="#ec4899" filter={`url(#neon-glow-magenta-${uid})`}>
                <animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite">
                  <mpath href={`#orbit-path-${uid}`} />
                </animateMotion>
              </circle>
              {/* Rose secondary satellite */}
              <circle r="2.4" fill="#f43f5e">
                <animateMotion dur="3.6s" begin="2.7s" repeatCount="indefinite">
                  <mpath href={`#orbit-path-${uid}`} />
                </animateMotion>
              </circle>
            </>
          ) : (
            <>
              <circle cx="16" cy="100" r="3.4" fill="#00f5ff" filter={`url(#neon-glow-cyan-${uid})`} />
              <circle cx="28" cy="83" r="2.2" fill="#38bdf8" />
              <circle cx="184" cy="100" r="3.6" fill="#ec4899" filter={`url(#neon-glow-magenta-${uid})`} />
              <circle cx="170" cy="118" r="2.2" fill="#d946ef" />
            </>
          )}
        </g>

        {/* Central App Squircle Badge with Vibrant Glowing Neon Border */}
        <g filter={`url(#badge-glow-${uid})`} className={isAnimated ? 'animate-neon-glow' : ''}>
          {/* Outer high-voltage cyber border */}
          <rect
            x="34"
            y="34"
            width="132"
            height="132"
            rx="36"
            stroke={`url(#neon-border-${uid})`}
            strokeWidth="4.5"
            fill={`url(#badge-bg-${uid})`}
            className="drop-shadow-2xl"
          />
          {/* Inner specular reflection border */}
          <rect
            x="37"
            y="37"
            width="126"
            height="126"
            rx="33"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeOpacity="0.32"
            fill="none"
          />
        </g>

        {/* Inner Film Strip Reel (White Card) */}
        <g transform="translate(62, 54)">
          {/* Film body with smooth drop shadow */}
          <rect
            x="0"
            y="0"
            width="76"
            height="86"
            rx="12"
            fill="#ffffff"
            filter="drop-shadow(0 6px 14px rgba(0,0,0,0.5))"
          />

          {/* Moving Holographic Sheen Sweep across Card */}
          {isAnimated && (
            <g clipPath={`url(#film-clip-${uid})`}>
              <rect
                x="-120"
                y="-10"
                width="50"
                height="110"
                fill={`url(#sheen-grad-${uid})`}
                className="animate-film-sheen pointer-events-none"
              />
            </g>
          )}

          {/* Left film sprocket perforations */}
          <g className={isAnimated ? 'animate-sprocket' : ''} fill="#1e1b4b">
            <rect x="5" y="8" width="8" height="11" rx="2.5" />
            <rect x="5" y="25" width="8" height="11" rx="2.5" />
            <rect x="5" y="42" width="8" height="11" rx="2.5" />
            <rect x="5" y="59" width="8" height="11" rx="2.5" />
          </g>

          {/* Right film sprocket perforations */}
          <g className={isAnimated ? 'animate-sprocket' : ''} fill="#1e1b4b">
            <rect x="63" y="8" width="8" height="11" rx="2.5" />
            <rect x="63" y="25" width="8" height="11" rx="2.5" />
          </g>

          {/* Lively Sound Waveform Equalizer bouncing in real-time */}
          <g fill={`url(#wave-grad-${uid})`}>
            {/* Steady audio entry pulsing dots */}
            <circle cx="23" cy="42" r="3.2" className={isAnimated ? 'animate-audio-dot' : ''} />
            <circle cx="28.5" cy="42" r="2.2" className={isAnimated ? 'animate-audio-dot-delayed' : ''} />

            {/* 7 Lively Dynamic Waveform Bars with rhythmic musical bounce */}
            <rect
              x="33"
              y="32"
              width="3.2"
              height="20"
              rx="1.6"
              className={isAnimated ? 'animate-wave-1' : ''}
            />
            <rect
              x="37.5"
              y="24"
              width="3.6"
              height="36"
              rx="1.8"
              className={isAnimated ? 'animate-wave-2' : ''}
            />
            <rect
              x="42.5"
              y="29"
              width="3.2"
              height="26"
              rx="1.6"
              className={isAnimated ? 'animate-wave-3' : ''}
            />
            <rect
              x="47"
              y="18"
              width="4.2"
              height="48"
              rx="2.1"
              className={isAnimated ? 'animate-wave-4' : ''}
            />
            <rect
              x="52.6"
              y="25"
              width="3.4"
              height="34"
              rx="1.7"
              className={isAnimated ? 'animate-wave-5' : ''}
            />
            <rect
              x="57.4"
              y="30"
              width="3.2"
              height="24"
              rx="1.6"
              className={isAnimated ? 'animate-wave-6' : ''}
            />
            <rect
              x="62"
              y="35"
              width="3.0"
              height="14"
              rx="1.5"
              className={isAnimated ? 'animate-wave-7' : ''}
            />

            {/* Output audio pulse dot */}
            <circle cx="67.5" cy="42" r="2.2" className={isAnimated ? 'animate-audio-dot' : ''} />
          </g>

          {/* "SRT" Bold Lettering with subtle alive pulse */}
          <text
            x="48"
            y="76"
            textAnchor="middle"
            fill={`url(#srt-grad-${uid})`}
            fontSize="21"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            letterSpacing="-0.5"
            className={isAnimated ? 'animate-srt-text' : ''}
          >
            SRT
          </text>
        </g>

        {/* Twinkling Sparkling Diamond Stars with 360 Spin */}
        {/* Star 1 - Top Left Cyan Sparkle */}
        <polygon
          points="46,38 48,42 52,44 48,46 46,50 44,46 40,44 44,42"
          fill="#00f5ff"
          filter={`url(#neon-glow-cyan-${uid})`}
          className={isAnimated ? 'animate-star-1' : ''}
        />

        {/* Star 2 - Top Right Sky Blue Sparkle */}
        <polygon
          points="156,58 157.5,60.5 160,62 157.5,63.5 156,66 154.5,63.5 152,62 154.5,60.5"
          fill="#38bdf8"
          className={isAnimated ? 'animate-star-2' : ''}
        />

        {/* Star 3 - Bottom Right Magenta Diamond Sparkle */}
        <polygon
          points="160,148 161.8,151.2 165,153 161.8,154.8 160,158 158.2,154.8 155,153 158.2,151.2"
          fill="#ec4899"
          filter={`url(#neon-glow-magenta-${uid})`}
          className={isAnimated ? 'animate-star-3' : ''}
        />

        {/* Star 4 - Bottom Left Violet Sparkle */}
        <polygon
          points="34,138 35.5,140.5 38,142 35.5,143.5 34,146 32.5,143.5 30,142 32.5,140.5"
          fill="#c084fc"
          className={isAnimated ? 'animate-star-4' : ''}
        />

        {/* Star 5 - Top Accent Sparkle */}
        <polygon
          points="126,24 127.2,26 129.5,27 127.2,28 126,30 124.8,28 122.5,27 124.8,26"
          fill="#00f5ff"
          className={isAnimated ? 'animate-star-2' : ''}
        />
      </svg>
    </div>
  );
}

export function AppLogo({
  size = 'md',
  showText = true,
  direction = 'horizontal',
  className = '',
  isAnimated = true,
}: AppLogoProps) {
  if (!showText) {
    return <AppLogoIcon size={size} className={className} isAnimated={isAnimated} />;
  }

  if (direction === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        {/* Glowing badge */}
        <AppLogoIcon
          size={size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'xl'}
          isAnimated={isAnimated}
        />

        {/* English Title with neon cyber gradient & animated shimmer */}
        <div className="mt-3 relative">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 drop-shadow-[0_0_14px_rgba(56,189,248,0.7)] font-sans animate-cyber-shimmer">
            Khmer Video to SRT
          </h1>
        </div>

        {/* Khmer Subtitle with glowing neon violet/magenta shimmer */}
        <p className="mt-1.5 text-xs sm:text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-200 to-pink-300 drop-shadow-[0_0_10px_rgba(168,85,247,0.65)] animate-cyber-shimmer">
          បម្លែងវីដេអូទៅជាចំណងជើង SRT
        </p>
      </div>
    );
  }

  // Horizontal Header Layout
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <AppLogoIcon size={size} isAnimated={isAnimated} />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.4)] font-sans">
            Khmer Video to SRT
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 text-white px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.4)] animate-pulse">
            SRT
          </span>
        </div>
        <p className="text-xs font-semibold text-cyan-300/80 font-sans">
          បម្លែងវីដេអូទៅជាចំណងជើង SRT
        </p>
      </div>
    </div>
  );
}
