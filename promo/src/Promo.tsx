import { AbsoluteFill, Sequence } from 'remotion';
import { TitleCard } from './scenes/TitleCard';
import { ProblemStatement } from './scenes/ProblemStatement';
import { AppDemo } from './scenes/AppDemo';
import { Intelligence } from './scenes/Intelligence';
import { FeatureShowcase } from './scenes/FeatureShowcase';
import { Architecture } from './scenes/Architecture';
import { Outro } from './scenes/Outro';
import { colors } from './theme';

/**
 * Root <Promo> composition — sequences all 7 scenes.
 *
 * At 30fps:
 *   Scene 1 (Title):         0–149     (~5s)
 *   Scene 2 (Problem):       150–584   (~14.5s) ← paced typing + red shifts + fade out
 *   Scene 3 (App Demo):      585–1124  (~18s)   ← Hero scene (extended for grid + workspace)
 *   Scene 4 (Intelligence):  1125–1334 (~7s)    ← Node graph system diagram
 *   Scene 5 (Features):      1335–1574 (~8s)
 *   Scene 6 (Arch):          1575–1844 (~9s)   ← extended for reading time
 *   Scene 7 (Outro):         1845–2009 (~5.5s)
 *
 * Total: 2010 frames = 67 seconds @ 30fps
 */

const FPS = 30;

const scenes = [
  { component: TitleCard, from: 0, duration: 150, name: 'Title Card' },
  { component: ProblemStatement, from: 150, duration: 435, name: 'Problem Statement' },
  { component: AppDemo, from: 585, duration: 540, name: 'App Demo' },
  { component: Intelligence, from: 1125, duration: 210, name: 'Hooks & Context' },
  { component: FeatureShowcase, from: 1335, duration: 240, name: 'Feature Showcase' },
  { component: Architecture, from: 1575, duration: 270, name: 'Architecture' },
  { component: Outro, from: 1845, duration: 165, name: 'Outro' },
] as const;

export const PROMO_DURATION = 2010;
export const PROMO_FPS = FPS;

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {scenes.map(({ component: Component, from, duration, name }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration} name={name}>
          <Component />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
