import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus, Loader2, BookOpen } from 'lucide-react';
import { expensesApi } from '../api/client';

function computeDayPlanned(day) {
  const activities = (day.activities || []).reduce((s, a) => s + (a.cost || 0), 0);
  const food = (day.meals || []).reduce((s, m) => s + (m.cost || 0), 0);
  const transport = (day.activities || []).reduce((s, a) => s + (a.transport?.cost || 0), 0);
  const accommodation = day.accommodation_options?.reduce((s, o) => s + (o.cost_per_night || 0), 0) || 0;
  return { activities, food, transport, accommodation, total: activities + food + transport + accommodation };
}

function getStorageKey(tripData) {
  if (!tripData?.destination) return null;
  const date = tripData.dates?.start || 'unknown';
  return `expenses_${tripData.destination.replace(/\s+/g, '_')}_${date}`;
}

export default function BudgetTracker({ itinerary, tripData }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [showTracker, setShowTracker] = useState(false);
  const storageKey = getStorageKey(tripData);

  // Load from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setExpenses(JSON.parse(saved));
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Save to localStorage whenever expenses change
  useEffect(() => {
    if (!storageKey || expenses.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(expenses));
  }, [expenses, storageKey]);

  const getExpense = useCallback((day, category) => {
    return expenses.find(e => e.day === day && e.category === category);
  }, [expenses]);

  const getActual = useCallback((day, category) => {
    const e = getExpense(day, category);
    return e?.actual_amount || 0;
  }, [getExpense]);

  const getNotes = useCallback((day) => {
    const e = expenses.find(exp => exp.day === day && exp.category === 'notes');
    return e?.description || '';
  }, [expenses]);

  const updateValue = useCallback(async (day, category, planned, value, isNotes = false) => {
    const key = isNotes ? `${day}-notes` : `${day}-${category}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    const amount = isNotes ? 0 : (parseInt(value) || 0);
    const desc = isNotes ? value : '';

    setExpenses(prev => {
      const existing = prev.find(e => e.day === day && e.category === category);
      if (existing) {
        return prev.map(e => 
          e.day === day && e.category === category
            ? { ...e, actual_amount: amount, planned_amount: planned, description: desc }
            : e
        );
      }
      return [...prev, {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        day,
        category,
        planned_amount: planned,
        actual_amount: amount,
        description: desc
      }];
    });

    // Optional: sync to D1 if user is authenticated
    try {
      // We don't have the itinerary DB ID here, so skip D1 sync for now
      // In the future, we can sync when the trip is saved
    } catch (err) {
      console.error('Sync failed:', err);
    }

    setTimeout(() => {
      setSaving(prev => ({ ...prev, [key]: false }));
    }, 300);
  }, []);

  // Compute totals
  const summary = useMemo(() => {
    if (!itinerary?.days) return { planned: 0, actual: 0, categories: {} };
    
    let totalPlanned = 0;
    let totalActual = 0;
    const categories = {};

    itinerary.days.forEach((day, idx) => {
      const planned = computeDayPlanned(day);
      totalPlanned += planned.total;

      ['activities', 'food', 'transport', 'accommodation'].forEach(cat => {
        const actual = getActual(idx + 1, cat);
        if (!categories[cat]) categories[cat] = { planned: 0, actual: 0 };
        categories[cat].planned += planned[cat];
        categories[cat].actual += actual;
        totalActual += actual;
      });
    });

    return { planned: totalPlanned, actual: totalActual, categories };
  }, [itinerary, expenses, getActual]);

  const budgetTotal = tripData?.budget || summary.planned;
  const remaining = budgetTotal - summary.actual;
  const percentUsed = budgetTotal > 0 ? Math.min(100, Math.round((summary.actual / budgetTotal) * 100)) : 0;

  if (!itinerary?.days) return null;

  return (
    <div className="mt-8 border-t border-rule pt-8">
      {/* Toggle */}
      <button
        onClick={() => setShowTracker(s => !s)}
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors mb-6"
      >
        <DollarSign size={12} strokeWidth={1.5} />
        {showTracker ? 'Hide Budget Tracker' : 'Track Budget & Expenses'}
      </button>

      {showTracker && (
        <>
          {/* Summary Bar */}
          <div className="bg-cream-dark border border-rule p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">Spent</div>
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-3xl text-ink">${summary.actual.toLocaleString()}</span>
                  <span className="text-sm text-ink-light">/ ${budgetTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">Remaining</div>
                <div className={`font-serif text-2xl ${remaining >= 0 ? 'text-ink' : 'text-terra'}`}>
                  ${remaining.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-[3px] bg-rule">
              <div 
                className="h-full bg-terra transition-all"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              <span>{percentUsed}% used</span>
              <span>{summary.planned > 0 ? `Planned: $${summary.planned.toLocaleString()}` : ''}</span>
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-rule mt-4 pt-4">
              {Object.entries(summary.categories).map(([cat, vals], i) => {
                const diff = vals.actual - vals.planned;
                const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                return (
                  <div key={cat} className={`py-2 px-3 ${i > 0 ? 'md:border-l border-rule' : ''}`}>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">{cat}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-serif text-lg text-ink">${vals.actual.toLocaleString()}</span>
                      <Icon size={11} className={diff > 0 ? 'text-terra' : diff < 0 ? 'text-green-600' : 'text-ink-muted'} strokeWidth={1.5} />
                    </div>
                    <div className="text-[10px] text-ink-muted">planned ${vals.planned.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-day expenses */}
          <div className="space-y-6">
            {itinerary.days.map((day, idx) => {
              const dayNum = idx + 1;
              const planned = computeDayPlanned(day);
              const dayActual = ['activities', 'food', 'transport', 'accommodation'].reduce((s, cat) => s + getActual(dayNum, cat), 0);
              const dayDiff = dayActual - planned.total;

              return (
                <div key={dayNum} className="border border-rule">
                  <div className="flex items-center justify-between px-4 py-3 bg-cream-dark border-b border-rule">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-ink">Day {dayNum}</span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{day.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-light">
                        ${dayActual.toLocaleString()} / ${planned.total.toLocaleString()}
                      </span>
                      {dayDiff !== 0 && (
                        <span className={`text-[10px] uppercase tracking-[0.14em] ${dayDiff > 0 ? 'text-terra' : 'text-green-600'}`}>
                          {dayDiff > 0 ? '+' : ''}${dayDiff.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'activities', label: 'Activities', planned: planned.activities },
                      { key: 'food', label: 'Food', planned: planned.food },
                      { key: 'transport', label: 'Transport', planned: planned.transport },
                      { key: 'accommodation', label: 'Stay', planned: planned.accommodation }
                    ].map(({ key, label, planned: p }) => {
                      const actual = getActual(dayNum, key);
                      const isSaving = saving[`${dayNum}-${key}`];
                      return (
                        <div key={key}>
                          <label className="block text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1.5">
                            {label}
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-light w-12">Pl: ${p}</span>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">$</span>
                              <input
                                type="number"
                                value={actual || ''}
                                onChange={(e) => updateValue(dayNum, key, p, e.target.value)}
                                placeholder={p.toString()}
                                className="w-full pl-5 pr-7 py-2 border border-rule bg-cream text-sm text-ink focus:outline-none focus:border-terra transition-colors"
                              />
                              {isSaving && (
                                <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-ink-muted" strokeWidth={1.5} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Journal */}
                  <div className="px-4 pb-4">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1.5">
                      <BookOpen size={10} strokeWidth={1.5} />
                      Journal
                    </label>
                    <textarea
                      value={getNotes(dayNum)}
                      onChange={(e) => updateValue(dayNum, 'notes', 0, e.target.value, true)}
                      placeholder="What actually happened today? AI suggested... but I did..."
                      rows={2}
                      className="w-full px-3 py-2 border border-rule bg-cream text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-terra transition-colors resize-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
