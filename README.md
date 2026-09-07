# Business Insights Report

A lightweight, client-first business intelligence tool for exploring CSV data and turning raw spreadsheets into actionable insights. Upload any structured dataset and the app automatically identifies business-relevant column types, calculates KPIs, highlights trends, surfaces correlations, and flags rule-based findings.

This project is designed for analysts, operations teams, product managers, and anyone working with spreadsheet-style data who wants fast, readable insights without setting up a full BI stack.

## Overview

Business Insights Report helps users turn CSV files into a polished business summary with:

- KPI summaries and metric overviews
- Trend analysis across time-based data
- Category breakdowns and distribution insights
- Correlation analysis between numeric fields
- Rule-based findings and anomaly detection
- Optional AI-generated narrative summaries using Anthropic
- Strict data-quality validation before any analysis runs

The app runs entirely in the browser for normal report generation. The only exception is the optional AI narrative feature, which is proxied through a serverless function so the Anthropic API key stays on the backend and is never exposed to end users.

## Why this project exists

Many spreadsheet workflows require domain knowledge, formatting cleanup, and manual interpretation before trends or issues become visible. This project reduces that friction by:

- detecting business roles automatically from column names and data patterns
- validating input quality before processing
- summarizing the most important signals in a single report
- supporting a wide range of datasets such as sales, HR, inventory, and operations data

## Features

### Automated data inspection

The app inspects uploaded CSVs and infers the likely business role of each field, including:

- currency
- quantity
- date
- category
- identifier

This allows the same analysis engine to work across different business domains without custom coding for each dataset.

### Business analysis output

After upload, the report can include:

- KPI metrics such as totals, averages, minima, and maxima
- time-based trend analysis
- category and segment breakdowns
- relationship analysis between variables
- concrete business rules and exception flags
- optional narrative insight summaries

### Data-quality gate

Before any analysis begins, the app validates the dataset for blank cells. If incomplete records are found, processing stops and a detailed rejection screen shows:

- which columns are affected
- how many blank values were found
- the percentage of rows impacted
- a row-by-row log of exact occurrences

This helps users fix source data precisely instead of guessing.

### AI-powered optional insights

The Findings tab offers an optional generated summary that sends only a compact metadata snapshot — not raw file contents — to the backend API, which then forwards the request to Anthropic securely.

If no API key is configured, the UI still works normally and shows a clear message explaining that the AI feature is unavailable.

## Tech stack

- Frontend: vanilla JavaScript, HTML, CSS
- Visualization: Chart.js
- Build tooling: npm scripts and local bundling
- Backend: Vercel serverless function
- AI integration: Anthropic API

## Project structure

```text
.
├── index.html                 Entry point; loads the built static assets
├── package.json               Project scripts and dependencies
├── vercel.json                Vercel deployment configuration
├── README.md                  Project documentation
├── .env.example               Example environment variable file for AI setup
├── api/
│   └── ai-insights.js         Vercel serverless function for AI proxying
├── src/
│   ├── app.js                 Main application logic
│   └── styles.css             Application styling
├── dist/
│   ├── app.min.js             Built app bundle used by the browser
│   ├── styles.min.css         Built CSS bundle
│   └── vendor/
│       └── chart.umd.js      Bundled Chart.js dependency
├── samples/
│   ├── sample-retail-sales.csv
│   ├── sample-hr-headcount.csv
│   └── sample-with-blank-cells.csv
├── test/
│   └── blackbox.test.js       End-to-end browser-driven test suite
└── .gitignore
```

Note: the source files live in `src/`, while `dist/` is generated at build time and should not be edited manually.

## Getting started

### Install dependencies

```bash
npm install
```

### Build the app

```bash
npm run build
```

This creates the production-ready static assets in `dist/` from the source files in `src/`.

### Preview locally

```bash
npm run preview
```

This serves the app locally in the browser. The frontend will function normally, but the `/api` route is not available unless you run the Vercel development server.

## Local development with AI features

To test AI-generated insights locally, you must use Vercel's local runtime because it is the environment providing the `/api/ai-insights` function.

```bash
cp .env.example .env.local
vercel dev
```

Then add your real Anthropic API key to the local environment file before starting Vercel.

## Deployment

### Vercel (recommended)

```bash
npm install -g vercel
vercel
```

After deployment, go to the Vercel dashboard and add the environment variable:

- `ANTHROPIC_API_KEY`

Then redeploy the project.

### Other static hosts

This app can be hosted on static infrastructure such as:

- Netlify
- GitHub Pages
- S3 + CloudFront
- Cloudflare Pages

The frontend itself is static and will work on those platforms. The AI backend route is Vercel-specific and needs adaptation if deployed elsewhere.

## AI Insights setup

The button in the Findings tab sends a compact, aggregated summary of the dataset — including column names, inferred data types, KPI values, and top correlations — to the backend. It does not send raw CSV contents.

The backend function reads the `ANTHROPIC_API_KEY` environment variable and forwards the request to Anthropic securely. If the key is missing, the feature is still visible in the UI but shows a clear message explaining that it has not been configured.

For production environments, it is recommended to add:

- rate limiting
- origin validation
- request size checks

This proxy validates and limits request payload size, but it does not implement production-grade rate limiting by itself.

## Data-quality gate

The app rejects files with blank values before analysis begins. This safeguard prevents partially valid data from being interpreted incorrectly.

For example, `samples/sample-with-blank-cells.csv` intentionally includes blank values, and the app surfaces the exact issues with row-level diagnostic detail.

This is especially useful for operational datasets where missing values can otherwise distort trend analysis or key metrics.

## Testing

```bash
npm test
```

The automated test suite runs against the actual built bundle in `dist/app.min.js`, not the source files. It simulates browser interaction with a lightweight fake DOM and validates:

- happy-path uploads
- tab switching behavior
- state reset and reload flows
- blank-cell rejection handling
- end-to-end report generation

## Security and privacy considerations

This project is transparent about browser-side limitations:

- any visitor can inspect client-side JavaScript in DevTools
- browser code is inherently visible to the end user
- secrets must therefore remain server-side

This is why the Anthropic API key is stored only in the backend environment variable used by `api/ai-insights.js` and is never sent to the browser.

The app intentionally keeps the real source in `src/`, while the production bundle in `dist/` is minified for efficiency and performance.

## Contributing

Contributions are welcome for improvements to analysis logic, UI quality, accessibility, edge-case validation, or documentation clarity.

If you are modifying the app, be sure to:

1. update the source in `src/`
2. rebuild with `npm run build`
3. run the tests with `npm test`
4. verify the report still behaves correctly with sample data

## Summary

Business Insights Report is a practical, no-frills analytics app for quickly understanding spreadsheet data without requiring a full business intelligence platform. It is especially useful for rapid reporting, exploratory analysis, and data-quality checks in a lightweight browser-based workflow.
