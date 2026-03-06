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
 *   Scene 2 (Problem):       150–419   (~9s)
 *   Scene 3 (App Demo):      420–869   (~15s)  ← Hero scene
 *   Scene 4 (Intelligence):  870–1079  (~7s)   ← Node graph system diagram
 *   Scene 5 (Features):      1080–1319 (~8s)
 *   Scene 6 (Arch):          1320–1559 (~8s)
 *   Scene 7 (Outro):         1560–1724 (~5.5s)
 *
 * Total: 1725 frames = 57.5 seconds @ 30fps
 */

const FPS = 30;

const scenes = [
  { component: TitleCard, from: 0, duration: 150, name: 'Title Card' },
  { component: ProblemStatement, from: 150, duration: 270, name: 'Problem Statement' },
  { component: AppDemo, from: 420, duration: 450, name: 'App Demo' },
  { component: Intelligence, from: 870, duration: 210, name: 'Built-in Intelligence' },
  { component: FeatureShowcase, from: 1080, duration: 240, name: 'Feature Showcase' },
  { component: Architecture, from: 1320, duration: 240, name: 'Architecture' },
  { component: Outro, from: 1560, duration: 165, name: 'Outro' },
] as const;

export const PROMO_DURATION = 1725;
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
