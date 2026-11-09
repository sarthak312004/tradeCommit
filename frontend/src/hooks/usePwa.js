import { useSyncExternalStore } from 'react'
import { pwaStore } from '../utils/pwa'

export function usePwa() {
  const snapshot = useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot, pwaStore.getSnapshot)
  const canOfferInstall = !snapshot.isStandalone && !snapshot.isInstalled && (snapshot.canPromptNatively || snapshot.platform.canInstall)
  const showInstallNudge = canOfferInstall && !snapshot.installDismissed

  return {
    ...snapshot,
    canOfferInstall,
    showInstallNudge,
    requestInstall: pwaStore.requestInstall,
    dismissInstallEntry: pwaStore.dismissInstallEntry,
    openInstallDialog: pwaStore.openInstallDialog,
    closeInstallDialog: pwaStore.closeInstallDialog,
    applyUpdate: pwaStore.applyUpdate,
    dismissUpdate: pwaStore.dismissUpdate,
    dismissOffline: pwaStore.dismissOffline,
  }
}
