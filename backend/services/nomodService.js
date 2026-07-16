const DEBUG_NOMOD = true;

function logNomodRequest(url, method, apiKey, env, body = null) {
  if (!DEBUG_NOMOD) return;
  const apiKeyExists = !!apiKey;
  const maskedKey = apiKeyExists ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'N/A';
  const len = apiKeyExists ? apiKey.length : 0;
  const trimmedLen = apiKeyExists ? apiKey.trim().length : 0;
  const spaces = apiKeyExists ? (apiKey.length !== apiKey.trim().length) : false;
  const hasNewline = apiKeyExists ? (apiKey.includes('\n') || apiKey.includes('\r')) : false;
  
  console.log(`
[NoMOD Service Debug - Request]
Environment: ${env}
API Key Exists: ${apiKeyExists}
API Key Masked: ${maskedKey}
API Key Length: ${len}
API Key Trimmed Length: ${trimmedLen}
Has leading/trailing spaces: ${spaces}
Has newlines: ${hasNewline}
Request URL: ${url}
HTTP Method: ${method}
Headers:
  X-API-KEY: ${maskedKey} (length: ${len})
  Content-Type: application/json
Payload:
${body ? JSON.stringify(body, null, 2) : '{}'}
`);
}

function logNomodResponse(url, status, duration, responseText, headers = {}) {
  if (!DEBUG_NOMOD) return;
  console.log(`
[NoMOD Service Debug - Response]
URL: ${url}
Status: ${status}
Duration: ${duration} ms
Response Headers: ${JSON.stringify(headers, null, 2)}
Response:
${responseText}
`);
}

function logNomodError(err, url, env) {
  if (!DEBUG_NOMOD) return;
  console.error(`
[NoMOD Service Debug - Error]
Request URL: ${url}
Environment: ${env}
Error Name: ${err.name}
Error Message: ${err.message}
Stack Trace:
${err.stack}
`);
}

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

    const chargesUrl = `https://api.nomod.com/v1/charges?link_id=${checkoutId}`;
    const mode = apiKey.startsWith('sk_live') ? 'live' : 'sandbox';

    try {
      if (DEBUG_NOMOD) {
        console.log(`[NoMOD Service Debug - Settings Validation] getCheckoutStatus settings. nomodApiKey exists: ${!!apiKey}, env inferred: ${mode}`);
      }

      // Step 1: Check Charges
      logNomodRequest(chargesUrl, 'GET', apiKey, mode);

      const startTime = Date.now();
      const response = await fetch(chargesUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      const duration = Date.now() - startTime;

      const responseHeaders = {};
      response.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });

      logNomodResponse(chargesUrl, response.status, duration, responseText, responseHeaders);

      if (!response.ok) {
        let errorType = 'http_error';
        let status = 'Pending';

        if (response.status === 401) {
          errorType = 'unauthorized';
          status = 'Pending';
        } else if (response.status === 404) {
          errorType = 'notFound';
          status = 'Failed';
        }

        return {
          success: false,
          status,
          errorType,
          error: `Nomod Charges API failed (HTTP ${response.status}): ${responseText}`
        };
      }

      const data = JSON.parse(responseText);
      const results = data.results || data.data || [];

      if (results.length > 0) {
        const mainTxn = results[0];
        return {
          success: true,
          status: 'Paid',
          paidAt: mainTxn.created_at || new Date().toISOString(),
          transactionReference: mainTxn.id || null,
          rawData: data
        };
      }

      // Step 2: Check Link details if unpaid
      const linkUrl = `https://api.nomod.com/v1/links/${checkoutId}`;
      logNomodRequest(linkUrl, 'GET', apiKey, mode);

      const linkStartTime = Date.now();
      const linkResponse = await fetch(linkUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const linkResponseText = await linkResponse.text();
      const linkDuration = Date.now() - linkStartTime;

      const linkResponseHeaders = {};
      linkResponse.headers.forEach((value, name) => {
        linkResponseHeaders[name] = value;
      });

      logNomodResponse(linkUrl, linkResponse.status, linkDuration, linkResponseText, linkResponseHeaders);

      if (!linkResponse.ok) {
        return {
          success: false,
          status: 'Pending',
          errorType: 'http_error',
          error: `Nomod Links API failed (HTTP ${linkResponse.status}): ${linkResponseText}`
        };
      }

      const linkData = JSON.parse(linkResponseText);
      const mappedStatus = linkData.status === 'enabled' ? 'Pending' : 'Cancelled';

      return {
        success: true,
        status: mappedStatus,
        paidAt: null,
        transactionReference: null,
        rawData: linkData
      };
    } catch (err) {
      logNomodError(err, chargesUrl, mode);
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
