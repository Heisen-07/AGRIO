export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLYNK_AUTH_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'Blynk server configuration is missing',
    });
  }

  try {
    // 1. Check whether the physical ESP32 is online via Blynk
    const onlineUrl =
      `https://blynk.cloud/external/api/isHardwareConnected` +
      `?token=${encodeURIComponent(token)}`;

    const onlineRes = await fetch(onlineUrl, { signal: AbortSignal.timeout(6000) });
    const hwOnline = onlineRes.ok && (await onlineRes.text()).trim() === 'true';

    if (!hwOnline) {
      // Hardware is offline — return a structured offline response (200)
      // so the client can distinguish "device offline" from "server error"
      return res.status(200).json({
        hwOnline: false,
        error: 'ESP32 hardware is offline',
      });
    }

    // 2. Hardware is online — read telemetry pins
    const url =
      `https://blynk.cloud/external/api/get` +
      `?token=${encodeURIComponent(token)}` +
      `&V0&V1&V2&V3`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({
        error: 'Unable to read telemetry from Blynk',
      });
    }

    const data = await response.json();

    return res.status(200).json({
      hwOnline: true,
      soilMoisture: Number(data.V0),
      rain: Number(data.V1),
      temperature: Number(data.V2),
      humidity: Number(data.V3),
      timestamp: new Date().toISOString(),
      source: 'blynk',
    });
  } catch {
    return res.status(502).json({
      error: 'Telemetry service unavailable',
    });
  }
}