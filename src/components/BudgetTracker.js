import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';

function getStorageKey(tripData) {
  if (!tripData?.destination) return null;
  const date = tripData.dates?.start || 'unknown';
  return `expenses_v2_${tripData.destination.replace(/\s+/g, '_')}_${date}`;
}

export default function BudgetTracker({ itinerary, tripData, onClose }) {
  const [expenses, setExpenses] = useState([]);
  const storageKey = getStorageKey(tripData);

  const items = useMemo(() => {
    if (!itinerary?.days) return [];
    const list = [];
    itinerary.days.forEach((day, dayIdx) => {
      (day.activities || []).forEach((act) => {
        list.push({ id: `d${dayIdx}_act_${act.name}`, day: dayIdx + 1, dayDate: day.date, type: 'activity', name: act.name, plannedCost: act.cost || 0 });
      });
      (day.meals || []).forEach((meal) => {
        list.push({ id: `d${dayIdx}_meal_${meal.name}_${meal.type}`, day: dayIdx + 1, dayDate: day.date, type: 'meal', name: meal.name, plannedCost: meal.cost || 0 });
      });
      (day.accommodation_options || []).forEach((opt) => {
        list.push({ id: `d${dayIdx}_stay_${opt.name}`, day: dayIdx + 1, dayDate: day.date, type: 'stay', name: opt.name, plannedCost: opt.cost_per_night || 0 });
      });
    });
    return list;
  }, [itinerary]);

  useEffect(() => {
    if (!storageKey) return;
    try { const saved = localStorage.getItem(storageKey); if (saved) setExpenses(JSON.parse(saved)); } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || expenses.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(expenses));
  }, [expenses, storageKey]);

  const getExpense = useCallback((id) => expenses.find(e => e.id === id) || {}, [expenses]);

  const updateExpense = useCallback((id, updates) => {
    setExpenses(prev => {
      const existing = prev.find(e => e.id === id);
      if (existing) return prev.map(e => e.id === id ? { ...e, ...updates } : e);
      return [...prev, { id, ...updates }];
    });
  }, []);

  const grouped = useMemo(() => {
    const days = {};
    items.forEach(item => { if (!days[item.day]) days[item.day] = { date: item.dayDate, items: [] }; days[item.day].items.push(item); });
    return days;
  }, [items]);

  const totalPlanned = items.reduce((s, i) => s + i.plannedCost, 0);
  const totalActual = items.reduce((s, i) => s + (parseInt(getExpense(i.id).actualCost) || 0), 0);
  const budget = tripData?.budget || totalPlanned;
  const remaining = budget - totalActual;

  const typeLabels = { activity: 'Activity', meal: 'Meal', stay: 'Stay' };

  return (
    <div className="min-h-screen bg-cream pb-20">
      <div className="sticky top-[57px] z-30 bg-cream border-b border-rule px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onClose} className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors">
            <ArrowLeft size={12} strokeWidth={1.5} />
            Back to Itinerary
          </button>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{items.length} items</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl text-ink">${totalActual.toLocaleString()}</span>
            <span className="text-sm text-ink-light">/ ${budget.toLocaleString()}</span>
          </div>
          <span className={`font-serif text-xl ${remaining >= 0 ? 'text-ink' : 'text-terra'}`}>
            ${remaining.toLocaleString()} remaining
          </span>
        </div>
        <div className="h-[2px] bg-rule mt-2">
          <div className="h-full bg-terra transition-all" style={{ width: `${Math.min(100, budget > 0 ? (totalActual / budget) * 100 : 0)}%` }} />
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {Object.entries(grouped).map(([dayNum, day]) => (
          <div key={dayNum}>
            <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">Day {dayNum} — {day.date}</h3>
            <div className="space-y-3">
              {day.items.map((item) => {
                const exp = getExpense(item.id);
                const actualCost = exp.actualCost || '';
                const notes = exp.notes || '';
                const itemName = exp.name || item.name;
                const diff = (parseInt(actualCost) || 0) - item.plannedCost;
                return (
                  <div key={item.id} className="border border-rule p-4 hover:bg-cream-dark/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 mr-4">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-terra mr-2">{typeLabels[item.type]}</span>
                        <input type="text" value={itemName} onChange={(e) => updateExpense(item.id, { name: e.target.value })} className="bg-transparent border-none text-sm text-ink font-medium focus:outline-none focus:border-b focus:border-terra w-full" />
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-ink-light">Planned</div>
                        <div className="font-serif text-lg text-ink">${item.plannedCost}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex-1">
                        <input type="text" value={notes} onChange={(e) => updateExpense(item.id, { notes: e.target.value })} placeholder="What actually happened..." className="w-full bg-transparent border-none text-xs text-ink-light placeholder-ink-muted/50 focus:outline-none focus:border-b focus:border-terra" />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-ink-light">Actual</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted">$</span>
                          <input type="number" value={actualCost} onChange={(e) => updateExpense(item.id, { actualCost: e.target.value })} className="w-20 pl-5 pr-2 py-1.5 border border-rule bg-cream text-sm text-ink focus:outline-none focus:border-terra transition-colors text-right" />
                        </div>
                        {actualCost !== '' && diff !== 0 && (
                          <span className={`text-[10px] uppercase tracking-[0.14em] ${diff > 0 ? 'text-terra' : 'text-green-600'}`}>{diff > 0 ? '+' : ''}${diff}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="border-t border-rule pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">Suggested Total</div>
              <div className="font-serif text-2xl text-ink">${totalPlanned.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">Actual Total</div>
              <div className="font-serif text-2xl text-ink">${totalActual.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-rule">
            <span className="text-sm text-ink-light">Difference</span>
            <span className={`font-serif text-xl ${totalActual > totalPlanned ? 'text-terra' : 'text-green-600'}`}>
              {totalActual >= totalPlanned ? '+' : ''}${(totalActual - totalPlanned).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
