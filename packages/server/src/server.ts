import { createServer, loadDataset } from './index.js';
import { fetchPolygonSnapshot } from './polygonSnapshot.js';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);

async function bootstrap() {
  const apiKey = process.env.POLYGON_API_KEY ?? process.env.REACT_APP_POLYGON_API_KEY;
  let items = loadDataset();
  if (apiKey) {
    try {
      console.log('Fetching Polygon snapshot dataset…');
      const snapshot = await fetchPolygonSnapshot(apiKey);
      if (snapshot.length > 0) {
        items = snapshot;
        console.log(`Loaded ${snapshot.length} tickers from Polygon.`);
      }
    } catch (error) {
      console.warn('Failed to load Polygon snapshot, falling back to sample dataset.', error);
    }
  } else {
    console.warn('POLYGON_API_KEY not set. Falling back to bundled sample dataset.');
  }

  const app = createServer({ items });
  app.listen(port, () => {
    console.log(`FacetZoom server listening on http://localhost:${port}`);
  });
}

void bootstrap();
