# Trip.AI Roadmap

## Phase 1 — Core Auth & Persistence (DONE)

- [x] GitHub + Google OAuth2 with JWT sessions
- [x] Cloudflare Worker API with D1 SQLite database
- [x] Auto-save generated itineraries to cloud
- [x] My Trips gallery (view, load, delete)
- [x] Landing page with Unsplash travel imagery
- [x] API key secured as Worker secret (never exposed to frontend)
- [x] LLM proxy through Worker (rate limiting, fallback ready)

---

## Phase 2 — Bookmarks & User Memory

- [ ] **Bookmarked Places** — heart button on any activity, meal, or hotel. Cross-trip collection.
- [ ] **User Preferences Profile** — default budget range, travel style, home airport, preferred transport modes. Stored in D1.
- [ ] **Personalized Prompt Injection** — feed user's past trips, bookmarks, and spending patterns into the system prompt so the LLM recommends better (e.g., "this user always bookmarks hiking spots and underspends on food")
- [ ] **Saved Places as Seed Data** — when generating a new trip, reference bookmarked places from that destination as anchor points

---

## Phase 3 — Booking Integration

- [ ] **Hotel Deep Links** — Booking.com, Agoda, Airbnb search URLs with pre-filled destination/dates
- [ ] **Flight Search Links** — Google Flights, Skyscanner, Kayak with origin/destination/date params
- [ ] **Activity Booking** — GetYourGuide, Viator, Klook deep links per activity
- [ ] **Restaurant Reservations** — OpenTable, Resy links where available
- [ ] **Ground Transport** — Uber, Lyft, Rome2Rio for inter-city legs

---

## Phase 4 — Real-Time Data & Grounding

- [ ] **Tavily Search Grounding** — query real-time data before generating itineraries
  - Current opening hours, prices, weather
  - Verify places haven't closed or changed
  - Seasonal events and festivals at destination
- [ ] **Weather-Aware Scheduling** — move outdoor activities to clear-weather days
- [ ] **Event Injection** — auto-include concerts, exhibitions, local events happening during travel dates

---

## Phase 5 — Trip Companion (Chat + TTS)

- [ ] **Saved Trip Chat Interface** — pick any saved trip, open a chat sidebar
  - "Tell me more about the Louvre visit on Day 2"
  - "What should I wear for the hiking activity?"
  - "Suggest an alternative restaurant near the Eiffel Tower"
- [ ] **Full Itinerary Context** — the AI sees the entire saved trip, not just one event
- [ ] **Text-to-Speech (TTS)** — read out daily briefings, walking directions, activity descriptions
  - Browser-native `speechSynthesis` API (free, no backend)
  - Optional: ElevenLabs integration for premium voice
- [ ] **Voice Input** — speech-to-text for hands-free querying

---

## Phase 6 — Budget & Spending Manager

- [ ] **Planned vs Actual Tracking** — log what you actually spent each day
  - Categories: activities, food, transport, accommodation, other
  - Visual progress bar: budget remaining
- [ ] **Expense Logger** — quick-add expenses with description, amount, category
- [ ] **Spending Insights** — "You typically spend 20% less on food than budgeted"
- [ ] **Alerts** — warn when approaching daily or total budget limit
- [ ] **Post-Trip Summary** — total spent vs planned, category breakdown, savings tips

---

## Phase 7 — Export & Share

- [ ] **PDF Export** — one-page printable itinerary with map thumbnail
- [ ] **Share by Link** — encode itinerary as URL query param (no auth needed to view)
- [ ] **Collaborative Planning** — share trip with friends, they can suggest edits
- [ ] **Print Styles** — clean typography, day-by-day layout, QR code for map

---

## Phase 8 — Advanced AI Features

- [ ] **Multi-City Trips** — support itineraries across multiple destinations
- [ ] **Pacing Analysis** — warn if a day's schedule is too packed or has unrealistic travel times
- [ ] **Dynamic Replanning** — "Rain tomorrow — reshuffle my outdoor activities"
- [ ] **Local Guide Persona** — chat with a persona (e.g., "Paris Foodie", "Tokyo Nightlife Expert")
- [ ] **Photo Enrichment** — fetch real photos of activities/restaurants via Google Places or Unsplash

---

## Tech Debt & Infrastructure

- [ ] Add unit tests for Worker API routes
- [ ] Add error boundary and loading skeletons in React
- [ ] Implement API request caching (Cloudflare Cache API) for repeated prompts
- [ ] Rate limiting per user (prevent abuse of LLM proxy)
- [ ] Monitoring: Worker analytics, error alerting

---

## Completed

See git history for completed features.
