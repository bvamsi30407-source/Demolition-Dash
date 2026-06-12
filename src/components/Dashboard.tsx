import React from 'react';
import { GameState } from '../types';
import { Flame, ShieldAlert, Zap, Compass, Wind, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface DashboardProps {
  gameState: GameState;
  isMuted: boolean;
  onToggleMute: () => void;
  onPressSteer: (dir: number) => void;
  onSetBrake: (active: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  gameState,
  isMuted,
  onToggleMute,
  onPressSteer,
  onSetBrake,
}) => {
  const {
    distance,
    scrap,
    multiplier,
    multiplierTimer,
    overheat,
    speed,
    cowcatcherTimer,
    isDustStorm,
    stormIntensity,
    dayTime,
  } = gameState;

  // Visual percentages
  const overheatPercentage = Math.min(100, Math.max(0, overheat));
  const shieldPercentage = Math.min(100, Math.max(0, (cowcatcherTimer / 6000) * 100));

  // Determine atmospheric warning messages
  const isOverheatingSoon = overheat > 80;
  
  // Format day cycle text
  let timeText = 'DAWN';
  if (dayTime >= 0.2 && dayTime < 0.5) timeText = 'HIGH NOON';
  else if (dayTime >= 0.5 && dayTime < 0.75) timeText = 'RED SUNSET';
  else timeText = 'CHILL NIGHT';

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 font-display">
      {/* ================= TOP PANEL ================= */}
      <div className="flex justify-between items-start w-full gap-4">
        {/* Distance & Scrap Indicators */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Distance Block */}
          <div className="bg-stone-900/90 border border-stone-700 rounded-lg p-3 shadow-lg backdrop-blur-sm min-w-[140px] md:min-w-[180px]">
            <div className="text-stone-400 text-xs tracking-wider flex items-center gap-1.5 font-mono">
              <Compass className="w-4 h-4 text-amber-600 animate-pulse" />
              WASTELAND ROAD
            </div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-stone-100 flex items-baseline gap-1 mt-1">
              {distance.toFixed(1)}
              <span className="text-xs text-stone-500 font-normal">KM</span>
            </div>
          </div>

          {/* Scrap Block */}
          <div className="bg-stone-900/90 border border-stone-700 rounded-lg p-3 shadow-lg backdrop-blur-sm min-w-[140px] md:min-w-[180px]">
            <div className="text-stone-400 text-xs tracking-wider flex items-center gap-1.5 font-mono">
              <Zap className="w-4 h-4 text-emerald-500" />
              SALVAGE SCRAP
            </div>
            <div className="text-2xl md:text-3xl font-bold font-mono text-emerald-400 mt-1">
              {scrap.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Multipliers & Alerts Zone */}
        <div className="flex flex-col items-end gap-2 text-right">
          {/* Active Heat Chain Multiplier */}
          {multiplier > 1 && multiplierTimer > 0 && (
            <div className="bg-stone-900/95 border border-amber-600/60 rounded-md py-1.5 px-3 shadow-lg flex items-center gap-2 animate-bounce">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <div className="text-sm md:text-base font-mono font-bold text-amber-500">
                SCORCH x{multiplier} ({Math.ceil(multiplierTimer / 1000)}s)
              </div>
            </div>
          )}

          {/* Environmental Weather Status Block */}
          <div className="bg-stone-900/90 border border-stone-700/80 rounded-lg p-3 shadow-lg backdrop-blur-sm min-w-[150px] md:min-w-[200px]">
            <div className="text-stone-400 text-[10px] tracking-wider flex items-center gap-1.5 justify-end font-mono">
              <Wind className="w-3.5 h-3.5 text-orange-500" />
              ATMOSPHERIC SENSORS
            </div>
            <div className="text-sm font-semibold text-stone-200 mt-1 flex items-center justify-end gap-1.5">
              {isDustStorm ? (
                <span className="text-orange-500 flex items-center gap-1 animate-pulse">
                  SILICA SANDSTORM ({(stormIntensity * 100).toFixed(0)}%)
                </span>
              ) : (
                <span className="text-stone-300">CALM DESERT WAFT</span>
              )}
            </div>
            <div className="text-[11px] font-mono text-stone-500 mt-0.5">{timeText} STATUS</div>
          </div>

          {/* Sound Toggle Button */}
          <button
            onClick={onToggleMute}
            className="pointer-events-auto bg-stone-900/90 hover:bg-stone-800 border border-stone-700 rounded-lg p-2.5 mt-2 transition-colors duration-150 text-stone-300 focus:outline-none"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
          </button>
        </div>
      </div>

      {/* ================= CENTER FLASH WARNING ================= */}
      <div className="self-center flex flex-col items-center">
        {isOverheatingSoon && (
          <div className="bg-red-950/90 border border-red-600 px-4 py-2 rounded shadow-2xl flex items-center gap-3 animate-pulse">
            <Flame className="w-5 h-5 text-red-500 animate-bounce" />
            <span className="text-red-400 font-mono font-bold text-sm tracking-wider">
              ENGINE TEMPERATURE CRITICAL! COOL DOWN IMMEDIATELY!
            </span>
          </div>
        )}
      </div>

      {/* ================= BOTTOM METERS & CONTROLS ================= */}
      <div className="flex flex-col gap-4 w-full">
        {/* Gauges & Info Panel */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-3 w-full">
          {/* Speed & Overheat Dashboard Modules */}
          <div className="flex gap-4 w-full md:w-auto">
            {/* Speedometer Gauges */}
            <div className="bg-stone-900/95 border border-stone-700 rounded-xl p-3 shadow-lg backdrop-blur-sm min-w-[120px] md:min-w-[150px] flex-1 md:flex-none">
              <div className="text-stone-400 text-[10px] tracking-wider font-mono">DIESEL SPEED</div>
              <div className="text-2xl md:text-3xl font-mono font-bold text-stone-100 flex items-baseline gap-0.5 mt-1">
                {Math.round(speed)}
                <span className="text-xs text-stone-500 font-normal">MPH</span>
              </div>
            </div>

            {/* Core Overheat Tank Gauge */}
            <div className="bg-stone-900/95 border border-stone-700 rounded-xl p-3 shadow-lg backdrop-blur-sm flex-1 md:min-w-[280px]">
              <div className="flex justify-between text-[10px] tracking-wider font-mono mb-1.5">
                <span className="text-stone-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                  OVERHEAT GENERATOR
                </span>
                <span className={isOverheatingSoon ? 'text-red-500 font-bold animate-ping' : 'text-stone-300'}>
                  {Math.round(overheat)}%
                </span>
              </div>
              
              {/* Overheat Progress Slot */}
              <div className="w-full bg-stone-950 h-5 border border-stone-800 rounded overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-sm transition-all duration-75 ${
                    overheatPercentage > 80
                      ? 'bg-gradient-to-r from-orange-600 via-red-500 to-red-600 animate-pulse shadow-[0_0_8px_#ef4444]'
                      : overheatPercentage > 50
                      ? 'bg-gradient-to-r from-amber-600 to-orange-500'
                      : 'bg-gradient-to-r from-emerald-600 to-amber-500'
                  }`}
                  style={{ width: `${overheatPercentage}%` }}
                />
              </div>
              
              <div className="text-[9px] text-stone-500 mt-1 font-mono">
                RAMMING SPURS HEAT. HOLD DOWN ARROW/S TO APPLY HYDRAULIC PRESSURE BRAKE.
              </div>
            </div>
          </div>

          {/* Active Powerup: Reinforced Cowcatcher Status */}
          {cowcatcherTimer > 0 && (
            <div className="bg-stone-900/95 border border-amber-500 p-2.5 rounded-xl shadow-lg min-w-[200px] flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-400 animate-bounce" />
              <div className="flex-1">
                <div className="text-amber-400 text-[10px] font-bold tracking-wider font-mono">REINFORCED PLOW</div>
                <div className="w-full bg-stone-950 h-2 border border-stone-800 rounded overflow-hidden mt-1">
                  <div className="bg-amber-400 h-full transition-all duration-75" style={{ width: `${shieldPercentage}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE CONTROLLERS TOUCH REGION (Reveals fully only under touch-gestured platforms, always supports testing click interactions) */}
        <div className="flex justify-between items-center w-full gap-4 md:hidden pointer-events-auto py-2">
          {/* Steering Left / Right Side Pads */}
          <div className="flex gap-2">
            <button
              onTouchStart={() => onPressSteer(-1)}
              onTouchEnd={() => onPressSteer(0)}
              onMouseDown={() => onPressSteer(-1)}
              onMouseUp={() => onPressSteer(0)}
              className="bg-stone-800/90 active:bg-stone-700/95 border-2 border-stone-600 select-none w-16 h-14 rounded-xl flex items-center justify-center text-stone-300 font-bold active:scale-95 transition-transform"
            >
              ◀ STEER
            </button>
            <button
              onTouchStart={() => onPressSteer(1)}
              onTouchEnd={() => onPressSteer(0)}
              onMouseDown={() => onPressSteer(1)}
              onMouseUp={() => onPressSteer(0)}
              className="bg-stone-800/90 active:bg-stone-700/95 border-2 border-stone-600 select-none w-16 h-14 rounded-xl flex items-center justify-center text-stone-300 font-bold active:scale-95 transition-transform"
            >
              STEER ▶
            </button>
          </div>

          {/* Gigantic Brake lever Pedal */}
          <button
            onTouchStart={() => onSetBrake(true)}
            onTouchEnd={() => onSetBrake(false)}
            onMouseDown={() => onSetBrake(true)}
            onMouseUp={() => onSetBrake(false)}
            className="flex-1 max-w-[200px] bg-red-900/95 active:bg-red-800/95 border-2 border-red-600/80 hover:bg-red-800 select-none h-14 rounded-xl flex items-center justify-center text-red-100 font-bold tracking-wider active:scale-95 transition-transform font-mono"
            title="Squeeze Brakes to slow/cool"
          >
            💨 PRESS BRAKES (VENT)
          </button>
        </div>
      </div>
    </div>
  );
};
