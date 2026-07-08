const mapNomodStatus = (status) => {
  if (!status) return 'Pending';
  const s = status.toUpperCase();
  if (s === 'PENDING') return 'Pending';
  if (s === 'COMPLETED' || s === 'PAID') return 'Paid';
  if (s === 'FAILED') return 'Failed';
  if (s === 'EXPIRED') return 'Expired';
  if (s === 'CANCELLED') return 'Cancelled';
  return 'Pending'; // Default fallback for unknown status
};

const nomodService = {
  /**
   * Fetch Nomod checkout status and normalize the response with production-ready error mapping.
   * Supports sandbox mock for LNK-* checkoutIds.
   * @param {string} checkoutId 
   * @param {string} apiKey 
   * @returns {Promise<Object>} Normalized status response
   */
  async getCheckoutStatus(checkoutId, apiKey) {
    // Sandbox / Mock Handling
    if (!checkoutId || checkoutId.startsWith('LNK-')) {
      console.log(`[nomodService] [INFO] Mocking status for sandbox checkout ID: ${checkoutId}`);
      return {
        success: true,
        status: 'Paid',
        paidAt: new Date().toISOString(),
        transactionReference: 'MOCK-TXN-REF',
        rawData: { status: 'COMPLETED', reference_id: checkoutId }
      };
    }

    if (!apiKey) {
      return {
        success: false,
        status: 'Pending',
        errorType: 'unauthorized',
        error: "Nomod API key is missing. Please configure it in Settings."
      };
    }

    try {
      const response = await fetch(`https://api.nomod.com/v1/checkout/${checkoutId}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        let errorType = 'http_error';
        let status = 'Pending';

        if (response.status === 401) {
          errorType = 'unauthorized';
          status = 'Pending';
        } else if (response.status === 404) {
          errorType = 'notFound';
          status = 'Failed'; // Map 404 to Failed as per requirement
        }

        return {
          success: false,
          status,
          errorType,
          error: `Nomod Status API failed (HTTP ${response.status}): ${text}`
        };
      }

      const data = await response.json();
      const status = mapNomodStatus(data.status);
      
      let paidAt = null;
      let transactionReference = null;
      if (status === 'Paid') {
        paidAt = new Date().toISOString();
        if (data.transactions && data.transactions.length > 0) {
          const mainTxn = data.transactions[0];
          paidAt = mainTxn.created_at || paidAt;
          transactionReference = mainTxn.id || null;
        }
      }

      return {
        success: true,
        status,
        paidAt,
        transactionReference,
        rawData: data
      };
    } catch (err) {
      // Determine if it looks like a timeout or DNS resolution failure
      const isTimeout = err.name === 'AbortError' || err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('abort');
      return {
        success: false,
        status: 'Pending',
        errorType: isTimeout ? 'timeout' : 'network',
        error: err.message || "Network request failed"
      };
    }
  }
};

module.exports = nomodService;
