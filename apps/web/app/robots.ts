import type { MetadataRoute } from 'next';

// Nessun `Disallow`, apposta: a tenere l'archivio fuori dai motori di ricerca
// è il `noindex` del layout radice, e un crawler bloccato qui non arriverebbe
// mai a leggerlo (indicizzerebbe comunque l'URL nudo, se lo trova altrove).
// Lasciar passare i bot serve anche alle anteprime dei link nelle chat.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
  };
}
