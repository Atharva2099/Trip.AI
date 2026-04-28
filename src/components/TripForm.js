import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, addDays, differenceInDays, startOfToday } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/src/style.css';
import {
  MapPin, Building2, Globe, Camera, Trees, Waves,
  MountainSnow, Users, Minus, Plus, Mountain,
  UtensilsCrossed, Landmark, Moon, Coffee,
  ShoppingBag, Compass, Palette, Umbrella, Sparkles,
  Flower2, Sun, Leaf, Snowflake, ChevronDown, X,
  Compass as AdventureIcon, Backpack, CalendarDays
} from 'lucide-react';
import { searchPlaces, getPlaceIcon } from '../utils/nominatim';
import { getSeason, getTheme } from '../utils/season';

// ─── Constants ───────────────────────────────────────────────

const INTERESTS = [
  { key: 'hiking', label: 'Hiking', icon: Mountain },
  { key: 'food', label: 'Food & Drink', icon: UtensilsCrossed },
  { key: 'museums', label: 'Museums', icon: Landmark },
  { key: 'nightlife', label: 'Nightlife', icon: Moon },
  { key: 'relaxation', label: 'Relaxation', icon: Coffee },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'adventure', label: 'Adventure', icon: Compass },
  { key: 'culture', label: 'Art & Culture', icon: Palette },
  { key: 'beach', label: 'Beach & Water', icon: Umbrella },
  { key: 'family', label: 'Family', icon: Users },
  { key: 'romantic', label: 'Romantic', icon: Sparkles }
];

const PRESETS = [
  { key: 'adventure', label: 'Adventure', icon: AdventureIcon, interests: ['hiking', 'adventure', 'culture'], budgetMod: 1.2 },
  { key: 'foodie', label: 'Foodie', icon: UtensilsCrossed, interests: ['food', 'culture', 'nightlife'], budgetMod: 1.2 },
  { key: 'relaxation', label: 'Relaxation', icon: Coffee, interests: ['relaxation', 'beach'], budgetMod: 1.0 },
  { key: 'family', label: 'Family', icon: Users, interests: ['family', 'museums', 'adventure'], budgetMod: 1.0 },
  { key: 'romantic', label: 'Romantic', icon: Sparkles, interests: ['culture', 'food', 'nightlife'], budgetMod: 1.4 },
  { key: 'backpacker', label: 'Backpacker', icon: Backpack, interests: ['adventure', 'hiking'], budgetMod: 0.7 }
];

const MODELS = [
  { value: 'qwen/qwen3.6-max-preview', label: 'Qwen 3.6 Max' },
  { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
  { value: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4' },
  { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' }
];

const FALLBACK_MODEL = 'qwen/qwen3.6-max-preview';
const LS_KEY = 'tripai_form_v2';

// ─── Icon mapping for dynamic rendering ──────────────────────

const IconMap = {
  MapPin, Building2, Globe, Camera, Trees, Waves, MountainSnow,
  Users, Mountain, UtensilsCrossed, Landmark, Moon, Coffee,
  ShoppingBag, Compass, Palette, Umbrella, Sparkles,
  Flower2, Sun, Leaf, Snowflake, ChevronDown, X,
  AdventureIcon, Backpack, CalendarDays
};

// ─── Helper: Cost classification via LLM ─────────────────────

async function classifyDestinationCost(destination, apiKey, model) {
  if (!apiKey || !destination) return null;
  const cacheKey = `cost_${destination}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Trip.AI'
      },
      body: JSON.stringify({
        model: model || FALLBACK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You classify tourist destinations by daily cost per person in USD. Respond ONLY with a JSON object: { "tier": "budget|mid-range|luxury|ultra-luxury", "minDaily": number, "maxDaily": number, "description": "short phrase like Mid-range European city" }'
          },
          {
            role: 'user',
            content: `Classify "${destination}" for a tourist visiting for leisure. What is the typical daily cost per person for food, activities, and local transport (excluding accommodation and flights)?`
          }
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        include_reasoning: false
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    localStorage.setItem(cacheKey, JSON.stringify(parsed));
    return parsed;
  } catch {
    return null;
  }
}

// ─── Sub-components ──────────────────────────────────────────

function Stepper({ label, value, onChange, min = 0, max = 20 }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-16">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="w-6 text-center font-medium text-gray-800">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function InterestChip({ interest, active, theme, onClick }) {
  const Icon = interest.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-200 ${
        active
          ? (theme?.chipActive || 'bg-emerald-600 text-white border-emerald-600')
          : (theme?.chipInactive || 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300')
      }`}
    >
      <Icon size={14} />
      {interest.label}
    </button>
  );
}

function SeasonIcon({ season }) {
  const theme = getTheme(season);
  const iconName = theme.icon;
  const Icon = IconMap[iconName] || Sun;
  return <Icon size={16} className={theme.accent} />;
}

// ─── Main Component ──────────────────────────────────────────

const TripForm = ({ onSubmit, disabled, theme, onThemeChange }) => {
  // Load from localStorage or use defaults
  const loadInitial = () => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      destination: null,
      destinationText: '',
      dateRange: { from: null, to: null },
      travelers: { adults: 2, children: 0 },
      budget: 3000,
      interests: [],
      preset: null,
      apiKey: localStorage.getItem('openrouter_api_key') || '',
      model: localStorage.getItem('openrouter_model') || FALLBACK_MODEL
    };
  };

  const [form, setForm] = useState(loadInitial);
  const [showCalendar, setShowCalendar] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [costData, setCostData] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [formErrors, setFormErrors] = useState({});

  const searchTimeout = useRef(null);
  const calendarRef = useRef(null);
  const suggestionsRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => { formRef.current = form; }, [form]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(form));
    localStorage.setItem('openrouter_api_key', form.apiKey);
    localStorage.setItem('openrouter_model', form.model);
  }, [form]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Nominatim autocomplete
  const handleDestinationInput = useCallback((text) => {
    setForm((f) => ({ ...f, destinationText: text, destination: null }));
    setShowSuggestions(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text || text.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSuggestions(results);
      setLoadingSuggestions(false);
    }, 350);
  }, []);

  const selectDestination = (place) => {
    const currentForm = formRef.current;
    setForm((f) => ({
      ...f,
      destination: place,
      destinationText: place.fullName
    }));
    setShowSuggestions(false);
    setSuggestions([]);

    // Compute season and theme
    if (currentForm.dateRange?.from) {
      const season = getSeason(place.lat, new Date(currentForm.dateRange.from));
      if (onThemeChange) onThemeChange(season);
    }

    // Fetch cost context
    if (currentForm.apiKey) {
      classifyDestinationCost(place.fullName, currentForm.apiKey, currentForm.model).then(setCostData);
    }
  };

  // Budget helpers
  const totalTravelers = form.travelers.adults + form.travelers.children;
  const durationDays = form.dateRange.from && form.dateRange.to
    ? Math.max(1, differenceInDays(new Date(form.dateRange.to), new Date(form.dateRange.from)) + 1)
    : 0;
  const perPersonPerDay = durationDays > 0 && totalTravelers > 0
    ? Math.round(form.budget / totalTravelers / durationDays)
    : 0;

  const minBudget = totalTravelers * durationDays * 50;
  const budgetTooLow = durationDays > 0 && form.budget < minBudget;

  // Clear errors when user fixes fields
  useEffect(() => {
    setFormErrors((prev) => {
      const next = { ...prev };
      if (form.destination || form.destinationText.trim()) delete next.destination;
      if (form.dateRange.from && form.dateRange.to) delete next.dates;
      if (!budgetTooLow) delete next.budget;
      return next;
    });
  }, [form.destination, form.destinationText, form.dateRange.from, form.dateRange.to, budgetTooLow]);

  // Date helpers
  const handleDateSelect = (range) => {
    if (!range) return;
    const currentForm = formRef.current;
    setForm((f) => ({ ...f, dateRange: { from: range.from || null, to: range.to || null } }));

    if (range.from && !range.to) {
      // Only start selected
    } else if (range.from && range.to) {
      setShowCalendar(false);
      // Recompute season if destination known
      if (currentForm.destination) {
        const season = getSeason(currentForm.destination.lat, new Date(range.from));
        if (onThemeChange) onThemeChange(season);
      }
    }
  };

  const quickDatePreset = (days) => {
    const currentForm = formRef.current;
    const from = startOfToday();
    const to = addDays(from, days - 1);
    setForm((f) => ({ ...f, dateRange: { from: from.toISOString(), to: to.toISOString() } }));
    setCalendarMonth(from);
    if (currentForm.destination) {
      const season = getSeason(currentForm.destination.lat, from);
      if (onThemeChange) onThemeChange(season);
    }
  };

  // Interest toggle
  const toggleInterest = (key) => {
    setForm((f) => {
      const exists = f.interests.includes(key);
      let next = exists
        ? f.interests.filter((k) => k !== key)
        : f.interests.length < 5 ? [...f.interests, key] : f.interests;
      return { ...f, interests: next, preset: null };
    });
  };

  // Preset select
  const applyPreset = (preset) => {
    setForm((f) => ({
      ...f,
      interests: [...preset.interests],
      preset: preset.key,
      budget: Math.max(500, Math.round(f.budget * (preset.budgetMod || 1)))
    }));
  };

  // Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.destination && !form.destinationText.trim()) {
      errors.destination = 'Please enter a destination';
    }
    if (!form.dateRange.from || !form.dateRange.to) {
      errors.dates = 'Please select your travel dates';
    }
    if (budgetTooLow) {
      errors.budget = `Minimum budget is $${minBudget} for ${totalTravelers} travelers over ${durationDays} days.`;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      destination: form.destination?.fullName || form.destinationText,
      dates: {
        start: format(new Date(form.dateRange.from), 'yyyy-MM-dd'),
        end: format(new Date(form.dateRange.to), 'yyyy-MM-dd')
      },
      budget: form.budget,
      numPeople: totalTravelers,
      interests: form.interests.join(', '),
      additionalNotes: '',
      apiKey: form.apiKey,
      model: form.model,
      // Pass enriched data for future use
      _destinationMeta: form.destination,
      _travelers: form.travelers
    });
  };

  const currentTheme = theme ? getTheme(theme) : null;
  const seasonLabel = currentTheme ? currentTheme.name : '';

  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Plan Your Trip</h2>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Destination ── */}
        <div className="relative" ref={suggestionsRef}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Where are you going?
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.destinationText}
              onChange={(e) => handleDestinationInput(e.target.value)}
              onFocus={() => form.destinationText.length >= 2 && setShowSuggestions(true)}
              placeholder="Search for a city, country, or place..."
              className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                currentTheme?.ring || 'focus:ring-emerald-500'
              } border-gray-200`}
              required
            />
            {loadingSuggestions && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {formErrors.destination && (
            <p className="mt-1.5 text-xs text-red-600">{formErrors.destination}</p>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
              {suggestions.map((place) => {
                const iconName = getPlaceIcon(place.type, place.class);
                const Icon = IconMap[iconName] || MapPin;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectDestination(place)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                  >
                    <Icon size={16} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{place.name}</div>
                      <div className="text-xs text-gray-500 truncate">{place.fullName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Dates ── */}
        <div className="relative" ref={calendarRef}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            When?
          </label>
          <button
            type="button"
            onClick={() => setShowCalendar((s) => !s)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left focus:outline-none focus:ring-2 transition-all ${
              currentTheme?.ring || 'focus:ring-emerald-500'
            } border-gray-200 bg-white`}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-gray-400" />
              {form.dateRange.from && form.dateRange.to ? (
                <span className="text-sm text-gray-800">
                  {format(new Date(form.dateRange.from), 'MMM d')} - {format(new Date(form.dateRange.to), 'MMM d, yyyy')}
                  <span className="text-gray-400 ml-2">
                    ({durationDays} day{durationDays !== 1 ? 's' : ''})
                  </span>
                </span>
              ) : form.dateRange.from ? (
                <span className="text-sm text-gray-800">
                  {format(new Date(form.dateRange.from), 'MMM d')} - Select end date
                </span>
              ) : (
                <span className="text-sm text-gray-400">Pick a date range</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentTheme && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <SeasonIcon season={theme} />
                  {seasonLabel}
                </span>
              )}
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </button>

          {formErrors.dates && (
            <p className="mt-1.5 text-xs text-red-600">{formErrors.dates}</p>
          )}

          {/* Quick presets */}
          <div className="flex gap-2 mt-2">
            {[
              { label: 'Weekend', days: 2 },
              { label: '3 Days', days: 3 },
              { label: '1 Week', days: 7 },
              { label: '2 Weeks', days: 14 }
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => quickDatePreset(p.days)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar popup */}
          {showCalendar && (
            <div className="absolute z-20 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-3">
              <DayPicker
                mode="range"
                numberOfMonths={2}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selected={{
                  from: form.dateRange.from ? new Date(form.dateRange.from) : undefined,
                  to: form.dateRange.to ? new Date(form.dateRange.to) : undefined
                }}
                onSelect={handleDateSelect}
                disabled={[
                  { before: startOfToday() }
                ]}
                modifiers={{
                  today: new Date()
                }}
                modifiersClassNames={{
                  today: 'font-bold',
                  selected: 'bg-emerald-600 text-white rounded-full',
                  range_start: 'bg-emerald-600 text-white rounded-l-full',
                  range_end: 'bg-emerald-600 text-white rounded-r-full',
                  range_middle: 'bg-emerald-100 text-emerald-800'
                }}
              />
              <div className="text-xs text-gray-400 mt-2 text-center">
                Maximum trip length: 14 days
              </div>
            </div>
          )}
        </div>

        {/* ── Travelers ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Who is traveling?
          </label>
          <div className="space-y-2">
            <Stepper
              label="Adults"
              value={form.travelers.adults}
              onChange={(v) => setForm((f) => ({ ...f, travelers: { ...f.travelers, adults: v } }))}
              min={1}
              max={20}
            />
            <Stepper
              label="Children"
              value={form.travelers.children}
              onChange={(v) => setForm((f) => ({ ...f, travelers: { ...f.travelers, children: v } }))}
              min={0}
              max={10}
            />
          </div>
        </div>

        {/* ── Budget ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Budget
          </label>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-semibold text-gray-800">${form.budget.toLocaleString()}</span>
            {durationDays > 0 && totalTravelers > 0 && (
              <span className="text-sm text-gray-500">
                ${perPersonPerDay}/person/day
              </span>
            )}
          </div>

          <input
            type="range"
            min={500}
            max={20000}
            step={100}
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>$500</span>
            <span>$20,000</span>
          </div>

          {costData && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium">{costData.description || costData.tier}</span>
              {costData.minDaily && costData.maxDaily && (
                <span> — typical daily cost ${costData.minDaily}-${costData.maxDaily}/person</span>
              )}
            </div>
          )}

          {(budgetTooLow || formErrors.budget) && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {formErrors.budget || `Budget too low. Minimum is $${minBudget} for ${totalTravelers} travelers over ${durationDays} days.`}
            </div>
          )}
        </div>

        {/* ── Interests ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              What are you into?
            </label>
            {form.interests.length >= 5 && (
              <span className="text-xs text-amber-600">Max 5 selected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <InterestChip
                key={interest.key}
                interest={interest}
                active={form.interests.includes(interest.key)}
                theme={currentTheme}
                onClick={() => toggleInterest(interest.key)}
              />
            ))}
          </div>
        </div>

        {/* ── Presets ── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Quick start
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const active = form.preset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-200 ${
                    active
                      ? (currentTheme?.chipActive || 'bg-emerald-600 text-white border-emerald-600')
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder="sk-or-v1-..."
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${
              currentTheme?.ring || 'focus:ring-emerald-500'
            } border-gray-200`}
            required
          />
          <p className="mt-1 text-xs text-gray-400">
            Your key is stored locally. <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">Get a key</a>
          </p>

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1.5">
            Model
          </label>
          <select
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 transition-all ${
              currentTheme?.ring || 'focus:ring-emerald-500'
            } border-gray-200`}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={disabled || budgetTooLow}
          className={`w-full py-3 rounded-xl text-white font-medium transition-all ${
            disabled || budgetTooLow
              ? 'bg-gray-300 cursor-not-allowed'
              : `${currentTheme?.accentBg || 'bg-emerald-600'} ${currentTheme?.accentBgHover || 'hover:bg-emerald-700'} shadow-md hover:shadow-lg`
          }`}
        >
          {disabled ? 'Generating...' : 'Generate Itinerary'}
        </button>
      </form>
    </div>
  );
};

export default TripForm;
