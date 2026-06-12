import React, { useRef, useEffect, useState } from 'react';
import { GameState, Obstacle, Particle, RoadSceneObject, ObstacleType } from '../types';
import { soundEngine } from '../game/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  isPlaying: boolean;
  onGameOver: (reason: 'OVERHEAT' | 'CRASH', finalScore: number, finalDist: number) => void;
  inputSteer: number; // -1 for dev steering left, 1 for right, 0 for neutral
  inputBrake: boolean; // true if braking active from UI
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  isPlaying,
  onGameOver,
  inputSteer,
  inputBrake,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep game values in refs to avoid React re-renders in high-speed 60FPS loop
  const stateRef = useRef<GameState>(gameState);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const inputSteerRef = useRef<number>(inputSteer);
  const inputBrakeRef = useRef<boolean>(inputBrake);

  // Entities state
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sceneryRef = useRef<RoadSceneObject[]>([]);
  const frameIdRef = useRef<number | null>(null);

  // Timers and logic variables
  const lastTimeRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const scenerySpawnTimerRef = useRef<number>(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const screenShakeRef = useRef<number>(0);
  const roadScrollPhaseRef = useRef<number>(0);

  // Track state updates to sync back to parent at throttled intervals
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      soundEngine.init(); // Initialize audio engine on active play
      
      // Completely reset game entity variables, inputs, and timers for a fresh round
      obstaclesRef.current = [];
      particlesRef.current = [];
      sceneryRef.current = [];
      spawnTimerRef.current = 0;
      scenerySpawnTimerRef.current = 0;
      screenShakeRef.current = 0;
      roadScrollPhaseRef.current = 0;
      keysPressedRef.current = {};
      lastTimeRef.current = performance.now();
      lastSyncTimeRef.current = 0;
    }
  }, [isPlaying]);

  useEffect(() => {
    inputSteerRef.current = inputSteer;
  }, [inputSteer]);

  useEffect(() => {
    inputBrakeRef.current = inputBrake;
  }, [inputBrake]);

  // Handle high score updates
  const updateScoresRef = useRef<(scrapRate: number, distDelta: number, mult: number) => void>(() => {});
  updateScoresRef.current = (scrapRate: number, distDelta: number, mult: number) => {
    setGameState((prev) => {
      const newScrap = prev.scrap + scrapRate;
      const newDistance = prev.distance + distDelta;
      const finalMultiplier = prev.multiplierTimer > 0 ? prev.multiplier : 1;
      
      return {
        ...prev,
        scrap: newScrap,
        distance: Number(newDistance.toFixed(1)),
        highScore: Math.max(prev.highScore, newScrap),
        highDistance: Math.max(prev.highDistance, Number(newDistance.toFixed(1))),
      };
    });
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current || stateRef.current.isGameOver || stateRef.current.isPaused) return;
      keysPressedRef.current[e.code] = true;
      keysPressedRef.current[e.key] = true;

      // Quick initialization trigger
      soundEngine.init();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
      keysPressedRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Set up responsive canvas sizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Landscape lock support or responsive fit
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', handleResize);
    
    // Initial resize trigger
    setTimeout(handleResize, 100);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Helper: Projection math for Pseudo 3D lane mapping
  const projectPoint = (width: number, height: number, laneOffset: number, progressY: number) => {
    // progressY goes from 0 (horizon) to 1 (bottom foreground)
    const horizonY = height * 0.35; // horizon at 35%
    const bottomY = height * 0.96; // road stretches to near bottom
    const actualY = horizonY + progressY * (bottomY - horizonY);

    const horizonWidth = 50; 
    const bottomWidth = width * 0.84; // wide base
    const currentRoadWidth = horizonWidth + progressY * (bottomWidth - horizonWidth);

    // laneOffset spans from -1.5 (far left edge) to 1.5 (far right edge)
    // Left lane center: -1, Center lane center: 0, Right lane center: 1
    const actualX = width * 0.5 + laneOffset * (currentRoadWidth / 3);
    const scale = 0.08 + progressY * 0.92;

    return { x: actualX, y: actualY, scale };
  };

  // Trigger crash/scrap particles
  const spawnExplosionParticles = (x: number, y: number, color: string, intensity: number, shape: 'circle' | 'square' | 'line' = 'circle') => {
    const count = Math.floor(15 + intensity * 15);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 * intensity + 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 3 + 1), // bias upward
        color,
        size: Math.random() * 4 * intensity + 2,
        alpha: 1,
        life: 0,
        maxLife: Math.floor(Math.random() * 30 + 30),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        shape,
      });
    }
  };

  // Game Loop
  useEffect(() => {
    lastTimeRef.current = performance.now();
    
    const updateGame = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        frameIdRef.current = requestAnimationFrame(updateGame);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        frameIdRef.current = requestAnimationFrame(updateGame);
        return;
      }

      // Calculate delta time
      const dt = Math.max(0, Math.min((time - lastTimeRef.current) / 1000, 0.1)); // cap dt to avoid teleports & protect against negative deltas
      lastTimeRef.current = time;

      const physicalWidth = canvas.width / (window.devicePixelRatio || 1);
      const physicalHeight = canvas.height / (window.devicePixelRatio || 1);

      if (isPlayingRef.current && !stateRef.current.isGameOver && !stateRef.current.isPaused) {
        processPhysics(dt, physicalWidth, physicalHeight);
      }

      renderScene(ctx, physicalWidth, physicalHeight);

      frameIdRef.current = requestAnimationFrame(updateGame);
    };

    // Physics Engine Update
    const processPhysics = (dt: number, width: number, height: number) => {
      const state = { ...stateRef.current };

      // Update diurnal cycle dayTime (day-night cycle triggers shifts)
      state.dayTime = (state.dayTime + dt * 0.015) % 1.0;

      // Update Dust storm simulation
      state.dustStormTime -= dt;
      if (state.dustStormTime <= 0) {
        state.isDustStorm = !state.isDustStorm;
        state.dustStormTime = state.isDustStorm ? Math.random() * 15 + 10 : Math.random() * 25 + 20;
      }

      // Lerp dust storm intensity
      if (state.isDustStorm) {
        state.stormIntensity = Math.min(1, state.stormIntensity + dt * 0.4);
      } else {
        state.stormIntensity = Math.max(0, state.stormIntensity - dt * 0.4);
      }

      // Check Shield Active Cowcatcher status
      if (state.cowcatcherTimer > 0) {
        state.cowcatcherTimer = Math.max(0, state.cowcatcherTimer - dt * 1000);
      }

      // Check Score Multiplier state
      if (state.multiplierTimer > 0) {
        state.multiplierTimer = Math.max(0, state.multiplierTimer - dt * 1000);
        if (state.multiplierTimer <= 0) {
          state.multiplier = 1;
        }
      }

      // Handle Truck steering physics with "heavy" drift lag
      let steeringInput = 0;
      if (keysPressedRef.current['ArrowLeft'] || keysPressedRef.current['KeyA'] || inputSteerRef.current === -1) {
        steeringInput = -1;
      } else if (keysPressedRef.current['ArrowRight'] || keysPressedRef.current['KeyD'] || inputSteerRef.current === 1) {
        steeringInput = 1;
      }

      if (steeringInput !== 0) {
        // Truck slowly changes standard targets or drifts on tap
        state.truckX += steeringInput * dt * 2.1; // slide speed
        // Clamp truck between lane extremes
        state.truckX = Math.max(-1.4, Math.min(1.4, state.truckX));
      } else {
        // Gentle auto-centering on nearest lane center if no active input is held
        const nearestLaneX = Math.round(state.truckX);
        const diff = nearestLaneX - state.truckX;
        state.truckX += diff * dt * 4.0; // soft centering drag feel
      }

      // Handle Braking vs Acceleration
      let braking = false;
      if (keysPressedRef.current['ArrowDown'] || keysPressedRef.current['KeyS'] || keysPressedRef.current['Space'] || inputBrakeRef.current) {
        braking = true;
      }

      if (braking) {
        // Hard braking: reduce target speed and cool engine dramatically
        state.targetSpeed = 35; // crawling speed
        state.overheat = Math.max(0, state.overheat - dt * 45); // cool 45% per second
        
        // Trigger brake squeal steam sounds occasionally
        if (Math.random() < 0.1) {
          soundEngine.playSteamVent();
        }

        // Emitting steam cooling particles!
        const truckProj = projectPoint(width, height, state.truckX, 0.85);
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push({
            x: truckProj.x + (Math.random() - 0.5) * 30,
            y: truckProj.y,
            vx: (Math.random() - 0.5) * 2 - (state.truckX * 1.5),
            vy: -(Math.random() * 3 + 2),
            color: 'rgba(230, 245, 255, 0.65)',
            size: Math.random() * 5 + 3,
            alpha: 1,
            life: 0,
            maxLife: Math.floor(Math.random() * 15 + 15),
            rotation: 0,
            rotSpeed: 0,
            shape: 'circle',
          });
        }
      } else {
        // Accelerating normally
        state.targetSpeed = 100; // top speed
        
        // Passive heating based on speed ratio
        const ambientHeatRate = (state.speed / 100) * 4.5;
        // Storm traps heat
        const stormTax = state.isDustStorm ? 2.5 : 0;
        state.overheat = Math.min(100, state.overheat + dt * (ambientHeatRate + stormTax));
      }

      // Lerp actual speed
      state.speed += (state.targetSpeed - state.speed) * dt * (braking ? 4.5 : 1.5);

      // Check for Engine Blowout Game Over
      if (state.overheat >= 100) {
        state.isGameOver = true;
        state.gameOverReason = 'OVERHEAT';
        soundEngine.playExplosion();
        spawnExplosionParticles(width / 2, height * 0.7, '#ff5500', 3, 'square');
        spawnExplosionParticles(width / 2, height * 0.7, '#333333', 2, 'circle');
        onGameOver('OVERHEAT', state.scrap, state.distance);
      }

      // Update continuously scrolling highway metrics
      const currentScrollIncrement = (state.speed * dt);
      roadScrollPhaseRef.current = (roadScrollPhaseRef.current + currentScrollIncrement * 0.25) % 1.0;
      updateScoresRef.current(0, currentScrollIncrement * 0.05, state.multiplier);

      // Procedural sound pitch and rumble adjusting
      const speedRatio = state.speed / 100;
      const overheatRatio = state.overheat / 100;
      soundEngine.updateEngine(speedRatio, overheatRatio, braking, state.cowcatcherTimer > 0);

      // Continuous Exhaust pipe puffing
      const truckProj = projectPoint(width, height, state.truckX, 0.85);
      if (Math.random() < 0.25 + (overheatRatio * 0.3)) {
        const exhaustSides = [-15, 15]; // left and right dual smoking stacks
        exhaustSides.forEach((sideOffset) => {
          particlesRef.current.push({
            x: truckProj.x + sideOffset * truckProj.scale,
            y: truckProj.y - 45 * truckProj.scale, // top of stack
            vx: -state.truckX * 0.5 + (Math.random() - 0.5) * 1,
            vy: -1.5 - (Math.random() * 2),
            color: state.overheat > 80 ? '#331111' : '#282828',
            size: Math.random() * 6 + 3 + (overheatRatio * 8),
            alpha: 0.75,
            life: 0,
            maxLife: Math.floor(Math.random() * 20 + 20),
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.1,
            shape: 'circle',
          });
        });
      }

      // Dynamic obstacle spawner
      spawnTimerRef.current -= dt * (state.speed / 50);
      if (spawnTimerRef.current <= 0) {
        spawnRandomObstacle(width, height);
        spawnTimerRef.current = Math.random() * 1.5 + 1.25; // timing based on difficulty
      }

      // Scenery spawner (fences, ruined desert clutter)
      scenerySpawnTimerRef.current -= dt * (state.speed / 50);
      if (scenerySpawnTimerRef.current <= 0) {
        spawnScenery();
        scenerySpawnTimerRef.current = Math.random() * 0.8 + 0.4;
      }

      // Update Scenery entities in a high-performance single-pass loop
      const sceneSpeedFactor = speedRatio * 1.2;
      const updatedScenery: RoadSceneObject[] = [];
      const sceneryLength = sceneryRef.current.length;
      for (let i = 0; i < sceneryLength; i++) {
        const obj = sceneryRef.current[i];
        obj.y += dt * 0.5 * sceneSpeedFactor; // scroll towards front
        if (obj.y < 1.1) {
          updatedScenery.push(obj);
        }
      }
      sceneryRef.current = updatedScenery;

      // Update Obstacle entities in a high-performance single-pass loop
      const updatedObstacles: Obstacle[] = [];
      const obstacleSpeedFactor = state.speed / 70;
      const obstaclesLength = obstaclesRef.current.length;
      for (let i = 0; i < obstaclesLength; i++) {
        const obs = obstaclesRef.current[i];
        // Move towards foreground
        obs.y += dt * 0.65 * obstacleSpeedFactor;

        // Check active collision zone (roughly when progressY matches player depth, 0.78 to 0.88)
        if (!obs.smashed && obs.y >= 0.78 && obs.y <= 0.88) {
          const obsLaneOffset = obs.lane - 1; // convert 0, 1, 2 lane index to -1, 0, 1 offset
          const distanceToPlayer = Math.abs(state.truckX - obsLaneOffset);

          // Accurate collision threshold
          if (distanceToPlayer < 0.42) {
            handleCollision(obs, state, width, height);
          }
        }

        if (obs.y < 1.1) {
          updatedObstacles.push(obs);
        }
      }
      obstaclesRef.current = updatedObstacles;

      // Update Active Particles in a high-performance single-pass loop
      const updatedParticles: Particle[] = [];
      const particlesLength = particlesRef.current.length;
      for (let i = 0; i < particlesLength; i++) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.life += 1;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        
        if (p.life < p.maxLife) {
          updatedParticles.push(p);
        }
      }
      particlesRef.current = updatedParticles;

      // Apply screen shake cooling
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 25);
      }

      // Push final state back to ref and synchronize state.
      // We throttle React state synchronization updates to ~30 FPS (~33ms intervals)
      // to avoid choking the React virtual DOM component rendering pipeline, while
      // keeping speedometer updates extremely fluid. Critical overrides like Game Over / Pause instantly sync.
      stateRef.current = state;
      const now = performance.now();
      if (state.isGameOver || state.isPaused || now - lastSyncTimeRef.current >= 33) {
        setGameState(state);
        lastSyncTimeRef.current = now;
      }
    };

    // Obstacle Collision Logic
    const handleCollision = (obs: Obstacle, state: GameState, width: number, height: number) => {
      const obstacleX = projectPoint(width, height, obs.lane - 1, obs.y).x;
      const obstacleY = projectPoint(width, height, obs.lane - 1, obs.y).y;

      const hasShield = state.cowcatcherTimer > 0;

      // Classify Obstacles
      const isDamaging =
        obs.type === 'CONCRETE_BLOCK' ||
        obs.type === 'SPIKED_WALL' ||
        obs.type === 'MINE';

      const isSmashable =
        obs.type === 'WOOD_BARRICADE' ||
        obs.type === 'SCRAP_CAR' ||
        obs.type === 'IRON_GIRDER';

      const isCollectible =
        obs.type === 'WATER_JUG' ||
        obs.type === 'COWCATCHER';

      if (isCollectible) {
        // Collectibles never damage, they assist
        obs.smashed = true;
        if (obs.type === 'WATER_JUG') {
          // Cool engine
          state.overheat = Math.max(0, state.overheat - 50);
          soundEngine.playWaterSizzle();
          // Drop sizzle drops
          spawnExplosionParticles(obstacleX, obstacleY, '#96dbff', 0.8, 'circle');
        } else if (obs.type === 'COWCATCHER') {
          // Grant reinforced steel plow cowcatcher shield
          state.cowcatcherTimer = 6000; // 6 seconds
          soundEngine.playPowerupShield();
          spawnExplosionParticles(obstacleX, obstacleY, '#ffd800', 1.5, 'square');
        }
        return;
      }

      if (hasShield) {
        // SMASH EVERYTHING safely if shielded by reinforced Cowcatcher!
        obs.smashed = true;
        soundEngine.playMetalCrash();
        screenShakeRef.current = 14;

        // Visual metal shatter sparkles
        let debrisColor = '#808080';
        if (obs.type === 'WOOD_BARRICADE') debrisColor = '#a06e3b';
        else if (obs.type === 'CONCRETE_BLOCK') debrisColor = '#b5b0aa';
        else if (obs.type === 'MINE') {
          debrisColor = '#ff3c00';
          spawnExplosionParticles(obstacleX, obstacleY, '#ff3c00', 2.0, 'circle');
        } else if (obs.type === 'SPIKED_WALL') debrisColor = '#5e5e5e';
        
        spawnExplosionParticles(obstacleX, obstacleY, debrisColor, 1.8, 'square');
        spawnExplosionParticles(obstacleX, obstacleY, '#ffd700', 1.0, 'line'); // gold shield glow flakes

        // Earn Points
        state.scrap += 150 * state.multiplier;
        state.multiplierTimer = 4000; // extend multiplier 4 seconds
        state.multiplier += 1;
        return;
      }

      // UNSHIELDED standard impact logic
      if (isSmashable) {
        obs.smashed = true;
        soundEngine.playMetalCrash();
        screenShakeRef.current = 22;

        let debrisColor = '#c2a688';
        let heatCost = 15; // default heat cost
        let points = 100;

        if (obs.type === 'SCRAP_CAR') {
          debrisColor = '#9a3c1a'; // rusty car paint
          heatCost = 25;
          points = 250;
        } else if (obs.type === 'IRON_GIRDER') {
          debrisColor = '#6d5a52';
          heatCost = 20;
          points = 180;
        }

        spawnExplosionParticles(obstacleX, obstacleY, debrisColor, 1.6, 'square');
        spawnExplosionParticles(obstacleX, obstacleY, '#ff7700', 1.0, 'line'); // fiery sparks

        // Apply heat hit and save collected scrap points
        state.overheat = Math.min(100, state.overheat + heatCost);
        state.scrap += points * state.multiplier;
        state.multiplierTimer = 4000; 
        state.multiplier += 1; // heat chain ramp-up
      } else if (isDamaging) {
        // BOOM! Indestructible object instantly crashes the vehicle!
        state.isGameOver = true;
        state.gameOverReason = 'CRASH';
        soundEngine.playExplosion();
        screenShakeRef.current = 40;
        
        spawnExplosionParticles(obstacleX, obstacleY, '#ff2200', 3.5, 'circle');
        spawnExplosionParticles(obstacleX, obstacleY, '#222222', 2.5, 'square');
        
        onGameOver('CRASH', state.scrap, state.distance);
      }
    };

    // Entity spawners
    const spawnRandomObstacle = (width: number, height: number) => {
      const lane = Math.floor(Math.random() * 3); // random 0, 1, 2 lane
      
      // Determine what to spawn based on scores or random percentiles
      const rand = Math.random() * 100;
      let type: ObstacleType = 'WOOD_BARRICADE';

      if (rand < 28) type = 'WOOD_BARRICADE'; // standard breakable
      else if (rand < 44) type = 'CONCRETE_BLOCK'; // dodge!
      else if (rand < 56) type = 'MINE'; // explosive landmine dodge!
      else if (rand < 68) type = 'SCRAP_CAR'; // heavy reward breakable
      else if (rand < 76) type = 'IRON_GIRDER'; // medium breakable girder
      else if (rand < 84) type = 'SPIKED_WALL'; // spiked wall dodge
      else if (rand < 93) type = 'WATER_JUG'; // water helper
      else type = 'COWCATCHER'; // golden powerup helper

      obstaclesRef.current.push({
        id: crypto.randomUUID(),
        type,
        lane,
        y: 0, // horizon start
        xOffset: (Math.random() - 0.5) * 0.12, // narrow drift within lane
        width: 45,
        height: 35,
        smashed: false,
        scoreAwarded: false,
        angle: 0,
        spinDirection: Math.random() < 0.5 ? -1 : 1,
      });
    };

    const spawnScenery = () => {
      const isLeft = Math.random() < 0.5;
      const typeRand = Math.random() * 100;
      let type: 'POLE' | 'RUIN_TOWER' | 'DEAD_TREE' | 'DUNE' | 'ROCK' = 'DUNE';

      if (typeRand < 25) type = 'DEAD_TREE';
      else if (typeRand < 50) type = 'ROCK';
      else if (typeRand < 75) type = 'POLE';
      else if (typeRand < 90) type = 'DUNE';
      else type = 'RUIN_TOWER';

      sceneryRef.current.push({
        id: crypto.randomUUID(),
        xSide: isLeft ? 'left' : 'right',
        xOffset: Math.random() * 0.6 + 0.12, // spacing from shoulder line
        y: 0,
        type,
        scale: Math.random() * 0.3 + 0.35,
      });
    };

    // Canvas Frame Render Loop
    const renderScene = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      // Apply keyframe screen shakes
      ctx.save();
      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(shakeX, shakeY);
      }

      // Draw environment backdrop, road, elements
      drawEnvironmentBackdrop(ctx, w, h);
      drawRoad(ctx, w, h);
      drawSceneryObjects(ctx, w, h);
      drawObstacles(ctx, w, h);
      drawParticles(ctx);
      drawPlayerTruck(ctx, w, h);
      drawOverlayWeatherStormEffects(ctx, w, h);

      ctx.restore();
    };

    // Environmental skies and distant peaks
    const drawEnvironmentBackdrop = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const t = stateRef.current.dayTime;

      // Color nodes based on diurnal daytime progress (0 is Dawn, 0.25 is Noon, 0.5 is Dusk, 0.75 is Night)
      let groundColor = '#80562e';
      let skyTop = '#c68444';
      let skyBottom = '#ffdfa3';
      let ambientOverlay = 'rgba(0, 0, 0, 0)';

      if (t < 0.2) {
        // Dawn to Noon
        const progress = t / 0.2;
        skyTop = blendColors('#804020', '#c87830', progress);
        skyBottom = blendColors('#ecaf66', '#f2d599', progress);
        groundColor = blendColors('#604020', '#8c593b', progress);
      } else if (t < 0.5) {
        // Noon to Sunset
        const progress = (t - 0.2) / 0.3;
        skyTop = blendColors('#c87830', '#c24b17', progress);
        skyBottom = blendColors('#f2d599', '#f0aa67', progress);
        groundColor = blendColors('#8c593b', '#7a452c', progress);
      } else if (t < 0.7) {
        // Sunset to Deep Night
        const progress = (t - 0.5) / 0.2;
        skyTop = blendColors('#c24b17', '#120f26', progress);
        skyBottom = blendColors('#f0aa67', '#34294a', progress);
        groundColor = blendColors('#7a452c', '#422520', progress);
        ambientOverlay = `rgba(18, 15, 38, ${progress * 0.5})`;
      } else {
        // Night back to Dawn
        const progress = (t - 0.7) / 0.3;
        skyTop = blendColors('#120f26', '#804020', progress);
        skyBottom = blendColors('#34294a', '#ecaf66', progress);
        groundColor = blendColors('#422520', '#604020', progress);
        ambientOverlay = `rgba(18, 15, 38, ${(1 - progress) * 0.5})`;
      }

      // Render sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.35);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(1, skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.35);

      // Draw distant desert peaks
      ctx.fillStyle = blendColors(groundColor, '#221105', 0.2);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.36);
      ctx.lineTo(w * 0.15, h * 0.22);
      ctx.lineTo(w * 0.35, h * 0.35);
      ctx.lineTo(w * 0.55, h * 0.17);
      ctx.lineTo(w * 0.72, h * 0.34);
      ctx.lineTo(w * 0.88, h * 0.21);
      ctx.lineTo(w, h * 0.36);
      ctx.closePath();
      ctx.fill();

      // Earth floor ground
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, h * 0.35, w, h * 0.65);

      // Draw sun or moon
      drawCelestialBody(ctx, w, h, t);

      // Overlay night darkness ambient filter
      if (ambientOverlay !== 'rgba(0, 0, 0, 0)') {
        ctx.fillStyle = ambientOverlay;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const drawCelestialBody = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      ctx.save();
      if (t < 0.6) {
        // Draw hot post-apocalyptic dust-covered sun
        const progress = t / 0.6;
        const sunX = w * 0.2 + progress * w * 0.65;
        const sunY = h * 0.30 - Math.sin(progress * Math.PI) * (h * 0.15);

        ctx.shadowColor = 'rgba(255, 140, 0, 0.45)';
        ctx.shadowBlur = 40;
        ctx.fillStyle = '#ffeed4';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
        ctx.fill();
        
        // Sun rays/corona
        ctx.fillStyle = 'rgba(255, 90, 0, 0.08)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw cold pale moon
        const progress = (t - 0.6) / 0.4;
        const moonX = w * 0.2 + progress * w * 0.65;
        const moonY = h * 0.30 - Math.sin(progress * Math.PI) * (h * 0.15);

        ctx.shadowColor = 'rgba(200, 220, 255, 0.3)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#f0f5ff';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // Draw the Asphalt trapezoid and rolling separators
    const drawRoad = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const topWidth = 50;
      const botWidth = w * 0.84;
      const roadHorizonY = h * 0.35;
      const roadBotY = h * 0.96;

      // Dark asphalt body
      ctx.fillStyle = '#1e1c1b';
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - topWidth, roadHorizonY);
      ctx.lineTo(w * 0.5 + topWidth, roadHorizonY);
      ctx.lineTo(w * 0.5 + botWidth / 2, roadBotY);
      ctx.lineTo(w * 0.5 - botWidth / 2, roadBotY);
      ctx.closePath();
      ctx.fill();

      // Guard rails/shoulder lines
      ctx.strokeStyle = '#624d3e'; // rusted guard brown
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - topWidth * 1.05, roadHorizonY);
      ctx.lineTo(w * 0.5 - (botWidth / 2) * 1.05, roadBotY);
      ctx.moveTo(w * 0.5 + topWidth * 1.05, roadHorizonY);
      ctx.lineTo(w * 0.5 + (botWidth / 2) * 1.05, roadBotY);
      ctx.stroke();

      // Draw yellow side lines
      ctx.strokeStyle = '#d0741e'; // orange-rust strip
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - topWidth, roadHorizonY);
      ctx.lineTo(w * 0.5 - botWidth / 2, roadBotY);
      ctx.moveTo(w * 0.5 + topWidth, roadHorizonY);
      ctx.lineTo(w * 0.5 + botWidth / 2, roadBotY);
      ctx.stroke();

      // Lane separators scrolling animation (projective steps index)
      const segmentsCount = 10;
      const speedRatio = stateRef.current.speed / 100;

      for (let i = 0; i < segmentsCount; i++) {
        // Calculate progressive scale of marker segments
        const stepProgress = (i + roadScrollPhaseRef.current) / segmentsCount;
        
        // Logarithmic or exponential projection looks accurate for perspective movement
        const py = Math.pow(stepProgress, 2.5); // clump lines tighter near horizon

        const pLeft = projectPoint(w, h, -0.5, py);
        const pRight = projectPoint(w, h, 0.5, py);

        // draw dashed lines
        ctx.fillStyle = '#af9171'; // dusty greyish white lane markings
        const markerLength = 12 * pLeft.scale;
        
        if (py > 0.05 && py < 0.98) {
          // Left lane marker
          ctx.fillRect(pLeft.x - 1, pLeft.y - markerLength / 2, 2 * pLeft.scale, markerLength);
          // Right lane marker
          ctx.fillRect(pRight.x - 1, pRight.y - markerLength / 2, 2 * pRight.scale, markerLength);
        }
      }
    };

    // Draw background roadside scenery objects (ruined towers, cacti, rocks)
    const drawSceneryObjects = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      sceneryRef.current.forEach((obj) => {
        // map coordinates based on left/right side offset
        const multiplier = obj.xSide === 'left' ? -1 : 1;
        // visual offset pushes them further out in 3D perspective
        const progressY = obj.y;
        
        const proj = projectPoint(w, h, multiplier * (1.6 + obj.xOffset), progressY);

        if (proj.y < h * 0.35 || proj.y > h * 0.98) return;

        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.scale(proj.scale * obj.scale, proj.scale * obj.scale);

        // Procedural draw shapes
        if (obj.type === 'DEAD_TREE') {
          ctx.strokeStyle = '#271f1d';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -60);
          ctx.stroke();
          
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(0, -35);
          ctx.quadraticCurveTo(-15, -45, -20, -55);
          ctx.moveTo(0, -45);
          ctx.quadraticCurveTo(12, -50, 18, -65);
          ctx.stroke();
        } else if (obj.type === 'ROCK') {
          ctx.fillStyle = '#4f3c31';
          ctx.strokeStyle = '#281c15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-25, 0);
          ctx.lineTo(-20, -18);
          ctx.lineTo(-5, -25);
          ctx.lineTo(15, -20);
          ctx.lineTo(25, -2);
          ctx.lineTo(20, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (obj.type === 'POLE') {
          // Weathered telephone pole with crossbar
          ctx.strokeStyle = '#241b18';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -90);
          ctx.stroke();

          // Crossbar
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-18, -75);
          ctx.lineTo(18, -75);
          ctx.stroke();

          // Hanging wire loop
          ctx.strokeStyle = 'rgba(30, 20, 15, 0.4)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(-18, -75);
          ctx.quadraticCurveTo(0, -68, 18, -75);
          ctx.stroke();
        } else if (obj.type === 'RUIN_TOWER') {
          // Crumbling concrete diesel tower structure
          ctx.fillStyle = '#554238';
          ctx.strokeStyle = '#32251f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-20, 0);
          ctx.lineTo(-14, -85);
          ctx.lineTo(14, -85);
          ctx.lineTo(20, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Ruined holes
          ctx.fillStyle = '#221815';
          ctx.fillRect(-6, -65, 12, 18);
          ctx.fillRect(-5, -30, 10, 14);
        } else {
          // Sand dune
          ctx.fillStyle = '#ae7f5c';
          ctx.beginPath();
          ctx.moveTo(-60, 0);
          ctx.quadraticCurveTo(0, -22, 60, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });
    };

    // Draw active obstacle items
    const drawObstacles = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      obstaclesRef.current.forEach((obs) => {
        // convert lane 0, 1, 2 to laneOffset -1, 0, 1
        const laneOffset = (obs.lane - 1) + obs.xOffset;
        const proj = projectPoint(w, h, laneOffset, obs.y);

        if (proj.y < h * 0.35 || proj.y > h * 0.98) return;

        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.scale(proj.scale * 0.9, proj.scale * 0.9);

        if (obs.smashed) {
          // Rotate/fly off screen when hit
          obs.angle += obs.spinDirection * 0.28;
          ctx.rotate(obs.angle);
          ctx.translate(150 * obs.angle, -250 * Math.abs(obs.angle)); // fly upwards out
          ctx.globalAlpha = Math.max(0, 1 - Math.abs(obs.angle) * 0.4);
        }

        // Procedural render depending on hazard type
        switch (obs.type) {
          case 'WOOD_BARRICADE':
            drawWoodBarricadeShape(ctx);
            break;
          case 'SCRAP_CAR':
            drawScrapCarShape(ctx);
            break;
          case 'IRON_GIRDER':
            drawIronGirderShape(ctx);
            break;
          case 'CONCRETE_BLOCK':
            drawConcreteObstacleShape(ctx);
            break;
          case 'MINE':
            drawMineObstacleShape(ctx);
            break;
          case 'SPIKED_WALL':
            drawSpikedWallShape(ctx);
            break;
          case 'WATER_JUG':
            drawWaterJugItem(ctx);
            break;
          case 'COWCATCHER':
            drawCowcatcherItem(ctx);
            break;
        }

        ctx.restore();
      });
    };

    // Drawing helpers for Obstacles
    const drawWoodBarricadeShape = (ctx: CanvasRenderingContext2D) => {
      // Wood cross barricade logs with hazard colors
      ctx.fillStyle = '#9b6c43'; // rich brown
      ctx.strokeStyle = '#432610';
      ctx.lineWidth = 4;
      
      // Left leg
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(-12, -45);
      ctx.lineTo(-3, -45);
      ctx.lineTo(-15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right leg
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(3, -45);
      ctx.lineTo(12, -45);
      ctx.lineTo(25, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Main cross banner
      ctx.fillStyle = '#cf9922'; // bright post-apocalyptic yellow/orange hazard block
      ctx.fillRect(-38, -38, 76, 14);
      ctx.strokeRect(-38, -38, 76, 14);

      // Black zebra stripes
      ctx.fillStyle = '#221e1d';
      for (let i = -30; i < 40; i += 18) {
        ctx.beginPath();
        ctx.moveTo(i, -38);
        ctx.lineTo(i + 10, -38);
        ctx.lineTo(i, -24);
        ctx.lineTo(i - 10, -24);
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawScrapCarShape = (ctx: CanvasRenderingContext2D) => {
      // Squashed post-apocalyptic rusted vehicle wreckage
      ctx.fillStyle = '#aa3a22'; // rust red-orange body paint
      ctx.strokeStyle = '#311005';
      ctx.lineWidth = 4.5;

      // Car body chassis
      ctx.beginPath();
      ctx.moveTo(-45, 0);
      ctx.bezierCurveTo(-45, -30, -35, -35, -25, -35); // trunk
      ctx.lineTo(15, -35);
      ctx.bezierCurveTo(35, -35, 45, -25, 45, 0); // front
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ruined glass window box
      ctx.fillStyle = '#433431'; // dark empty window holes
      ctx.fillRect(-15, -30, 20, 10);
      ctx.strokeRect(-15, -30, 20, 10);

      // Rusty plates patches
      ctx.fillStyle = '#ab7c5c';
      ctx.fillRect(8, -18, 16, 8);
      ctx.strokeRect(8, -18, 16, 8);

      // Smashed tires
      ctx.fillStyle = '#1e1c1b';
      ctx.beginPath();
      ctx.arc(-26, 0, 12, 0, Math.PI, true);
      ctx.arc(22, 0, 12, 0, Math.PI, true);
      ctx.fill();
    };

    const drawIronGirderShape = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#4c4240'; // gunmetal steel
      ctx.strokeStyle = '#231d1c';
      ctx.lineWidth = 4.5;

      // Draw standard concrete block stands
      ctx.fillStyle = '#8f8c85';
      ctx.fillRect(-35, -12, 14, 12);
      ctx.strokeRect(-35, -12, 14, 12);
      ctx.fillRect(21, -12, 14, 12);
      ctx.strokeRect(21, -12, 14, 12);

      // Draw massive rust I-Beam girder
      ctx.fillStyle = '#a6543b'; // reddish rust oxide primer
      ctx.fillRect(-45, -28, 90, 16);
      ctx.strokeRect(-45, -28, 90, 16);

      // Inner flange grooves
      ctx.fillStyle = '#7a311c';
      ctx.fillRect(-40, -24, 80, 8);
    };

    const drawConcreteObstacleShape = (ctx: CanvasRenderingContext2D) => {
      // Concrete lane barricade (extremely heavy structure, DODGE)
      ctx.fillStyle = '#bcbaac'; // weathered cement
      ctx.strokeStyle = '#3f3c3a';
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.moveTo(-35, 0);
      ctx.lineTo(-24, -48);
      ctx.lineTo(24, -48);
      ctx.lineTo(35, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yellow/Black diagonal stripes across structural center
      ctx.fillStyle = '#d0891d';
      ctx.fillRect(-15, -38, 30, 22);

      ctx.fillStyle = '#221a11';
      ctx.beginPath();
      ctx.moveTo(-10, -38);
      ctx.lineTo(-2, -38);
      ctx.lineTo(-12, -16);
      ctx.lineTo(-20, -16);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(5, -38);
      ctx.lineTo(13, -38);
      ctx.lineTo(3, -16);
      ctx.lineTo(-5, -16);
      ctx.closePath();
      ctx.fill();

      // Crumbling concrete cracks details
      ctx.strokeStyle = '#514c47';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, -40);
      ctx.lineTo(-18, -25);
      ctx.lineTo(-24, -18);
      ctx.stroke();
    };

    const drawMineObstacleShape = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      
      // Dirt mound around landmine
      ctx.fillStyle = '#65422a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Spiked metal plate mine body
      ctx.fillStyle = '#31333a';
      ctx.strokeStyle = '#181a20';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -3, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Red flashing trigger light
      const isRed = Math.floor(Date.now() / 250) % 2 === 0;
      ctx.fillStyle = isRed ? '#ff0000' : '#410202';
      ctx.shadowColor = isRed ? '#ff0000' : 'transparent';
      ctx.shadowBlur = isRed ? 8 : 0;
      
      ctx.beginPath();
      ctx.arc(0, -6, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawSpikedWallShape = (ctx: CanvasRenderingContext2D) => {
      // Iron fence with giant spikes (DODGE)
      ctx.fillStyle = '#2a2624';
      ctx.strokeStyle = '#110f0e';
      ctx.lineWidth = 4;

      // Bottom base block
      ctx.fillRect(-32, -10, 64, 10);
      ctx.strokeRect(-32, -10, 64, 10);

      // Steel vertical railings
      ctx.fillStyle = '#444c5a';
      for (let offset = -20; offset <= 20; offset += 10) {
        ctx.fillRect(offset - 2, -40, 4, 30);
        // Spiked arrows tip
        ctx.beginPath();
        ctx.moveTo(offset - 6, -40);
        ctx.lineTo(offset, -54);
        ctx.lineTo(offset + 6, -40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Connecting horizontal beam
      ctx.fillRect(-28, -32, 56, 5);
      ctx.strokeRect(-28, -32, 56, 5);
    };

    const drawWaterJugItem = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      
      // Soft hover bounce animation
      const hoverHeight = Math.sin(Date.now() * 0.006) * 5 - 15;
      ctx.translate(0, hoverHeight);

      // Glowing blue aura circles behind jug
      const glowGrad = ctx.createRadialGradient(0, -10, 2, 0, -10, 22);
      glowGrad.addColorStop(0, 'rgba(82, 192, 255, 0.5)');
      glowGrad.addColorStop(1, 'rgba(82, 192, 255, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, -10, 25, 0, Math.PI * 2);
      ctx.fill();

      // Transparent drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 15 - hoverHeight, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Blue industrial water cooler canister container
      ctx.fillStyle = '#148ad5';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      // Canister core barrel
      ctx.beginPath();
      ctx.moveTo(-12, 5);
      ctx.lineTo(-12, -18);
      ctx.quadraticCurveTo(-12, -26, -5, -26);
      ctx.lineTo(-5, -32); // neck caps
      ctx.lineTo(5, -32);
      ctx.lineTo(5, -26);
      ctx.quadraticCurveTo(12, -26, 12, -18);
      ctx.lineTo(12, 5);
      ctx.quadraticCurveTo(12, 11, 0, 11);
      ctx.quadraticCurveTo(-12, 11, -12, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // White water droplets icon printed on front
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(-6, -6, 0, -3);
      ctx.quadraticCurveTo(6, -6, 0, -14);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawCowcatcherItem = (ctx: CanvasRenderingContext2D) => {
      ctx.save();

      const hoverHeight = Math.sin(Date.now() * 0.008) * 4 - 15;
      ctx.translate(0, hoverHeight);

      // Fire spark aura
      const auraGrad = ctx.createRadialGradient(0, -10, 2, 0, -10, 26);
      auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
      auraGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, -10, 28, 0, Math.PI * 2);
      ctx.fill();

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 15 - hoverHeight, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden spiked metal cowcatcher wedge item
      ctx.fillStyle = '#e8a914'; // bright steel-gold alloy
      ctx.strokeStyle = '#4e3305';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(-12, -24);
      ctx.lineTo(0, -12); // wedge dip
      ctx.lineTo(12, -24);
      ctx.lineTo(24, 0);
      ctx.lineTo(0, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front bumper spikes
      ctx.fillStyle = '#ffdf4c';
      const spikeX = [-18, -6, 6, 18];
      spikeX.forEach((xPos) => {
        ctx.beginPath();
        ctx.moveTo(xPos - 3, -1);
        ctx.lineTo(xPos, 8);
        ctx.lineTo(xPos + 3, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    };

    // Draw active particle clouds
    const drawParticles = (ctx: CanvasRenderingContext2D) => {
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === 'line') {
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(12, 0);
          ctx.stroke();
        }

        ctx.restore();
      });
    };

    // Draw player's diesel truck
    const drawPlayerTruck = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const state = stateRef.current;
      const truckLaneX = state.truckX;
      
      // Find perspective projected point for deep player foreground depth y = 0.85
      const proj = projectPoint(w, h, truckLaneX, 0.85);

      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.scale(proj.scale * 1.35, proj.scale * 1.35); // slightly larger core presence

      // 1. Draw armored tires
      ctx.fillStyle = '#111111';
      ctx.strokeStyle = '#272524';
      ctx.lineWidth = 3;
      
      // Left front wheel
      ctx.fillRect(-28, -20, 10, 22);
      ctx.strokeRect(-28, -20, 10, 22);
      // Right front wheel
      ctx.fillRect(18, -20, 10, 22);
      ctx.strokeRect(18, -20, 10, 22);
      // Left back wheels (heavy double axles)
      ctx.fillRect(-30, 10, 11, 26);
      ctx.strokeRect(-30, 10, 11, 26);
      // Right back wheels (heavy double axles)
      ctx.fillRect(19, 10, 11, 26);
      ctx.strokeRect(19, 10, 11, 26);

      // Tire tread details
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-28, -10); ctx.lineTo(-18, -10);
      ctx.moveTo(18, -10); ctx.lineTo(28, -10);
      ctx.moveTo(-30, 20); ctx.lineTo(-19, 20);
      ctx.moveTo(19, 20); ctx.lineTo(30, 20);
      ctx.stroke();

      // 2. Armored flatbed body frame (rusted metal grey-brown)
      ctx.fillStyle = '#3c3532'; // heavy dark frame
      ctx.strokeStyle = '#18110f';
      ctx.lineWidth = 4.5;
      
      ctx.beginPath();
      ctx.moveTo(-22, -26);
      ctx.lineTo(22, -26);
      ctx.lineTo(24, 38);
      ctx.lineTo(-24, 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner rusty wooden floor of flatbed
      ctx.fillStyle = '#593a27'; // muddy red wood planks
      ctx.fillRect(-17, -10, 34, 42);
      
      // Plank lines
      ctx.strokeStyle = '#2d1607';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -10); ctx.lineTo(-9, 32);
      ctx.moveTo(0, -10); ctx.lineTo(0, 32);
      ctx.moveTo(9, -10); ctx.lineTo(9, 32);
      ctx.stroke();

      // Scraps carrying on bed (scrap points filled visually)
      const collectedPercent = Math.min(1.0, state.scrap / 12000);
      if (collectedPercent > 0.1) {
        ctx.fillStyle = '#6e7a83'; // random steel junk boxes
        ctx.strokeStyle = '#3d454a';
        ctx.lineWidth = 2;
        ctx.fillRect(-12 * collectedPercent, 0, 12 * collectedPercent, 14);
        ctx.strokeRect(-12 * collectedPercent, 0, 12 * collectedPercent, 14);
      }
      if (collectedPercent > 0.4) {
        ctx.fillStyle = '#a16544'; // pile of rusty iron scrap pipes
        ctx.beginPath();
        ctx.arc(6, 12, 5, 0, Math.PI * 2);
        ctx.arc(10, 18, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Driver's Cabin Hood (Diesel Nose)
      ctx.fillStyle = '#544743'; // rugged dark clay grey
      ctx.fillRect(-18, -48, 36, 26);
      ctx.strokeRect(-18, -48, 36, 26);

      // Cabin windshield glass (narrow steel slit visor look)
      ctx.fillStyle = '#22222c';
      ctx.strokeRect(-14, -38, 28, 8);
      ctx.fillRect(-14, -38, 28, 8);
      
      // Steel horizontal protective window bars
      ctx.strokeStyle = '#948a87';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -34); ctx.lineTo(14, -34);
      ctx.stroke();

      // Dual upright side exhaust smokestacks
      ctx.fillStyle = '#1e1a19';
      // Left pipe
      ctx.fillRect(-22, -44, 4, 18);
      ctx.strokeRect(-22, -44, 4, 18);
      // Right pipe
      ctx.fillRect(18, -44, 4, 18);
      ctx.strokeRect(18, -44, 4, 18);

      // 4. Front steel engine grill mesh
      ctx.fillStyle = '#221917';
      ctx.fillRect(-15, -57, 30, 9);
      ctx.strokeRect(-15, -57, 30, 9);

      // Grill vertical lines
      ctx.strokeStyle = '#7c6561';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10, -57); ctx.lineTo(-10, -48);
      ctx.moveTo(-5, -57);  ctx.lineTo(-5, -48);
      ctx.moveTo(0, -57);   ctx.lineTo(0, -48);
      ctx.moveTo(5, -57);   ctx.lineTo(5, -48);
      ctx.moveTo(10, -57);  ctx.lineTo(10, -48);
      ctx.stroke();

      // 5. Armored Steel Spiked Bumper / Standard Cowcatcher
      const cowcatcherTimer = state.cowcatcherTimer;
      const isPowerupShieldActive = cowcatcherTimer > 0;
      
      if (isPowerupShieldActive) {
        // ENHANCED REINFORCED COWCATCHER ACTIVE (Bright flashing shield effect)
        const isBlink = Math.floor(Date.now() / 150) % 2 === 0;
        ctx.fillStyle = isBlink ? '#ffce29' : '#d1a011';
        ctx.strokeStyle = '#f8f9fc';
        ctx.lineWidth = 3.5;

        // Giant delta shovel head shapes
        ctx.beginPath();
        ctx.moveTo(-34, -54);
        ctx.lineTo(-14, -72);
        ctx.lineTo(0, -62); // central wedge split
        ctx.lineTo(14, -72);
        ctx.lineTo(34, -54);
        ctx.lineTo(0, -55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Massive forward spikes
        ctx.fillStyle = '#ffeaa1';
        const spikes = [-26, -14, 0, 14, 26];
        spikes.forEach((spikeX) => {
          ctx.beginPath();
          ctx.moveTo(spikeX - 4, -58);
          ctx.lineTo(spikeX, -81);
          ctx.lineTo(spikeX + 4, -58);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });

        // Flash glowing energy sparks aura rings
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, -66, 38 + Math.sin(Date.now() * 0.02) * 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // STANDARD grinding industrial spiked bar
        ctx.fillStyle = '#6b5e58'; // iron grey steel plate
        ctx.strokeStyle = '#27201d';
        ctx.lineWidth = 3.5;

        ctx.fillRect(-28, -58, 56, 7);
        ctx.strokeRect(-28, -58, 56, 7);

        // Small steel spikes along the front bumper
        ctx.fillStyle = '#9b8e88';
        const flatSpikes = [-22, -12, -2, 8, 18];
        flatSpikes.forEach((sX) => {
          ctx.beginPath();
          ctx.moveTo(sX - 3, -58);
          ctx.lineTo(sX, -69); // forward-pointing spikes
          ctx.lineTo(sX + 3, -58);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }

      // 6. Beaming Headlight cones (highly dramatic at night or in storm!)
      // Night or evening or dust storm triggers glowing bright beams
      const t = state.dayTime;
      const isNight = t > 0.65 || t < 0.1;
      const isStorm = state.isDustStorm;

      if (isNight || isStorm) {
        const beamStrength = isNight ? (t > 0.75 || t < 0.05 ? 0.8 : 0.5) : 0.4;
        const finalAlpha = Math.min(0.9, beamStrength + (state.stormIntensity * 0.4));

        ctx.save();
        // Reset scale/rotation to draw massive world beams extending forward
        ctx.restore(); // pop outer state
        ctx.save(); // push coordinates again without inner scale
        
        ctx.translate(proj.x, proj.y);
        ctx.scale(proj.scale, proj.scale);

        // Left Headlight Cone
        const beamLength = 300 * proj.scale;
        const leftHLight = ctx.createLinearGradient(-12, -54, -40 * proj.scale, -beamLength);
        leftHLight.addColorStop(0, `rgba(255, 240, 200, ${finalAlpha})`);
        leftHLight.addColorStop(0.2, `rgba(255, 240, 200, ${finalAlpha * 0.55})`);
        leftHLight.addColorStop(1, 'rgba(255, 230, 180, 0)');
        
        ctx.fillStyle = leftHLight;
        ctx.beginPath();
        ctx.moveTo(-15, -54);
        ctx.lineTo(-45, -54);
        ctx.lineTo(-120 * proj.scale, -beamLength);
        ctx.lineTo(40 * proj.scale, -beamLength);
        ctx.closePath();
        ctx.fill();

        // Right Headlight Cone
        const rightHLight = ctx.createLinearGradient(12, -54, 40 * proj.scale, -beamLength);
        rightHLight.addColorStop(0, `rgba(255, 240, 200, ${finalAlpha})`);
        rightHLight.addColorStop(0.2, `rgba(255, 240, 200, ${finalAlpha * 0.55})`);
        rightHLight.addColorStop(1, 'rgba(255, 230, 180, 0)');

        ctx.fillStyle = rightHLight;
        ctx.beginPath();
        ctx.moveTo(15, -54);
        ctx.lineTo(45, -54);
        ctx.lineTo(-40 * proj.scale, -beamLength);
        ctx.lineTo(120 * proj.scale, -beamLength);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.scale(proj.scale * 1.35, proj.scale * 1.35); // restore local canvas matrices

        // Glowing small headlight flares on truck front
        ctx.shadowColor = '#fff0bd';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-11, -54, 3, 0, Math.PI * 2);
        ctx.arc(11, -54, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawOverlayWeatherStormEffects = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const state = stateRef.current;
      
      // Periodically throw dust particles across screen during sandstorms
      if (state.isDustStorm || state.stormIntensity > 0.05) {
        // Reddish sandstorm dust fog overlay
        const fogAlpha = state.stormIntensity * 0.35;
        ctx.fillStyle = `rgba(184, 114, 60, ${fogAlpha})`;
        ctx.fillRect(0, 0, w, h);

        // Render driving wind-blown dust line streaks
        const streakCount = Math.floor(state.stormIntensity * 12);
        ctx.strokeStyle = `rgba(235, 180, 120, ${state.stormIntensity * 0.5})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < streakCount; i++) {
          const sy = (Math.sin(Date.now() * 0.0012 + i * 23.4) * 0.5 + 0.5) * h;
          const sx = ((Date.now() * 0.22 + i * 115) % (w + 200)) - 100;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 50 + Math.random() * 80, sy + 5 + Math.random() * 10);
          ctx.stroke();
        }
      }
    };

    // Helper to blend two hex color channels
    const blendColors = (c1: string, c2: string, ratio: number) => {
      if (c1.startsWith('rgba') || c2.startsWith('rgba')) return c1; // bail if too complex
      const rgb1 = hexToRgb(c1);
      const rgb2 = hexToRgb(c2);
      if (!rgb1 || !rgb2) return c1;
      
      const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
      const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
      const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);
      
      return `rgb(${r}, ${g}, ${b})`;
    };

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
    };

    // Start request animation loop
    frameIdRef.current = requestAnimationFrame(updateGame);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, []);

  return (
    <div id="game_container" ref={containerRef} className="relative w-full h-full bg-stone-950 overflow-hidden">
      <audio id="engine_audio_element" style={{ display: 'none' }} />
      <canvas id="game_canvas" ref={canvasRef} className="block w-full h-full cursor-none object-cover" />
    </div>
  );
};
