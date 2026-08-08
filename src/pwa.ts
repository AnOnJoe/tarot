/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'

/** Une heure : au-delà, une partie du soir chez des joueurs différents reste à jour. */
const CHECK_INTERVAL = 60 * 60 * 1000

/**
 * Enregistre le service worker et fait en sorte que l'application se mette réellement à
 * jour d'elle-même.
 *
 * L'enregistrement par défaut ne suffit pas sur iOS : une application installée sur
 * l'écran d'accueil est *reprise* plutôt que rechargée, si bien qu'aucune navigation ne
 * déclenche jamais de recherche de nouvelle version — l'ancienne peut tenir indéfiniment.
 *
 * On s'en remet donc à trois déclencheurs : un contrôle au retour au premier plan, un
 * contrôle périodique, et un rechargement dès qu'un nouveau service worker prend la main.
 */
export function setupUpdates(): void {
  if (!('serviceWorker' in navigator)) return

  /*
   * `controllerchange` signale qu'un service worker vient de prendre le contrôle. Deux cas
   * très différents se cachent derrière :
   *
   * - toute première visite : il n'y avait aucun contrôleur, la page a été servie par le
   *   réseau et elle est déjà à jour — la recharger n'apporterait qu'un clignotement ;
   * - remplacement : un ancien contrôleur cède la place, la page tourne encore sur les
   *   anciens fichiers et doit être relue.
   *
   * Seul le second justifie un rechargement.
   */
  const hadController = navigator.serviceWorker.controller !== null
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return

      const check = () => {
        if (document.visibilityState === 'visible') registration.update()
      }

      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
      setInterval(check, CHECK_INTERVAL)
    },
  })
}
