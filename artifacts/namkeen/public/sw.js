const CACHE_NAME = "supplygrid-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.png",
  "/supplygrid-logo.png",
  "/logo.png",
  "/sounds/notification-bell.mp3",
  "/manifest.json"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Safe fallback if some assets are not immediately loadable during setup
        console.warn("Some assets could not be pre-cached, continuing install...");
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background Sync Listener
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background Sync tag:", event.tag);
  if (event.tag === "order-sync") {
    event.waitUntil(
      self.registration.showNotification("New Order Received!", {
        body: "A retail store just placed a new wholesale order on SupplyGrid.",
        icon: "/logo.png",
        badge: "/logo.png"
      })
    );
  }
});

// Push Notification Listener
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push event received:", event);
  let payload = {
    title: "New Order Received!",
    body: "A retail store just placed a new wholesale order on SupplyGrid.",
    icon: "/logo.png"
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: "/logo.png",
      vibrate: [200, 100, 200]
    })
  );
});

// Message Listener
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || "New Order Received!", {
      body: payload.body || "A retail store just placed a new wholesale order on SupplyGrid.",
      icon: payload.icon || "/logo.png",
      badge: "/logo.png"
    });
  }
});
