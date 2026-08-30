const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Manga translator backend is running.' });
});

app.get('/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.imageUrl;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing imageUrl parameter.' });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Image fetch failed: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('proxy-image error:', error);
    res.status(500).json({ error: error.message || 'Proxy failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Manga translator backend running on http://localhost:${PORT}`);
});
