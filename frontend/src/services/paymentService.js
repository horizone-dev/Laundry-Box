const listeners = new Set();

// Register global listener for status changes from main process
if (window.electronAPI && window.electronAPI.onPaymentStatusChanged) {
  window.electronAPI.onPaymentStatusChanged((data) => {
    // Dispatch custom event for backward compatibility (used in POS.jsx, Orders.jsx, Settlement.jsx)
    if (data.status === 'Paid') {
      console.log(`[paymentService] Dispatching nomod-payment-success event for order ${data.orderId}`);
      window.dispatchEvent(new CustomEvent('nomod-payment-success', { 
        detail: { 
          orderId: data.orderId, 
          checkoutId: data.checkoutId,
          customerId: data.customerId
        } 
      }));
    }

    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error("[paymentService] Callback subscription error:", err);
      }
    });
  });
}

export const paymentService = {
  /**
   * Starts tracking status of a checkout session.
   * @param {string} orderId 
   * @param {string} checkoutId 
   */
  startTracking(orderId, checkoutId) {
    if (window.electronAPI && window.electronAPI.startPaymentTracking) {
      window.electronAPI.startPaymentTracking({ orderId, checkoutId });
    } else {
      console.warn("[paymentService] startPaymentTracking not available in this environment.");
    }
  },

  /**
   * Stops tracking status of a checkout session.
   * @param {string} orderId 
   */
  stopTracking(orderId) {
    if (window.electronAPI && window.electronAPI.stopPaymentTracking) {
      window.electronAPI.stopPaymentTracking({ orderId });
    } else {
      console.warn("[paymentService] stopPaymentTracking not available in this environment.");
    }
  },

  /**
   * Manually triggers an immediate status check.
   * @param {string} orderId 
   * @param {string} checkoutId 
   * @returns {Promise<Object>} Status check result
   */
  async checkNow(orderId, checkoutId) {
    if (window.electronAPI && window.electronAPI.checkPaymentStatusNow) {
      return await window.electronAPI.checkPaymentStatusNow({ orderId, checkoutId });
    } else {
      console.warn("[paymentService] checkPaymentStatusNow not available in this environment.");
      return { success: false, error: "Electron API not available" };
    }
  },

  /**
   * Subscribes to payment status changed events.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }
};
