import { useState, useEffect } from 'react';
import { GameState } from './types';
import { GameCanvas } from './components/GameCanvas';
import { Dashboard } from './components/Dashboard';
import { soundEngine } from './game/audio';
import { 
  Flame, 
  ShieldAlert, 
  Zap, 
  Compass, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Play, 
  Dices, 
  Grid3X3, 
  Skull, 
  Cpu, 
  Info,
  HelpCircle
} from 'lucide-react';

const INITIAL_STATE: GameState = {
  distance: 0,
  scrap: 0,
  multiplier: 1,
  multiplierTimer: 0,
  overheat: 0,
  speed: 0,
  targetSpeed: 0,
  lane: 1, // center lane target (0-left, 1-center, 2-right)
  truckX: 0, // continuous float pos for drift physics
  cowcatcherTimer: 0,
  isGameOver: false,
  gameOverReason: null,
  highScore: 0,
  highDistance: 0,
  isPaused: false,
  dayTime: 0.15, // morning glow
  dustStormTime: 12, // storm timers
  isDustStorm: false,
  stormIntensity: 0,
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Mobile steering target overrides (-1 for left, 1 for right, 0 for center)
  const [mobileSteer, setMobileSteer] = useState<number>(0);
  const [mobileBrake, setMobileBrake] = useState<boolean>(false);

  // Load high scores on mount
  useEffect(() => {
    try {
      const storedScore = localStorage.getItem('demolition_dash_high_score');
      const storedDist = localStorage.getItem('demolition_dash_high_dist');
      setGameState((prev) => ({
        ...prev,
        highScore: storedScore ? parseInt(storedScore, 10) : 0,
        highDistance: storedDist ? parseFloat(storedDist) : 0,
      }));
    } catch (e) {
      console.warn('Could not read scores from localStorage:', e);
    }
  }, []);

  // Sync high score to storage instantly when achieved
  useEffect(() => {
    if (gameState.scrap > 0) {
      try {
        localStorage.setItem('demolition_dash_high_score', gameState.highScore.toString());
        localStorage.setItem('demolition_dash_high_dist', gameState.highDistance.toString());
      } catch (err) {
        console.warn('Could not save high scores:', err);
      }
    }
  }, [gameState.highScore, gameState.highDistance]);

  const startGame = () => {
    // Force initialize user audio context gesture
    soundEngine.init();
    
    setGameState((prev) => ({
      ...INITIAL_STATE,
      highScore: prev.highScore,
      highDistance: prev.highDistance,
    }));
    setIsPlaying(true);
    setMobileSteer(0);
    setMobileBrake(false);
  };

  const handleGameOver = (reason: 'OVERHEAT' | 'CRASH', score: number, dist: number) => {
    setGameState((prev) => {
      const finalScore = Math.max(prev.highScore, score);
      const finalDist = Math.max(prev.highDistance, dist);
      return {
        ...prev,
        isGameOver: true,
        gameOverReason: reason,
        highScore: finalScore,
        highDistance: finalDist,
      };
    });
  };

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  };

  // Keyboard shortcut triggers for mute
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  return (
    <div id="full_game_root" className="relative w-screen h-screen flex flex-col justify-center items-center bg-[#1c1816] text-[#f1e5df] overflow-hidden select-none">
      
      {/* BACKGROUND DECORATIVE GRID PATTERN */}
      <div className="absolute inset-0 bg-[radial-gradient(#2d211b_1.2px,transparent_1.2px)] [background-size:16px_16px] opacity-45 pointer-events-none" />

      {/* CORE FRAME CONTAINER - PRESERVES RATIOS FOR EXCELLENT SIMULATED RACING VIEWER */}
      <div className="relative w-full h-full max-w-5xl max-h-[720px] aspect-video border-y md:border-2 border-[#504038] md:rounded-2xl overflow-hidden bg-black shadow-2xl flex flex-col">
        
        {/* GAME PLAYING VIEWPORT */}
        {isPlaying ? (
          <div className="relative w-full h-full">
            {/* The HTML5 Canvas game loop renderer */}
            <GameCanvas
              gameState={gameState}
              setGameState={setGameState}
              isPlaying={isPlaying && !gameState.isPaused && !gameState.isGameOver}
              onGameOver={handleGameOver}
              inputSteer={mobileSteer}
              inputBrake={mobileBrake}
            />

            {/* Dashboard HUD overlay */}
            <Dashboard
              gameState={gameState}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onPressSteer={(dir) => setMobileSteer(dir)}
              onSetBrake={(active) => setMobileBrake(active)}
            />
          </div>
        ) : (
          /* ================= MAIN INTRO OUTLAW LAUNCH MENU ================= */
          <div className="relative w-full h-full bg-[#161210] flex flex-col items-center justify-between p-6 overflow-y-auto">
            
            {/* SUBTLE HIGHLIGHT BARS */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-700 via-orange-600 to-amber-800" />

            {/* HEADER ZONE */}
            <div className="flex flex-col items-center text-center mt-3 scale-95 md:scale-100">
              <div className="text-[10px] tracking-[0.25em] text-amber-500 font-mono font-bold uppercase flex items-center gap-1.5 mb-1 bg-amber-950/45 px-2.5 py-1 border border-amber-800/20 rounded">
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                V8 ENGINE FUEL INJECTED WASYLAND DASH
              </div>
              
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#fcedcc] via-[#e2833e] to-[#a0521e] uppercase filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Scrap Metal
              </h1>
              <p className="text-stone-300 font-display font-semibold text-lg md:text-xl tracking-wider select-none pr-1">
                Demolition Dash
              </p>
            </div>

            {/* MAIN DASHBOARD PANEL GRID */}
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
              
              {/* HOW TO SURVIVE COMPONENT */}
              <div className="bg-[#1c1613] p-4 border border-[#3c312b] rounded-xl flex flex-col justify-start">
                <h3 className="text-[#fcedcc] text-xs font-bold tracking-widest font-mono flex items-center gap-2 border-b border-[#3c312b] pb-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  WASTELAND MANUAL
                </h3>
                
                <div className="flex flex-col gap-3">
                  {/* Smashables index */}
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🪵</span>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400 font-mono">SMASH DESTROYABLES (RAM)</h4>
                      <p className="text-[11px] text-stone-400">
                        Wooden fences, junker sedans, iron girders. Ramming earns points & extends multipliers.
                      </p>
                    </div>
                  </div>

                  {/* Dodgables index */}
                  <div className="flex items-start gap-2">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="text-xs font-bold text-rose-500 font-mono">DODGE INDESTRUCTIBLES (AVOID)</h4>
                      <p className="text-[11px] text-stone-400">
                        Huge grey concrete blockades, spiking shields, and mines. Pulverizes your truck instantly.
                      </p>
                    </div>
                  </div>

                  {/* Overheating instructions */}
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🔥</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-500 font-mono">OVERHEAT GENERATOR LIMITS</h4>
                      <p className="text-[11px] text-stone-400 font-sans">
                        Plowing forwards heats the boiler. Hold <span className="font-semibold text-stone-200">S / Down Arrow</span> to squeeze hydraulic brakes and vent cooling steam.
                      </p>
                    </div>
                  </div>
                </div>

                {/* PC Keycaps reminders */}
                <div className="bg-stone-950/70 p-2 border border-stone-800 rounded mt-4 text-[10px] flex justify-around items-center font-mono">
                  <span>◀ A / Left Key</span>
                  <span className="text-stone-600">|</span>
                  <span>▼ S / Down Key (Brake/Cool)</span>
                  <span className="text-stone-600">|</span>
                  <span>D / Right Key ▶</span>
                </div>
              </div>

              {/* STATS & LAUNCH COMPONENT */}
              <div className="bg-[#1c1613] p-4 border border-[#3c312b] rounded-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-[#fcedcc] text-xs font-bold tracking-widest font-mono flex items-center gap-2 border-b border-[#3c312b] pb-2 mb-3">
                    <Compass className="w-4 h-4 text-amber-500" />
                    PILOT LOG ENTRIES
                  </h3>

                  {/* High Scores summary details */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-stone-950/50 p-2.5 rounded border border-stone-800/40">
                      <div className="text-[10px] text-stone-500 font-mono">TOP SALVAGE RECORD</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                        {gameState.highScore.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-stone-950/50 p-2.5 rounded border border-stone-800/40">
                      <div className="text-[10px] text-stone-500 font-mono">LONGEST DRIVEN DISTANCE</div>
                      <div className="text-lg font-bold text-[#fcedcc] font-mono mt-1">
                        {gameState.highDistance.toFixed(1)} <span className="text-[10px] text-stone-500 font-normal">KM</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick tips */}
                  <div className="bg-stone-900/60 p-2 rounded border border-stone-800 flex gap-2 items-center">
                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-[10px] text-stone-400">
                      Keep an eye out for <span className="text-blue-400">Water Jugs</span> (50% instant cooldown) and <span className="text-amber-400 font-bold">Cowcatcher plows</span> (makes truck fully indestructible for 6 seconds!).
                    </p>
                  </div>
                </div>

                {/* LAUNCH BUTTON TRIGGER */}
                <button
                  onClick={startGame}
                  className="pointer-events-auto w-full mt-4 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 border border-amber-500 font-display font-bold uppercase py-3.5 px-6 rounded-lg text-lg text-stone-950 shadow-[0_4px_16px_rgba(230,120,40,0.35)] transition-transform duration-150 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  LAUNCH TRUCK INTO THE WASTES
                </button>
              </div>
            </div>

            {/* DESIGN FOOTER */}
            <div className="text-[10px] text-stone-500 font-mono text-center mb-1">
              SCRAP METAL: DEMOLITION DASH • POWERED BY HYDRAULICS CYTEC COW-PLOWS • ALL CODE PROCEDURAL
            </div>

          </div>
        )}

        {/* ================= USER GAME OVER OVERLAY SCREEN ================= */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col justify-center items-center p-6 z-30 font-display">
            
            <div className="w-full max-w-md bg-[#1c1613] border-2 border-orange-600/60 rounded-2xl p-6 text-center shadow-[0_0_24px_rgba(220,100,20,0.22)]">
              
              {/* SKULL & BADGE CAUSE OF LOSS */}
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-500 flex items-center justify-center animate-bounce">
                  <Skull className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* DIESEL CAUSE OF CRASH DECLARATION */}
              <h2 className="text-2xl md:text-3xl font-extrabold uppercase text-[#fcedcc] tracking-tight">
                TRUCK TOTALED
              </h2>
              <p className="text-stone-400 text-xs font-mono tracking-wider uppercase mt-1">
                {gameState.gameOverReason === 'OVERHEAT'
                  ? '💥 CATASTROPHIC STEAM ENGINE BLOWOUT!'
                  : '🚧 SMASHED INTO MASSIVE INDUSTRIAL CONCRETE'}
              </p>

              {/* SCORE BOARD LIST */}
              <div className="grid grid-cols-2 gap-4 my-5 bg-stone-950/70 p-4 border border-stone-800 rounded-lg">
                <div>
                  <div className="text-[10px] text-stone-500 font-mono uppercase">RUN DISTANCE</div>
                  <div className="text-2xl font-bold font-mono text-[#fcedcc] mt-1">
                    {gameState.distance.toFixed(1)}
                    <span className="text-xs text-stone-500 ml-1">KM</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-500 font-mono uppercase">SALVAGE SCRAP</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {gameState.scrap.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* RECORD ALERT METRICS */}
              {(gameState.scrap >= gameState.highScore || gameState.distance >= gameState.highDistance) && (
                <div className="bg-amber-950/45 border border-amber-600/40 rounded-lg p-2 mb-5 flex items-center justify-center gap-2 text-xs font-semibold text-amber-400 animate-pulse font-mono">
                  🏆 NEW RECORD COMMITTED TO THE WASTELAND DATAPADS!
                </div>
              )}

              {/* DUST-STORM RETRY CHANNELS */}
              <div className="flex gap-3">
                <button
                  onClick={startGame}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-stone-950 font-bold uppercase py-3.5 rounded-lg transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  REBUILD & CRANK V8
                </button>
                
                <button
                  onClick={() => setIsPlaying(false)}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold px-4 py-3.5 rounded-lg border border-stone-700 transition-colors uppercase text-xs"
                >
                  MENU
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
