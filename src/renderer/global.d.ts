/** Global window augmentations for SubFrame renderer */

interface Window {
  /** Dismiss the index.html loading overlay — called by React after first render */
  __dismissLoadingScreen?: () => void;
}
