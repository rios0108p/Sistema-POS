/**
 * networkMonitor.js — Real connectivity monitor for TENDO-POS
 * 
 * NOT using navigator.onLine alone (that only detects the router, not real internet).
 * Instead, pings the VPS health endpoint every 30 seconds.
 * 
 * Triggers automatic sync when transitioning from offline → online.
 */

const VPS_HEALTH_URL = 'https://tendopos.cloud/api/health';
const CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT = 3000; // 3 seconds

class NetworkMonitor {
  constructor() {
    this.isOnline = true;
    this.lastCheck = null;
    this.listeners = new Map();
    this.intervalId = null;
  }

  /**
   * Check real connectivity by pinging our VPS
   * navigator.onLine only detects the router, not actual internet
   */
  async checkRealConnectivity() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(VPS_HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      this.lastCheck = new Date();
      return response.ok;
    } catch {
      this.lastCheck = new Date();
      return false;
    }
  }

  /**
   * Start monitoring connectivity
   */
  start() {
    if (this.intervalId) return;

    const check = async () => {
      const wasOnline = this.isOnline;
      this.isOnline = await this.checkRealConnectivity();

      // Detect transition
      if (this.isOnline !== wasOnline) {
        this.emit('status-change', { isOnline: this.isOnline, wasOnline });

        if (this.isOnline && !wasOnline) {
          this.emit('reconnected');
        } else if (!this.isOnline && wasOnline) {
          this.emit('disconnected');
        }
      }
    };

    check(); // Initial check
    this.intervalId = setInterval(check, CHECK_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Event system
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  off(event, fn) {
    const handlers = this.listeners.get(event) || [];
    this.listeners.set(event, handlers.filter(h => h !== fn));
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(fn => fn(data));
  }
}

// Singleton
const networkMonitor = new NetworkMonitor();

module.exports = { networkMonitor, NetworkMonitor };
