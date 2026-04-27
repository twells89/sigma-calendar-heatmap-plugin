# Sigma Calendar Heatmap Plugin

A calendar heatmap plugin for [Sigma Computing](https://sigmacomputing.com) that displays daily aggregated metrics with intensity-based color coding — the darker the cell, the higher the value.

**Live URL:** `https://twells89.github.io/sigma-calendar-heatmap-plugin/`

---

## What It Does

This plugin takes a dataset with a date column and a numeric value column, aggregates the values by calendar day, and renders them in a month grid where each cell's background color scales with the value. High-traffic days become dark; low or zero days stay light.

This is ideal for visualizing:
- Items due per day
- Ticket/case volume by day
- Revenue or orders per day
- Any metric where daily patterns and spikes matter

---

## Features

- **Heatmap coloring** — cell intensity scales linearly from the minimum to the maximum value in the current month
- **6 color themes** — Red, Blue, Green, Purple, Orange, Teal
- **Monthly KPI header** — shows the aggregated total for the displayed month with a configurable label
- **5 aggregation methods** — Sum, Count, Average, Max, Min
- **Prev/Next month navigation**
- **Click a day** — sets a Sigma workbook variable and fires an action trigger
- **Configurable title, subtitle, and KPI label**
- **First day of week** — Sunday or Monday

---

## Registering the Plugin in Sigma

1. Go to **Administration → Plugins**
2. Click **Add Plugin**
3. Fill in:
   - **Name:** Calendar Heatmap
   - **URL:** `https://twells89.github.io/sigma-calendar-heatmap-plugin/`
4. Save

---

## Adding to a Workbook

1. In a workbook in **Edit** mode, click **+** → **Plugins** → **Calendar Heatmap**
2. Resize the element — the calendar fills 100% of it
3. Open the editor panel to configure

---

## Configuration Reference

### Required

| Field | Description |
|---|---|
| **Data Source** | The Sigma table or visualization containing your data |
| **Date Column** | A date or datetime column to group events by day |
| **Value Column** | A numeric column to aggregate per day |

### Data Options

| Field | Default | Description |
|---|---|---|
| **Aggregation Method** | Sum | How to combine multiple rows on the same day: Sum, Count, Average, Max, or Min |

### Display Options

| Field | Default | Description |
|---|---|---|
| **Title** | Calendar | Displayed at the top of the plugin |
| **Subtitle** | *(blank)* | Smaller text below the title (e.g. "by Day") |
| **KPI Label** | *(same as title)* | Label next to the monthly total number |
| **Show Monthly Total** | On | Shows the large aggregate KPI number for the current month |
| **Color Theme** | Red | Heatmap color scale. Options: Red, Blue, Green, Purple, Orange, Teal |

### Calendar Options

| Field | Default | Description |
|---|---|---|
| **First Day of Week** | Sunday | Sunday or Monday |

### Interactivity

| Field | Type | Description |
|---|---|---|
| **Selected Date Variable** | Variable | Set to the clicked day's ISO date string (e.g. `2025-04-15`) when a day is clicked |
| **On Day Click** | Action Trigger | Fires when any in-month day cell is clicked. Wire this to filter other workbook elements. |

---

## Interactivity Pattern

1. Set **Selected Date Variable** to a workbook parameter (e.g. `clicked_date`)
2. Set **On Day Click** to trigger an action — for example, filter a child table where `due_date = clicked_date`
3. Clicking any day in the calendar now drills through to the detail table

---

## Data Format

Your data can have multiple rows per day (the plugin aggregates them) or one row per day (pre-aggregated). Dates are accepted in any of these formats:

| Format | Example |
|---|---|
| ISO date | `2025-04-15` |
| ISO datetime | `2025-04-15T10:30:00Z` |
| Unix seconds | `1744675200` |
| Unix milliseconds | `1744675200000` |

---

## Color Intensity

The heatmap scales from the lowest color to the highest based on the **maximum value within the current month**. Navigating to a different month recalculates the scale — so relative intensity is always within-month.

Days with no data show a neutral light background with no value label.

---

## Local Development

```bash
git clone https://github.com/twells89/sigma-calendar-heatmap-plugin.git
cd sigma-calendar-heatmap-plugin
npm install
npm run dev
# → http://localhost:3002/sigma-calendar-heatmap-plugin/
```

To test in Sigma: add a Plugins element → **Sigma Plugin Dev Playground** → element menu → **Point to Development URL** → `http://localhost:3002/sigma-calendar-heatmap-plugin/`

---

## Tech Stack

- [React 18](https://react.dev/) — custom calendar grid (no FullCalendar dependency)
- [@sigmacomputing/plugin](https://www.npmjs.com/package/@sigmacomputing/plugin)
- [Vite 5](https://vitejs.dev/)
