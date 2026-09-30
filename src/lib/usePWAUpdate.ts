import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered for update prompting:', r);
      if (r) {
        // Automatically check for updates every 15 minutes
        setInterval(() => {
          r.update().catch(err => console.error('Background SW update check failed:', err));
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    }
  });

  // Automatically switch status to 'available' when a service worker update is registered/waiting
  useEffect(() => {
    if (needRefresh) {
      setUpdateStatus('available');
    }
  }, [needRefresh]);

  const checkForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('error');
      return;
    }

    setUpdateStatus('checking');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Query the server for a newer service worker file
        await reg.update();
        
        // Wait a brief moment to let the browser evaluate if there is a new script
        setTimeout(() => {
          if (reg.waiting) {
            setNeedRefresh(true);
            setUpdateStatus('available');
          } else {
            setUpdateStatus('up-to-date');
            setTimeout(() => setUpdateStatus('idle'), 3000);
          }
        }, 1000);
      } else {
        setUpdateStatus('error');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Manual Service Worker update check failed:', err);
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const applyUpdate = () => {
    // Reloads and activates the new Service Worker containing our latest release bundle
    updateServiceWorker(true);
  };

  return {
    needRefresh,
    offlineReady,
    updateStatus,
    checkForUpdates,
    applyUpdate,
  };
}
