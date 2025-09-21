# Running FacetZoom and Committing Updates

This guide walks through installing dependencies, running the API and web explorer locally, and committing changes back to GitHub. It assumes you cloned the repository and have Node.js 18+ with npm installed.

## 1. Install workspace dependencies

1. Open a terminal in the repository root.
2. Install all workspace packages:
   ```bash
   npm install
   ```
3. (Optional) Verify the toolchain builds and tests cleanly:
   ```bash
   npm run build
   npm test -- --run
   npm run lint
   ```

## 2. Configure environment variables

1. Create a `.env` file in the repository root if one does not already exist.
2. Add your Polygon API key. The server will read either `POLYGON_API_KEY` or `REACT_APP_POLYGON_API_KEY`:
   ```bash
   POLYGON_API_KEY=your_polygon_key
   # or
   REACT_APP_POLYGON_API_KEY=your_polygon_key
   ```
3. Reload your terminal session or export the variable before launching the server:
   ```bash
   export POLYGON_API_KEY=your_polygon_key
   ```

## 3. Run the API server

1. Build the server workspace once so TypeScript compiles to JavaScript:
   ```bash
   npm run build --workspace @facetzoom/server
   ```
2. Start the Express server:
   ```bash
   node packages/server/dist/server.js
   ```
   The API listens on `http://localhost:4000`.
3. (Optional) Smoke-test the endpoint in a second terminal:
   ```bash
   curl "http://localhost:4000/items?fields=G0|G1|G2&limit=3"
   ```

## 4. Run the web explorer

1. In a new terminal, ensure dependencies are installed (`npm install`).
2. Launch the Vite dev server for the React explorer:
   ```bash
   npm run dev --workspace @facetzoom/web-app
   ```
3. Visit `http://localhost:5174` in your browser. The Vite dev server proxies API requests to the Express backend.
4. Use the facet search, price sliders, and zoom presets to explore the dataset. Use **Clear all filters** to reset the view.

## 5. Commit changes and push to GitHub

1. Check the current status to see modified files:
   ```bash
   git status
   ```
2. Stage the files you want to commit:
   ```bash
   git add <file1> <file2>
   # or stage everything
   git add .
   ```
3. Run the project checks (build, tests, lint) if you have not already.
4. Commit with a descriptive message:
   ```bash
   git commit -m "Describe the change"
   ```
5. Push to GitHub (replace `main` with the branch you are working on):
   ```bash
   git push origin main
   ```
6. Open a pull request on GitHub if you are working on a feature branch. Include a summary of the changes and the commands you ran for verification.

## 6. Troubleshooting tips

- If the server cannot reach Polygon, it falls back to `data/items.json`. Confirm your API key is valid if you expect live data.
- Delete the `node_modules` folder and reinstall (`rm -rf node_modules && npm install`) if installs behave unexpectedly.
- Use `npx vitest --run` for targeted unit testing during development.
- Run `npm run lint -- --fix` to automatically format supported files.

Following these steps ensures you can iterate locally, validate your changes, and publish them back to GitHub with confidence.
