import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, differenceInDays, startOfToday } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/src/style.css';
import {
  Home, MapPin, Building2, Globe, Camera, Trees, Waves,
  MountainSnow, Users, Minus, Plus, Mountain,
  UtensilsCrossed, Landmark, Moon, Coffee,
  ShoppingBag, Compass, Palette, Umbrella, Sparkles,
  Flower2, Sun, Leaf, Snowflake, ChevronDown, X,
  Compass as AdventureIcon, Backpack, CalendarDays, Cpu
} from 'lucide-react';
import { searchPlaces, getPlaceIcon } from '../utils/nominatim';
import { getSeason, getTheme } from '../utils/season';
import { MODELS, DEFAULT_MODEL } from '../config';

const INTERESTS = [
  { key: 'hiking', label: 'Hiking', icon: Mountain },
  { key: 'food', label: 'Food', icon: UtensilsCrossed },
  { key: 'museums', label: 'Museums', icon: Landmark },
  { key: 'nightlife', label: 'Nightlife', icon: Moon },
  { key: 'relaxation', label: 'Relaxation', icon: Coffee },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'adventure', label: 'Adventure', icon: Compass },
  { key: 'culture', label: 'Culture', icon: Palette },
  { key: 'beach', label: 'Beach', icon: Umbrella },
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

const LS_KEY = 'tripai_form_v3';

const IconMap = {
  Home, MapPin, Building2, Globe, Camera, Trees, Waves, MountainSnow,
  Users, Mountain, UtensilsCrossed, Landmark, Moon, Coffee,
  ShoppingBag, Compass, Palette, Umbrella, Sparkles,
  Flower2, Sun, Leaf, Snowflake, ChevronDown, X,
  AdventureIcon, Backpack, CalendarDays
};

function Stepper({ label, value, onChange, min = 0, max = 20 }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-[0.14em] text-ink-light w-14">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 h-7 flex items-center justify-center border border-rule text-ink-light hover:border-terra hover:text-terra disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink-light transition-colors"
      >
        <Minus size={12} />
      </button>
      <span className="w-4 text-center text-sm font-medium text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 h-7 flex items-center justify-center border border-rule text-ink-light hover:border-terra hover:text-terra disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink-light transition-colors"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function InterestChip({ interest, active, onClick }) {
  const Icon = interest.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all ${
        active
          ? 'bg-terra text-cream border-terra'
          : 'bg-transparent text-ink-light border-rule hover:border-terra hover:text-terra'
      }`}
    >
      <Icon size={13} strokeWidth={1.5} />
      {interest.label}
    </button>
  );
}

function SeasonIcon({ season }) {
  const theme = getTheme(season);
  const iconName = theme.icon;
  const Icon = IconMap[iconName] || Sun;
  return <Icon size={14} className="text-terra" strokeWidth={1.5} />;
}

// Reusable autocomplete input for place search. Used for both From and Destination.
function PlaceAutocomplete({ label, iconName, value, placeholder, onSelect, error }) {
  const [text, setText] = useState(value?.fullName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const timeout = useRef(null);
  const Icon = IconMap[iconName] || MapPin;

  useEffect(() => {
    setText(value?.fullName || '');
  }, [value?.fullName]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowSugg(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const onChangeText = (next) => {
    setText(next);
    setShowSugg(true);
    if (timeout.current) clearTimeout(timeout.current);
    if (!next || next.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timeout.current = setTimeout(async () => {
      const results = await searchPlaces(next);
      setSuggestions(results);
      setLoading(false);
    }, 350);
  };

  const onPick = (place) => {
    setText(place.fullName);
    setShowSugg(false);
    setSuggestions([]);
    onSelect(place);
  };

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">
        {label}
      </label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
        <input
          type="text"
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          onFocus={() => text.length >= 2 && setShowSugg(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-3 border border-rule bg-cream text-ink placeholder-ink-muted focus:outline-none focus:border-terra transition-colors text-sm"
          required
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border border-rule border-t-terra rounded-full animate-spin" />
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-terra">{error}</p>}
      {showSugg && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-cream border border-rule shadow-lg">
          {suggestions.map((place) => {
            const SuggIcon = IconMap[getPlaceIcon(place.type, place.class)] || MapPin;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => onPick(place)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-dark text-left transition-colors border-b border-rule last:border-b-0"
              >
                <SuggIcon size={14} className="text-ink-muted shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">{place.name}</div>
                  <div className="text-xs text-ink-muted truncate">{place.fullName}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TripForm = ({ onSubmit, disabled, theme, onThemeChange }) => {
  // Defaults for every field. loadInitial merges any saved form on top
  // so missing keys (e.g. from a stale localStorage written before the
  // From field was added) get safe values instead of undefined.
  const DEFAULTS = {
    from: null,
    fromText: '',
    destination: null,
    destinationText: '',
    dateRange: { from: null, to: null },
    travelers: { adults: 2, children: 0 },
    budget: 3000,
    interests: [],
    preset: null,
    model: DEFAULT_MODEL
  };

  const loadInitial = () => {
    let saved = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') saved = parsed;
      }
    } catch { /* ignore */ }

    return {
      ...DEFAULTS,
      ...(saved || {}),
      // Shallow-merge nested objects so partial saved forms don't lose
      // the default fields.
      dateRange: { ...DEFAULTS.dateRange, ...((saved && saved.dateRange) || {}) },
      travelers: { ...DEFAULTS.travelers, ...((saved && saved.travelers) || {}) }
    };
  };

  const [form, setForm] = useState(loadInitial);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [formErrors, setFormErrors] = useState({});

  const calendarRef = useRef(null);
  const formRef = useRef(form);

  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    setFormErrors((prev) => {
      const next = { ...prev };
      const fromText = (form.fromText || '').trim();
      const destText = (form.destinationText || '').trim();
      if (form.from || fromText) delete next.from;
      if (form.destination || destText) delete next.destination;
      if (form.dateRange.from && form.dateRange.to) delete next.dates;
      return next;
    });
  }, [form.from, form.fromText, form.destination, form.destinationText, form.dateRange.from, form.dateRange.to]);

  useEffect(() => {
    function handleClick(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) setShowCalendar(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleFromSelect = (place) => {
    const currentForm = formRef.current;
    setForm((f) => ({ ...f, from: place, fromText: place.fullName }));
    if (currentForm.dateRange?.from) {
      // Season follows the destination (not home), so this only updates if destination is already set.
      if (currentForm.destination) {
        const season = getSeason(currentForm.destination.lat, new Date(currentForm.dateRange.from));
        if (onThemeChange) onThemeChange(season);
      }
    }
  };

  const handleDestinationSelect = (place) => {
    const currentForm = formRef.current;
    setForm((f) => ({ ...f, destination: place, destinationText: place.fullName }));
    setShowCalendar(false);
    if (currentForm.dateRange?.from) {
      const season = getSeason(place.lat, new Date(currentForm.dateRange.from));
      if (onThemeChange) onThemeChange(season);
    }
  };

  const totalTravelers = form.travelers.adults + form.travelers.children;
  const durationDays = form.dateRange.from && form.dateRange.to
    ? Math.max(1, differenceInDays(new Date(form.dateRange.to), new Date(form.dateRange.from)) + 1)
    : 0;
  const perPersonPerDay = durationDays > 0 && totalTravelers > 0
    ? Math.round(form.budget / totalTravelers / durationDays)
    : 0;

  const handleDateSelect = (range) => {
    if (!range) return;
    const currentForm = formRef.current;
    const hadCompleteRange = currentForm.dateRange.from && currentForm.dateRange.to;

    if (hadCompleteRange && range.from && range.to) {
      const oldFrom = new Date(currentForm.dateRange.from).getTime();
      const newFrom = range.from.getTime();
      if (newFrom === oldFrom) {
        setForm((f) => ({ ...f, dateRange: { from: range.to.toISOString(), to: null } }));
      } else {
        setForm((f) => ({ ...f, dateRange: { from: range.from.toISOString(), to: null } }));
      }
      return;
    }

    setForm((f) => ({ ...f, dateRange: { from: range.from || null, to: range.to || null } }));
    if (range.from && range.to) {
      setShowCalendar(false);
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

  const toggleInterest = (key) => {
    setForm((f) => {
      const exists = f.interests.includes(key);
      let next = exists
        ? f.interests.filter((k) => k !== key)
        : f.interests.length < 5 ? [...f.interests, key] : f.interests;
      return { ...f, interests: next, preset: null };
    });
  };

  const applyPreset = (preset) => {
    setForm((f) => ({
      ...f,
      interests: [...preset.interests],
      preset: preset.key,
      budget: Math.max(500, Math.round(f.budget * (preset.budgetMod || 1)))
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fromText = (form.fromText || '').trim();
    const destText = (form.destinationText || '').trim();
    const errors = {};
    if (!form.from && !fromText) errors.from = 'Please enter where you are travelling from';
    if (!form.destination && !destText) errors.destination = 'Please enter a destination';
    if (!form.dateRange.from || !form.dateRange.to) errors.dates = 'Please select your travel dates';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const modelEntry = MODELS.find(m => m.id === form.model) || MODELS[0];

    onSubmit({
      from: form.from || { fullName: fromText },
      destination: form.destination?.fullName || destText,
      dates: {
        start: format(new Date(form.dateRange.from), 'yyyy-MM-dd'),
        end: format(new Date(form.dateRange.to), 'yyyy-MM-dd')
      },
      budget: form.budget,
      numPeople: totalTravelers,
      interests: form.interests.join(', '),
      model: modelEntry.value,
      modelProvider: modelEntry.provider || null,
      additionalNotes: '',
      _destinationMeta: form.destination,
      _fromMeta: form.from,
      _travelers: form.travelers
    });
  };

  const currentTheme = theme ? getTheme(theme) : null;

  return (
    <div className="bg-cream-dark border border-rule p-6 md:p-8">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

          {/* From — full width */}
          <div className="md:col-span-2">
            <PlaceAutocomplete
              label="From"
              iconName="Home"
              value={form.from}
              placeholder="City you're travelling from..."
              onSelect={handleFromSelect}
              error={formErrors.from}
            />
          </div>

          {/* Destination — full width */}
          <div className="md:col-span-2">
            <PlaceAutocomplete
              label="Destination"
              iconName="MapPin"
              value={form.destination}
              placeholder="Search for a city or place..."
              onSelect={handleDestinationSelect}
              error={formErrors.destination}
            />
          </div>

          {/* Dates — full width */}
          <div className="md:col-span-2 relative" ref={calendarRef}>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">
              Dates
            </label>
            <button
              type="button"
              onClick={() => setShowCalendar((s) => !s)}
              className="w-full flex items-center justify-between px-3 py-3 border border-rule bg-cream text-left focus:outline-none focus:border-terra transition-colors"
            >
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-ink-muted" strokeWidth={1.5} />
                {form.dateRange.from && form.dateRange.to ? (
                  <span className="text-sm text-ink">
                    {format(new Date(form.dateRange.from), 'MMM d')} — {format(new Date(form.dateRange.to), 'MMM d, yyyy')}
                    <span className="text-ink-muted ml-2">({durationDays} day{durationDays !== 1 ? 's' : ''})</span>
                  </span>
                ) : form.dateRange.from ? (
                  <span className="text-sm text-ink">{format(new Date(form.dateRange.from), 'MMM d')} — Select end</span>
                ) : (
                  <span className="text-sm text-ink-muted">Pick a date range</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentTheme && (
                  <span className="flex items-center gap-1 text-xs text-ink-light">
                    <SeasonIcon season={theme} />
                    {currentTheme.name}
                  </span>
                )}
                <ChevronDown size={12} className="text-ink-muted" />
              </div>
            </button>
            {formErrors.dates && (
              <p className="mt-2 text-xs text-terra">{formErrors.dates}</p>
            )}
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
                  className="text-[10px] uppercase tracking-[0.14em] px-2 py-1 border border-rule text-ink-light hover:border-terra hover:text-terra transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {showCalendar && (
              <div className="absolute z-20 mt-2 bg-cream border border-rule shadow-lg p-3">
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
                  disabled={[{ before: startOfToday() }]}
                  modifiersClassNames={{
                    today: 'font-bold',
                    selected: 'bg-terra text-cream',
                    range_start: 'bg-terra text-cream',
                    range_end: 'bg-terra text-cream',
                    range_middle: 'bg-terra/20 text-terra'
                  }}
                />
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mt-2 text-center">
                  Maximum: 14 days
                </div>
              </div>
            )}
          </div>

          {/* Travelers */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">
              Travelers
            </label>
            <div className="space-y-2">
              <Stepper label="Adults" value={form.travelers.adults} onChange={(v) => setForm((f) => ({ ...f, travelers: { ...f.travelers, adults: v } }))} min={1} max={20} />
              <Stepper label="Children" value={form.travelers.children} onChange={(v) => setForm((f) => ({ ...f, travelers: { ...f.travelers, children: v } }))} min={0} max={10} />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">
              Budget
            </label>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-serif text-2xl text-ink">${form.budget.toLocaleString()}</span>
              {durationDays > 0 && totalTravelers > 0 && (
                <span className="text-xs text-ink-light">${perPersonPerDay}/person/day</span>
              )}
            </div>
            <input
              type="range"
              min={500}
              max={20000}
              step={100}
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: parseInt(e.target.value) }))}
              className="w-full h-[2px] bg-rule appearance-none cursor-pointer accent-terra"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-muted mt-2">
              <span>$500</span>
              <span>$20,000</span>
            </div>
          </div>

          {/* Model — full width */}
          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">
              Model
            </label>
            <div className="relative">
              <Cpu size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full pl-9 pr-3 py-3 border border-rule bg-cream text-ink focus:outline-none focus:border-terra transition-colors text-sm appearance-none cursor-pointer"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interests — full width */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] uppercase tracking-[0.14em] text-ink-light">
                Interests
              </label>
              {form.interests.length >= 5 && (
                <span className="text-[10px] text-terra">Max 5</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <InterestChip
                  key={interest.key}
                  interest={interest}
                  active={form.interests.includes(interest.key)}
                  onClick={() => toggleInterest(interest.key)}
                />
              ))}
            </div>
          </div>

          {/* Presets — full width */}
          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">
              Quick Start
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all ${
                      active
                        ? 'bg-terra text-cream border-terra'
                        : 'bg-transparent text-ink-light border-rule hover:border-terra hover:text-terra'
                    }`}
                  >
                    <Icon size={13} strokeWidth={1.5} />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="md:col-span-2 flex justify-center">
            <button
              type="submit"
              disabled={disabled}
              className={`px-12 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                disabled
                  ? 'bg-cream-dark text-ink-muted border border-rule cursor-not-allowed'
                  : 'bg-terra text-cream hover:bg-terra-dark'
              }`}
            >
              {disabled ? 'Generating...' : 'Generate Itinerary'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TripForm;
