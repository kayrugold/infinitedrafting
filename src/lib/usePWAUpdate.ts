import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error' | 'frozen'>('idle');
  const [freezeUpdates, _setFreezeUpdates] = useState<boolean>(() => {
    try {
      return localStorage.getItem('infinite_drafting_freeze_updates') === 'true';
    } catch {
      return false;
    }
  });

  const [activeVersion, _setActiveVersion] = useState<'v1.1.0' | 'v1.0.0'>(() => {
    try {
      const saved = localStorage.getItem('infinite_drafting_active_version');
      return (saved === 'v1.0.0' || saved === 'v1.1.0') ? saved : 'v1.1.0';
    } catch {
      return 'v1.1.0';
    }
  });

  const setFreezeUpdates = (val: boolean) => {
    _setFreezeUpdates(val);
    try {
      localStorage.setItem('infinite_drafting_freeze_updates', val ? 'true' : 'false');
    } catch {}
    if (val) {
      setUpdateStatus('frozen');
    } else {
      setUpdateStatus('idle');
    }
  };

  const setActiveVersion = (ver: 'v1.1.0' | 'v1.0.0') => {
    _setActiveVersion(ver);
    try {
      localStorage.setItem('infinite_drafting_active_version', ver);
    } catch {}
    // Trigger a window reload to apply the chosen version's engine rules cleanly
    window.location.reload();
  };

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered for update prompting:', r);
      if (r) {
        // Automatically check for updates every 15 minutes unless updates are frozen
        const intervalId = setInterval(() => {
          const isFrozen = localStorage.getItem('infinite_drafting_freeze_updates') === 'true';
          if (isFrozen) return; // Do not poll if updates are frozen
          r.update().catch(err => console.error('Background SW update check failed:', err));
        }, 15 * 60 * 1000);
        return () => clearInterval(intervalId);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    }
  });

  // Automatically switch status to 'available' when a service worker update is registered/waiting
  useEffect(() => {
    if (needRefresh) {
      if (freezeUpdates) {
        // Silently clear/skip if updates are frozen so the user is never prompted
        setNeedRefresh(false);
        return;
      }
      setUpdateStatus('available');
    }
  }, [needRefresh, freezeUpdates, setNeedRefresh]);

  const checkForUpdates = async () => {
    if (freezeUpdates) {
      setUpdateStatus('frozen');
      setTimeout(() => setUpdateStatus('frozen'), 3000);
      return;
    }

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
    if (freezeUpdates) return; // Block updates if locked
    // Reloads and activates the new Service Worker containing our latest release bundle
    updateServiceWorker(true);
  };

  return {
    needRefresh: freezeUpdates ? false : needRefresh,
    offlineReady,
    updateStatus: freezeUpdates ? 'frozen' : updateStatus,
    checkForUpdates,
    applyUpdate,
    freezeUpdates,
    setFreezeUpdates,
    activeVersion,
    setActiveVersion
  };
}
