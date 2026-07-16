const apiKey = 'sk_live_DPzibTYc.9sH3InxdK3EgOlJoiRXCeKuvzBkNDbSn';

async function testXApiKey() {
  console.log("Testing with X-API-KEY header...");
  try {
    const response = await fetch('https://api.nomod.com/v1/checkout', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: "1.00",
        currency: "AED",
        reference_id: "TEST-1"
      })
    });
    console.log("X-API-KEY Status:", response.status);
    console.log("X-API-KEY Response:", await response.text());
  } catch (err) {
    console.error("X-API-KEY Error:", err);
  }
}

async function testBearer() {
  console.log("\nTesting with Authorization: Bearer header...");
  try {
    const response = await fetch('https://api.nomod.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: "1.00",
        currency: "AED",
        reference_id: "TEST-1"
      })
    });
    console.log("Bearer Status:", response.status);
    console.log("Bearer Response:", await response.text());
  } catch (err) {
    console.error("Bearer Error:", err);
  }
}

async function testBasic() {
  console.log("\nTesting with Authorization: Basic header...");
  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch('https://api.nomod.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: "1.00",
        currency: "AED",
        reference_id: "TEST-1"
      })
    });
    console.log("Basic Status:", response.status);
    console.log("Basic Response:", await response.text());
  } catch (err) {
    console.error("Basic Error:", err);
  }
}

async function run() {
  await testXApiKey();
  await testBearer();
  await testBasic();
}

run();
