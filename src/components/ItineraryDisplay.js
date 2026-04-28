// src/components/ItineraryDisplay.js
import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, UtensilsCrossed, MapPin,
  DollarSign, CalendarDays, Clock, Navigation, Info,
  AlertTriangle
} from 'lucide-react';
import EventChat from './EventChat';

const dayColors = [
  'bg-indigo-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500'
];

const dayColorBorders = [
  'border-indigo-200', 'border-pink-200', 'border-amber-200', 'border-emerald-200',
  'border-sky-200', 'border-violet-200', 'border-rose-200', 'border-teal-200'
];

function computeDayCost(day) {
  const actCost = (day.activities || []).reduce((s, a) => s + (a.cost || 0), 0);
  const mealCost = (day.meals || []).reduce((s, m) => s + (m.cost || 0), 0);
  const transCost = (day.activities || []).reduce((s, a) => s + (a.transport?.cost || 0), 0);
  return actCost + mealCost + transCost;
}

const checkSimilarActivities = (activity, itinerary) => {
  const similarTypes = {
    temple: ['temple', 'shrine', 'religious'],
    museum: ['museum', 'gallery', 'exhibition'],
    park: ['park', 'garden', 'nature'],
    beach: ['beach', 'water', 'coast'],
    shopping: ['market', 'mall', 'shopping'],
    adventure: ['trek', 'hike', 'adventure', 'sport'],
    historical: ['fort', 'palace', 'historical', 'monument', 'ruins'],
    cultural: ['cultural', 'traditional', 'heritage', 'art']
  };

  const activityType = Object.keys(similarTypes).find(type =>
    similarTypes[type].some(keyword =>
      activity.name.toLowerCase().includes(keyword) ||
      activity.description.toLowerCase().includes(keyword)
    )
  );

  if (!activityType) return null;

  const similarActivities = itinerary.days.flatMap(day =>
    day.activities.filter(a =>
      a.name !== activity.name &&
      similarTypes[activityType].some(keyword =>
        a.name.toLowerCase().includes(keyword) ||
        a.description.toLowerCase().includes(keyword)
      )
    )
  );

  return similarActivities.length > 0 ? {
    type: activityType,
    activities: similarActivities
  } : null;
};

function ActivityCard({ activity, dayIndex, onClick }) {
  const similarInfo = checkSimilarActivities(activity, activity._itinerary);
  return (
    <div
      onClick={onClick}
      className={`relative pl-7 border-l-2 ${dayIndex % 2 === 0 ? 'border-indigo-400' : 'border-gray-300'} cursor-pointer hover:bg-gray-50 transition-colors py-1`}
    >
      <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-400" />
      <div className="mb-0.5">
        <span className="text-sm font-semibold text-indigo-600">{activity.time}</span>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="font-semibold text-gray-800 text-sm">{activity.name}</h4>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{activity.description}</p>

        {similarInfo && (
          <div className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
            <AlertTriangle size={12} />
            <span>Similar to: {similarInfo.activities.map(a => a.name).join(', ')}</span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">${activity.cost}</span>
          {activity.transport && (
            <span>{activity.transport.method} • {activity.transport.duration}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${activity.coordinates.lat},${activity.coordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs hover:bg-indigo-100"
            onClick={e => e.stopPropagation()}
          >
            <Navigation size={10} />
            Directions
          </a>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(activity.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <Info size={10} />
            More Info
          </a>
        </div>
      </div>
    </div>
  );
}

function MealCard({ meal, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-amber-50/60 p-3 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <UtensilsCrossed size={12} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-800 capitalize">{meal.type}</span>
        </div>
        <span className="text-xs text-gray-500">{meal.time}</span>
      </div>
      <div className="text-sm font-medium text-gray-800">{meal.name}</div>
      <div className="text-xs text-gray-500 line-clamp-1">{meal.description}</div>
      <div className="text-xs font-medium text-gray-600 mt-1">${meal.cost}</div>
    </div>
  );
}

function AccommodationOptions({ options }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="mt-4 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
      <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Where to Stay</h4>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="bg-white p-2.5 rounded border border-blue-100 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{opt.name}</div>
                <div className="text-xs text-gray-500">{opt.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium text-gray-800">${opt.cost_per_night}<span className="text-xs text-gray-400">/nt</span></div>
                <div className="text-[10px] text-gray-400">{opt.type}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetBar({ spent, total, dayIndex, totalDays, travelers }) {
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-2.5 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarDays size={12} />
          <span>Day {dayIndex} of {totalDays}</span>
          <span className="text-gray-300">|</span>
          <DollarSign size={12} />
          <span>${spent.toLocaleString()} spent</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">${(total - spent).toLocaleString()} left</span>
        </div>
        <span className="text-xs font-medium text-gray-700">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const ItineraryDisplay = ({ itinerary, tripData, onItineraryUpdate, apiKey, model }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventChatOpen, setIsEventChatOpen] = useState(false);
  const [isActivity, setIsActivity] = useState(true);
  const [expandedDays, setExpandedDays] = useState(new Set([0]));

  const totalBudget = tripData?.budget || itinerary?.groupTotal || 0;
  const travelers = tripData?.numPeople || 1;

  const validDays = useMemo(() => {
    if (!itinerary) return [];
    return (itinerary.days || [])
      .filter(day => day.activities && day.activities.length > 0)
      .map((day, idx) => ({
        ...day,
        _computedCost: computeDayCost(day),
        _dayIndex: idx
      }));
  }, [itinerary]);

  const cumulativeCosts = useMemo(() => {
    let running = 0;
    return validDays.map(day => {
      running += day._computedCost * travelers;
      return running;
    });
  }, [validDays, travelers]);

  if (!itinerary) return null;

  const toggleDay = (idx) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => setExpandedDays(new Set(validDays.map((_, i) => i)));
  const collapseAll = () => setExpandedDays(new Set());

  const handleEventUpdate = (updatedEvent) => {
    const updatedItinerary = JSON.parse(JSON.stringify(itinerary));
    const dayIndex = updatedItinerary.days.findIndex(day =>
      day.activities.some(activity => activity.name === selectedEvent.name) ||
      day.meals.some(meal => meal.name === selectedEvent.name)
    );

    if (dayIndex !== -1) {
      const day = updatedItinerary.days[dayIndex];
      if (isActivity) {
        const i = day.activities.findIndex(a => a.name === selectedEvent.name);
        if (i !== -1) day.activities[i] = updatedEvent;
      } else {
        const i = day.meals.findIndex(m => m.name === selectedEvent.name);
        if (i !== -1) day.meals[i] = updatedEvent;
      }
      day.dailyTotal = computeDayCost(day);
      onItineraryUpdate(updatedItinerary);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-100 mt-8 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Your Itinerary</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Sticky Budget Bar */}
      <BudgetBar
        spent={expandedDays.size > 0
          ? Math.max(...Array.from(expandedDays).map(i => cumulativeCosts[i] || 0))
          : 0}
        total={totalBudget}
        dayIndex={expandedDays.size > 0 ? Math.max(...Array.from(expandedDays)) + 1 : 0}
        totalDays={validDays.length}
        travelers={travelers}
      />

      {/* Days */}
      <div className="px-4 py-3 space-y-2">
        {validDays.map((day, idx) => {
          const isExpanded = expandedDays.has(idx);
          const dayColor = dayColors[idx % dayColors.length];
          const dayBorder = dayColorBorders[idx % dayColorBorders.length];
          const cumCost = cumulativeCosts[idx];
          const pctUsed = totalBudget > 0 ? Math.round((cumCost / totalBudget) * 100) : 0;

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all ${isExpanded ? `${dayBorder} shadow-sm` : 'border-gray-100'} overflow-hidden`}
            >
              {/* Day Header (always visible) */}
              <button
                onClick={() => toggleDay(idx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full ${dayColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Day {idx + 1}</span>
                    <span className="text-xs text-gray-400">{day.date}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {day.activities?.length || 0} activities
                    </span>
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed size={11} />
                      {day.meals?.length || 0} meals
                    </span>
                    <span className="font-medium text-gray-700">
                      ${day._computedCost * travelers}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Mini progress */}
                  <div className="hidden sm:block w-16">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${dayColor} rounded-full`}
                        style={{ width: `${Math.min(100, pctUsed)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-400 text-right mt-0.5">{pctUsed}% of budget</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-4">
                  {/* Meals */}
                  {day.meals && day.meals.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {day.meals.map((meal, mIdx) => (
                        <MealCard
                          key={mIdx}
                          meal={meal}
                          onClick={() => {
                            setSelectedEvent(meal);
                            setIsActivity(false);
                            setIsEventChatOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Activities */}
                  <div className="space-y-3">
                    {day.activities.map((activity, aIdx) => (
                      <ActivityCard
                        key={aIdx}
                        activity={{ ...activity, _itinerary: itinerary }}
                        dayIndex={idx}
                        onClick={() => {
                          setSelectedEvent(activity);
                          setIsActivity(true);
                          setIsEventChatOpen(true);
                        }}
                      />
                    ))}
                  </div>

                  {/* Accommodation */}
                  {day.accommodation_options && (
                    <AccommodationOptions options={day.accommodation_options} />
                  )}

                  {/* Daily Total */}
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Daily Total</p>
                      <p className="text-sm font-semibold text-gray-700">
                        ${day._computedCost * travelers}
                        <span className="text-xs text-gray-400 font-normal"> / ${day._computedCost} per person</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Cost Breakdown */}
      {itinerary.costBreakdown && (
        <div className="px-5 pb-5 pt-3 border-t border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cost Breakdown (Per Person)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Activities', value: itinerary.costBreakdown.activities, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Food', value: itinerary.costBreakdown.food, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Transport', value: itinerary.costBreakdown.transportation, color: 'text-sky-600', bg: 'bg-sky-50' },
              { label: 'Per Person', value: itinerary.perPersonTotal, color: 'text-emerald-600', bg: 'bg-emerald-50' }
            ].map(item => (
              <div key={item.label} className={`${item.bg} rounded-lg p-2.5 text-center`}>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</div>
                <div className={`text-base font-bold ${item.color}`}>${item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-semibold text-gray-700">Total for Group ({travelers} {travelers === 1 ? 'person' : 'people'})</span>
            <span className="text-xl font-bold text-gray-900">${itinerary.groupTotal}</span>
          </div>
        </div>
      )}

      {/* Event Chat Modal */}
      {isEventChatOpen && selectedEvent && (
        <EventChat
          event={selectedEvent}
          isActivity={isActivity}
          currentItinerary={itinerary}
          apiKey={apiKey}
          model={model}
          onClose={() => {
            setIsEventChatOpen(false);
            setSelectedEvent(null);
          }}
          onEventUpdate={handleEventUpdate}
        />
      )}
    </div>
  );
};

export default ItineraryDisplay;
