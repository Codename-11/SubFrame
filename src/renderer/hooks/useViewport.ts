/**
 * Responsive viewport hook for mobile/tablet/desktop detection.
 * Only active in web mode — Electron always reports 'desktop'.
 */
import { useState, useEffect } from 'react';
import { getTransport } from '../lib/transportProvider';

export function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  const isWeb = !getTransport().platform.isElectron;

  useEffect(() => {
    if (!isWeb) return; // Don't add resize listener in Electron
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isWeb]);

  return {
    isMobile: isWeb && width < 768,
    isTablet: isWeb && width >= 768 && width < 1024,
    isDesktop: !isWeb || width >= 1024,
    isWeb,
    width,
  };
}
