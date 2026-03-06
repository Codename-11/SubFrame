import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { cancelRender, continueRender, delayRender } from 'remotion';

const dmSans = loadDMSans();
const inter = loadInter();
const jetbrains = loadJetBrainsMono();

const waitHandle = delayRender('Loading fonts');

Promise.all([
  dmSans.waitUntilDone(),
  inter.waitUntilDone(),
  jetbrains.waitUntilDone(),
])
  .then(() => continueRender(waitHandle))
  .catch((err) => cancelRender(err));
