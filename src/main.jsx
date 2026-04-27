import React from 'react'
import ReactDOM from 'react-dom/client'
import { client, SigmaClientProvider } from '@sigmacomputing/plugin'
import App from './App'
import './index.css'

client.config.configureEditorPanel([
  // ── Required ──────────────────────────────────────────────────────────────
  { name: 'source',      type: 'element', label: 'Data Source' },
  { name: 'dateColumn',  type: 'column',  source: 'source', allowMultiple: false, label: 'Date Column' },
  { name: 'valueColumn', type: 'column',  source: 'source', allowMultiple: false, label: 'Value Column' },

  // ── Data Options ──────────────────────────────────────────────────────────
  { name: 'dataOptions', type: 'group', label: 'Data Options' },
  {
    name: 'aggregation',
    type: 'dropdown',
    source: 'dataOptions',
    label: 'Aggregation Method',
    values: ['Sum', 'Count', 'Average', 'Max', 'Min'],
    defaultValue: 'Sum',
  },

  // ── Display Options ───────────────────────────────────────────────────────
  { name: 'displayOptions', type: 'group', label: 'Display Options' },
  { name: 'title',      type: 'text',   source: 'displayOptions', label: 'Title',             defaultValue: 'Calendar',        placeholder: 'e.g. Due This Month' },
  { name: 'subtitle',   type: 'text',   source: 'displayOptions', label: 'Subtitle',           placeholder: 'e.g. by Day' },
  { name: 'totalLabel', type: 'text',   source: 'displayOptions', label: 'KPI Label',          placeholder: 'e.g. Due This Month' },
  { name: 'showTotal',  type: 'toggle', source: 'displayOptions', label: 'Show Monthly Total', defaultValue: true },
  {
    name: 'colorTheme',
    type: 'dropdown',
    source: 'displayOptions',
    label: 'Color Theme',
    values: ['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Teal'],
    defaultValue: 'Red',
  },

  // ── Calendar Options ──────────────────────────────────────────────────────
  { name: 'calendarOptions', type: 'group', label: 'Calendar Options' },
  {
    name: 'firstDay',
    type: 'dropdown',
    source: 'calendarOptions',
    label: 'First Day of Week',
    values: ['Sunday', 'Monday'],
    defaultValue: 'Sunday',
  },

  // ── Interactivity ─────────────────────────────────────────────────────────
  { name: 'interactivity', type: 'group', label: 'Interactivity' },
  { name: 'selectedDate', type: 'variable',       source: 'interactivity', label: 'Selected Date Variable' },
  { name: 'onDayClick',   type: 'action-trigger', source: 'interactivity', label: 'On Day Click' },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SigmaClientProvider client={client}>
      <App />
    </SigmaClientProvider>
  </React.StrictMode>
)
