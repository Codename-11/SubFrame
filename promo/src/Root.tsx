import { Composition } from 'remotion';
import { Promo, PROMO_DURATION, PROMO_FPS } from './Promo';
import { TitleCard } from './scenes/TitleCard';
import { ProblemStatement } from './scenes/ProblemStatement';
import { AppDemo } from './scenes/AppDemo';
import { Intelligence } from './scenes/Intelligence';
import { FeatureShowcase } from './scenes/FeatureShowcase';
import { Architecture } from './scenes/Architecture';
import { Outro } from './scenes/Outro';

/**
 * Remotion Root — registers all compositions for the Studio.
 * The main "Promo" comp is the full video; individual scenes
 * are also registered for isolated previewing.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={Promo}
        durationInFrames={PROMO_DURATION}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />

      {/* Individual scene previews */}
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={150}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="ProblemStatement"
        component={ProblemStatement}
        durationInFrames={435}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AppDemo"
        component={AppDemo}
        durationInFrames={540}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Intelligence"
        component={Intelligence}
        durationInFrames={210}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="FeatureShowcase"
        component={FeatureShowcase}
        durationInFrames={240}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Architecture"
        component={Architecture}
        durationInFrames={270}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Outro"
        component={Outro}
        durationInFrames={165}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
