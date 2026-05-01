# Trip.AI — Active Bugs & Issues

## Critical
| # | Bug | Status | Notes |
|---|-----|--------|-------|
| 1 | **EventChat broken** — clicking activity/meal/hotel no longer opens chat to modify it | 🟢 Fixed | Moved OpenRouter call server-side via new `/api/modify-event` Worker endpoint; removed `apiKey`/`model` props |
| 2 | **Map day markers disappear** — markers only flash on zoom in/out, then vanish | 🟢 Fixed | Removed `z-[2]` from sticky map wrapper (was trapping markers in stacking context); added explicit `z-index` to `.leaflet-popup-pane` (1000) and `.leaflet-marker-pane` (600) |
| 3 | **OpenTable links return no results** — search bar shows correct terms but empty results | 🟢 Fixed | Changed URL from `/s?term=` to `/search/results?term=`; search works for reservation restaurants |
| 4 | **Viator links return no results** — same as OpenTable | 🟢 Fixed | Changed from slug-based URL to `/searchResults/all?text=` format |

## Medium
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 5 | **Hotel booking links not visible** — "Where to Stay" section missing from SF itinerary | 🟡 Open | May be data issue (no hotels in generated itinerary) or component not rendering |
| 6 | **Local dev OAuth** — state-param fix deployed but needs verification on fresh login | 🟢 Fixed | Cookies replaced with state encoding; tested working |

## Low
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 7 | **Unused imports** — `UtensilsCrossed`, `MapPin`, `Clock`, `Navigation`, `Info`, `MODELS` | 🟡 Open | ESLint warnings; cleanup pass needed |

---

*Last updated: 2025-04-30*
