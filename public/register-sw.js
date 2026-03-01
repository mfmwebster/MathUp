// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      console.log('MathUp: Service Worker disabled in development (localhost).');
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('MathUp: Service Worker registered successfully:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('MathUp: New version available! Please refresh.');
            }
          });
        });
      })
      .catch((error) => {
        console.error('MathUp: Service Worker registration failed:', error);
      });
  });
}
