# Trip.AI

An AI-powered travel itinerary generator with an interactive map, real cost estimates, and a Vanta Punk editorial design language. Plan trips by destination, dates, budget, and interests — then refine every detail through conversational AI.

Live at [atharva2099.github.io/Trip.AI](https://atharva2099.github.io/Trip.AI/)

---

## Architecture

```
Frontend: GitHub Pages (React + Tailwind)
Backend API: Cloudflare Workers (serverless, edge-computed)
Database: Cloudflare D1 (SQLite at the edge)
Auth: GitHub + Google OAuth2 with JWT sessions
LLM: OpenRouter (bring-your-own-key)
Maps: Leaflet + CartoDB + OpenStreetMap (Nominatim)
```

---

## Features

### Trip Planning
- **Destination autocomplete** — powered by Nominatim/OpenStreetMap with place type icons
- **Date picker** — visual range selection with 2-month calendar and quick presets (Weekend, 3 Days, 1 Week, 2 Weeks)
- **Travelers** — adult and children steppers
- **Budget slider** — $500–$20,000 with live per-person-per-day calculation
- **Interest chips** — select up to 5 from 11 categories (Hiking, Food, Museums, Nightlife, Relaxation, Shopping, Adventure, Culture, Beach, Family, Romantic)
- **Quick Start presets** — Adventure, Foodie, Relaxation, Family, Romantic, Backpacker (auto-selects interests and adjusts budget)
- **Season detection** — automatically detects the season at your destination based on latitude and travel dates

### AI Itinerary Generation
- **OpenRouter integration** — bring your own API key, stored locally
- **Model selection**: DeepSeek V4 Flash / Pro, Qwen 3.6 Max, Kimi K2.6, Gemma 4 31B Free
- **JSON-native output** — structured itinerary with real place names, coordinates, costs, and routes
- **Max tokens: 6000** — prevents truncation for longer trips
- **300-second timeout** — handles OpenRouter queue times (1–3 min typical)
- **Destination cost classification** — LLM estimates typical daily spend tier (budget/mid-range/luxury/ultra-luxury)

### Interactive Map
- **Leaflet + CartoDB light tiles** — warm, editorial map aesthetic
- **Day filter** — view all days or isolate individual days with color-coded markers
- **Journey stats panel** — total distance, travel time, longest leg, transport breakdown by mode
- **Per-day routing** — automatic route lines drawn between activities for each day
- **Rich popups** — place name, description, cost, "Getting Here" / "Next Stop" legs with distance/duration/mode, and direct Google Maps navigation links

### Itinerary Display
- **Collapsible accordion days** — expand/collapse each day individually
- **Sticky cumulative budget bar** — shows running total vs budget with a progress bar
- **Cost breakdown grid** — activities, food, transport, per-person total
- **Activity cards** — time, duration, description, cost, transport details
- **Meal cards** — restaurant name, cuisine, cost
- **Accommodation options** — per-night pricing when available

### Conversational Customization
- **Event-level chat** — click any activity or meal to chat with the AI about changing it
- **Full itinerary context** — the AI sees the entire itinerary when suggesting alternatives
- **Real-time updates** — modified events replace the original in the itinerary instantly

### Design
- **Vanta Punk editorial** — warm cream palette (`#F5F0E8`), near-black ink (`#1A1208`), terracotta accent (`#C9593A`)
- **Square edges everywhere** — zero border-radius, architectural feel
- **Typography** — Playfair Display serif for headlines, Inter sans-serif for body
- **Custom scrollbar** — thin, warm-toned
- **No cards, no shadows** — border-separated grid layouts

### Auth & Cloud Persistence
- **GitHub & Google OAuth2** — sign in with one click, no passwords
- **JWT sessions** — custom JWT implementation using Web Crypto API, 30-day expiry
- **Auto-save trips** — every generated itinerary is automatically saved to your account
- **My Trips gallery** — browse, view, and delete all your saved itineraries
- **Cloud database** — D1 SQLite with Row Level Security (users can only access their own data)

---

## Tech Stack

- React 18
- Tailwind CSS
- Leaflet + leaflet-routing-machine
- react-day-picker
- lucide-react icons
- date-fns
- **Cloudflare Workers** — serverless edge API
- **Cloudflare D1** — SQLite database with Row Level Security
- **OAuth2 + JWT** — GitHub & Google auth, custom JWT implementation with Web Crypto API
- OpenRouter API (bring-your-own-key)
- Nominatim / OpenStreetMap (free geocoding)

---

## Local Development

```bash
git clone https://github.com/Atharva2099/Trip.AI.git
cd Trip.AI
npm install
npm start
```

The app runs at `http://localhost:3000`.

To build for production:
```bash
npm run build
```

---

## API Setup

1. Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Paste it into the form — it is stored only in your browser's `localStorage`
3. Choose a model and generate your itinerary

No backend. No data collection. Your key, your compute.

---

## Supported Models

| Model | Provider | Best For |
|-------|----------|----------|
| `deepseek/deepseek-v4-flash` | DeepSeek | Speed, default choice |
| `deepseek/deepseek-v4-pro` | DeepSeek | Best reasoning |
| `qwen/qwen3.6-max-preview` | Alibaba Cloud | Strong planning |
| `moonshotai/kimi-k2.6` | Moonshot AI | Long context |
| `google/gemma-4-31b-it:free` | Google | Free tier |

---

## License

MIT

---

Made by [Atharva2099](https://github.com/Atharva2099)
