// src/components/ItineraryDisplay.js
import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, UtensilsCrossed, MapPin,
  DollarSign, CalendarDays, Clock, Navigation, Info,
  AlertTriangle, ExternalLink
} from 'lucide-react';
import { BookmarkButton } from './BookmarksPage';
import BudgetTracker from './BudgetTracker';
import EventChat from './EventChat';
import { getActivityLinks, getMealLinks, getAccommodationLinks } from '../utils/booking';

const dayColors = [
  '#C9593A', '#6B5C4A', '#1A1208', '#B0A090',
  '#D8D0C4', '#8B7355', '#A08060', '#5C4A3A'
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
  return similarActivities.length > 0 ? { type: activityType, activities: similarActivities } : null;
};

function ActivityCard({ activity, dayIndex, onClick, destination }) {
  const similarInfo = checkSimilarActivities(activity, activity._itinerary);
  return (
    <div
      onClick={onClick}
      className="relative pl-6 border-l-2 border-rule cursor-pointer hover:border-terra transition-colors py-2 group"
    >
      <div className="absolute -left-[5px] top-3 w-2 h-2 bg-cream border-2 border-rule group-hover:border-terra transition-colors" />
      <div className="flex items-start justify-between">
        <div className="mb-0.5">
          <span className="text-xs font-medium text-terra">{activity.time}</span>
        </div>
        {destination && (
          <BookmarkButton item={activity} destination={destination} type="activity" />
        )}
      </div>
      <h4 className="font-serif text-base text-ink group-hover:text-terra transition-colors">{activity.name}</h4>
      <p className="text-xs text-ink-light mt-0.5 line-clamp-2">{activity.description}</p>
      {similarInfo && (
        <div className="text-terra text-xs mt-1.5 flex items-center gap-1">
          <AlertTriangle size={11} />
          <span>Similar to: {similarInfo.activities.map(a => a.name).join(', ')}</span>
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-ink-light">
        <span className="font-medium text-ink">${activity.cost}</span>
        {activity.transport && (
          <span>{activity.transport.method} • {activity.transport.duration}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {getActivityLinks(activity, destination).map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={9} />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function MealCard({ meal, onClick, destination }) {
  return (
    <div
      onClick={onClick}
      className="py-3 border-b border-rule last:border-b-0 cursor-pointer hover:bg-cream-dark/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-terra">{meal.type}</span>
          <span className="text-xs text-ink-light">{meal.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink">${meal.cost}</span>
          {destination && (
            <BookmarkButton item={meal} destination={destination} type="meal" />
          )}
        </div>
      </div>
      <div className="text-sm text-ink mt-0.5">{meal.name}</div>
      <div className="text-xs text-ink-light line-clamp-1">{meal.description}</div>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {getMealLinks(meal, destination).map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={9} />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function AccommodationOptions({ options, destination, checkin, checkout }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-rule">
      <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">Where to Stay</h4>
      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="border-l-2 border-terra pl-4 py-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-ink">{opt.name}</div>
                <div className="text-xs text-ink-light">{opt.description}</div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {getAccommodationLinks(opt, destination, checkin, checkout).map(link => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors"
                    >
                      <ExternalLink size={9} />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-ink">${opt.cost_per_night}<span className="text-xs text-ink-muted">/nt</span></div>
                  {destination && (
                    <BookmarkButton item={opt} destination={destination} type="accommodation" />
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{opt.type}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ItineraryDisplay = ({ itinerary, tripData, onItineraryUpdate, apiKey, model }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventChatOpen, setIsEventChatOpen] = useState(false);
  const [isActivity, setIsActivity] = useState(true);
  const [expandedDays, setExpandedDays] = useState(new Set([0]));
  const [showTracker, setShowTracker] = useState(false);

  const totalBudget = tripData?.budget || itinerary?.groupTotal || 0;
  const travelers = tripData?.numPeople || 1;

  const validDays = useMemo(() => {
    if (!itinerary) return [];
    return (itinerary.days || [])
      .filter(day => day.activities && day.activities.length > 0)
      .map((day, idx) => ({ ...day, _computedCost: computeDayCost(day), _dayIndex: idx }));
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

  const expandedCost = expandedDays.size > 0
    ? Math.max(...Array.from(expandedDays).map(i => cumulativeCosts[i] || 0))
    : 0;
  const pct = totalBudget > 0 ? Math.min(100, Math.round((expandedCost / totalBudget) * 100)) : 0;

  return (
    <div className="border-t border-rule">
      {/* Sticky budget bar */}
      <div className="sticky top-[57px] z-10 bg-cream/95 backdrop-blur border-b border-rule px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] text-ink-light">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={11} />
              Day {expandedDays.size > 0 ? Math.max(...Array.from(expandedDays)) + 1 : 0} of {validDays.length}
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign size={11} />
              ${expandedCost.toLocaleString()} spent
            </span>
            <span className="text-ink-muted">
              ${(totalBudget - expandedCost).toLocaleString()} left
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink">{pct}%</span>
        </div>
        <div className="h-[2px] bg-rule">
          <div className="h-full bg-terra transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-6 flex items-center justify-between border-b border-rule">
        <h2 className="font-serif text-2xl text-ink">Your Itinerary</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTracker(true)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] px-3 py-1.5 border border-rule text-ink-light hover:border-terra hover:text-terra transition-colors"
          >
            <DollarSign size={11} strokeWidth={1.5} />
            Track Expenses
          </button>
          <button onClick={expandAll} className="text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors">Expand All</button>
          <span className="text-ink-muted">/</span>
          <button onClick={collapseAll} className="text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors">Collapse</button>
        </div>
      </div>

      {/* Days */}
      <div>
        {validDays.map((day, idx) => {
          const isExpanded = expandedDays.has(idx);
          const dayColor = dayColors[idx % dayColors.length];
          const cumCost = cumulativeCosts[idx];
          const pctUsed = totalBudget > 0 ? Math.round((cumCost / totalBudget) * 100) : 0;

          return (
            <div key={idx} className="border-b border-rule">
              {/* Day header */}
              <button
                onClick={() => toggleDay(idx)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-cream-dark/30 transition-colors"
              >
                <div
                  className="w-8 h-8 flex items-center justify-center text-cream text-xs font-medium shrink-0"
                  style={{ backgroundColor: dayColor }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-lg text-ink">Day {idx + 1}</span>
                    <span className="text-xs text-ink-muted">{day.date}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-ink-light">
                    <span>{day.activities?.length || 0} activities</span>
                    <span>{day.meals?.length || 0} meals</span>
                    <span className="font-medium text-ink">${day._computedCost * travelers}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:block w-16">
                    <div className="h-[2px] bg-rule">
                      <div className="h-full bg-terra" style={{ width: `${Math.min(100, pctUsed)}%` }} />
                    </div>
                    <div className="text-[9px] text-ink-muted text-right mt-0.5">{pctUsed}%</div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2">
                  {/* Meals */}
                  {day.meals && day.meals.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">Meals</h4>
                      <div className="border-t border-rule">
                        {day.meals.map((meal, mIdx) => (
                          <MealCard key={mIdx} meal={meal} destination={tripData?.destination} onClick={() => { setSelectedEvent(meal); setIsActivity(false); setIsEventChatOpen(true); }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activities */}
                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">Activities</h4>
                    {day.activities.map((activity, aIdx) => (
                      <ActivityCard
                        key={aIdx}
                        activity={{ ...activity, _itinerary: itinerary }}
                        destination={tripData?.destination}
                        dayIndex={idx}
                        onClick={() => { setSelectedEvent(activity); setIsActivity(true); setIsEventChatOpen(true); }}
                      />
                    ))}
                  </div>

                  {/* Accommodation */}
                  {day.accommodation_options && <AccommodationOptions options={day.accommodation_options} destination={tripData?.destination} checkin={tripData?.dates?.start} checkout={tripData?.dates?.end} />}

                  {/* Daily total */}
                  <div className="flex justify-end pt-4 mt-4 border-t border-rule">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">Daily Total</p>
                      <p className="text-sm text-ink">
                        ${day._computedCost * travelers}
                        <span className="text-xs text-ink-muted"> / ${day._computedCost} per person</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      {itinerary.costBreakdown && (
        <div className="px-6 py-8 border-t border-rule">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-4">Cost Breakdown (Per Person)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-rule">
            {[
              { label: 'Activities', value: itinerary.costBreakdown.activities },
              { label: 'Food', value: itinerary.costBreakdown.food },
              { label: 'Transport', value: itinerary.costBreakdown.transportation },
              { label: 'Per Person', value: itinerary.perPersonTotal }
            ].map((item, i) => (
              <div key={item.label} className={`py-4 px-4 text-center ${i > 0 ? 'border-l border-rule' : ''}`}>
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-1">{item.label}</div>
                <div className="font-serif text-xl text-ink">${item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between py-4 border-t border-rule">
            <span className="text-sm text-ink-light">Total for {travelers} {travelers === 1 ? 'person' : 'people'}</span>
            <span className="font-serif text-3xl text-ink">${itinerary.groupTotal}</span>
          </div>
        </div>
      )}

      {/* Budget Tracker Overlay */}
      {showTracker && (
        <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
          <BudgetTracker
            itinerary={itinerary}
            tripData={tripData}
            onClose={() => setShowTracker(false)}
          />
        </div>
      )}

      {/* Event Chat */}
      {isEventChatOpen && selectedEvent && (
        <EventChat
          event={selectedEvent}
          isActivity={isActivity}
          currentItinerary={itinerary}
          onClose={() => { setIsEventChatOpen(false); setSelectedEvent(null); }}
          onEventUpdate={handleEventUpdate}
        />
      )}
    </div>
  );
};

export default ItineraryDisplay;
