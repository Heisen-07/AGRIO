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