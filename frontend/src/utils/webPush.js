import React, { useEffect } from 'react';
import api from '../api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const useWebPush = () => {
  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe the user
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Send subscription to backend
      await api.post('/webpush/save_information', {
        subscription: subscription.toJSON(),
        browser: getBrowserName(),
        status: 'true'
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  };

  return { subscribeToPush };
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getBrowserName() {
  const agent = window.navigator.userAgent.toLowerCase();
  if (agent.indexOf('edge') > -1) return 'edge';
  if (agent.indexOf('edg/') > -1) return 'edge';
  if (agent.indexOf('chrome') > -1) return 'chrome';
  if (agent.indexOf('firefox') > -1) return 'firefox';
  if (agent.indexOf('safari') > -1) return 'safari';
  return 'unknown';
}
