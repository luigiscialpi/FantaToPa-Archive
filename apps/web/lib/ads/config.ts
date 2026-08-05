// Config centralizzata annunci (Google AdSense — AdMob non ha un SDK per il
// web, vedi commento in AGENTS.md/sessione). Gli slot non sono ancora stati
// creati in AdSense: finché le env var restano vuote, i componenti ads
// renderizzano `null` invece di mostrare uno slot vuoto/rotto.
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
export const ADSENSE_SLOT_BANNER = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER;
export const ADSENSE_SLOT_REWARD = process.env.NEXT_PUBLIC_ADSENSE_SLOT_REWARD;

export function adsEnabled(): boolean {
  return Boolean(ADSENSE_CLIENT_ID);
}
