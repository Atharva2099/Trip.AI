// src/components/ItineraryDisplay.js
import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Plane, Train, Bus, Car, Navigation,
  DollarSign, CalendarDays, AlertTriangle, ExternalLink
} from 'lucide-react';
import { BookmarkButton } from './BookmarksPage';
import BudgetTracker from './BudgetTracker';
import EventChat from './EventChat';
import {
  getActivityLinks,
  getMealLinks,
  getAccommodationLinks,
  getGoogleFlightsUrl,
  getRome2RioUrl
} from '../utils/booking';
import { DAY_COLORS } from '../utils/colors';

export { DAY_COLORS };

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
      a._uid !== activity._uid &&
      similarTypes[activityType].some(keyword =>
        a.name.toLowerCase().includes(keyword) ||
        a.description.toLowerCase().includes(keyword)
      )
    )
  );
  return similarActivities.length > 0 ? { type: activityType, activities: similarActivities } : null;
};

function decorateItinerary(itinerary) {
  if (!itinerary?.days) return itinerary;
  const cloned = JSON.parse(JSON.stringify(itinerary));
  cloned.days.forEach((day, di) => {
    (day.activities || []).forEach((a, ai) => { a._uid = `d${di}a${ai}`; });
    (day.meals || []).forEach((m, mi) => { m._uid = `d${di}m${mi}`; });
  });
  return cloned;
}

function ActivityCard({ activity, onClick, destination }) {
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

function AccommodationOptions({ options, destination, checkin, checkout, numPeople }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-rule">
      <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-3">Where to Stay</h4>
      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={opt._uid || i} className="border-l-2 border-terra pl-4 py-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-ink">{opt.name}</div>
                <div className="text-xs text-ink-light">{opt.description}</div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {getAccommodationLinks(opt, destination, checkin, checkout, numPeople).map(link => (
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

const MODE_ICONS = {
  plane: Plane,
  flight: Plane,
  train: Train,
  bus: Bus,
  car: Car,
  taxi: Car,
  walk: Navigation
};

function TransportIcon({ mode }) {
  if (!mode) return null;
  const key = mode.toLowerCase();
  const Icon = MODE_ICONS[key] || Car;
  return <Icon size={13} strokeWidth={1.5} />;
}

function TransportLeg({ leg, isAlt }) {
  if (!leg?.primary) return null;
  const { primary, alternatives } = leg;
  const Icon = TransportIcon({ mode: primary.mode });
  return (
    <div className={isAlt ? 'mt-3 pt-3 border-t border-rule' : ''}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex items-center justify-center border border-rule text-ink shrink-0">
          {Icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-sm text-ink capitalize">{primary.mode}</span>
            {primary.duration && <span className="text-xs text-ink-light">· {primary.duration}</span>}
            {primary.cost_per_person !== undefined && (
              <span className="text-xs font-medium text-ink">· ${primary.cost_per_person}/person</span>
            )}
          </div>
          {primary.details && (
            <p className="text-xs text-ink-light mt-0.5">{primary.details}</p>
          )}
        </div>
      </div>
      {isAlt && <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mt-2">Alternative</p>}
      {Array.isArray(alternatives) && alternatives.map((alt, i) => {
        const AltIcon = TransportIcon({ mode: alt.mode });
        return (
          <div key={i} className="flex items-start gap-3 mt-2 pl-11">
            <div className="w-6 h-6 flex items-center justify-center text-ink-light shrink-0">
              {AltIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs text-ink-light capitalize">{alt.mode}</span>
                {alt.duration && <span className="text-xs text-ink-muted">· {alt.duration}</span>}
                {alt.cost_per_person !== undefined && (
                  <span className="text-xs text-ink-muted">· ${alt.cost_per_person}/person</span>
                )}
              </div>
              {alt.details && <p className="text-xs text-ink-muted mt-0.5">{alt.details}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TravelSection({ from, to, transportTo, transportBack, dates }) {
  if (!transportTo?.primary && !transportBack?.primary) return null;
  const startDate = dates?.start;
  const endDate = dates?.end;
  return (
    <div className="px-6 py-6 border-b border-rule bg-cream-dark/40">
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-4">Travel</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-2">Getting There</p>
          <TransportLeg leg={transportTo} />
          {from && to && startDate && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(() => {
                const url = getGoogleFlightsUrl(from, to, startDate, endDate);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={9} /> Google Flights
                  </a>
                ) : null;
              })()}
              {(() => {
                const url = getRome2RioUrl(from, to);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={9} /> Rome2Rio
                  </a>
                ) : null;
              })()}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mb-2">Getting Back</p>
          <TransportLeg leg={transportBack} />
          {from && to && endDate && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(() => {
                const url = getGoogleFlightsUrl(to, from, endDate, endDate);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={9} /> Google Flights
                  </a>
                ) : null;
              })()}
              {(() => {
                const url = getRome2RioUrl(to, from);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors" onClick={e => e.stopPropagation()}>
                    <ExternalLink size={9} /> Rome2Rio
                  </a>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mt-4">
        Prices are estimates — verify before booking
      </p>
    </div>
  );
}

const ItineraryDisplay = ({ itinerary, tripData, onItineraryUpdate, model, provider }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventChatOpen, setIsEventChatOpen] = useState(false);
  const [isActivity, setIsActivity] = useState(true);
  const [expandedDays, setExpandedDays] = useState(new Set([0]));
  const [showTracker, setShowTracker] = useState(false);

  const decorated = useMemo(() => decorateItinerary(itinerary), [itinerary]);

  const totalBudget = tripData?.budget || itinerary?.groupTotal || 0;
  const travelers = tripData?.numPeople || 1;

  const validDays = useMemo(() => {
    if (!decorated) return [];
    return (decorated.days || [])
      .filter(day => day.activities && day.activities.length > 0)
      .map((day, idx) => ({ ...day, _computedCost: computeDayCost(day), _dayIndex: idx }));
  }, [decorated]);

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
    const updatedItinerary = JSON.parse(JSON.stringify(decorated));
    let replaced = false;
    updatedItinerary.days.forEach(day => {
      const list = isActivity ? day.activities : day.meals;
      const i = list.findIndex(e => e._uid === selectedEvent._uid);
      if (i !== -1) {
        list[i] = { ...updatedEvent, _uid: selectedEvent._uid };
        replaced = true;
        day.dailyTotal = computeDayCost(day);
      }
    });
    if (replaced) onItineraryUpdate(updatedItinerary);
  };

  const expandedIndices = Array.from(expandedDays);
  const expandedCost = expandedIndices.length > 0
    ? Math.max(...expandedIndices.map(i => cumulativeCosts[i] || 0))
    : 0;
  const pct = totalBudget > 0 ? Math.min(100, Math.round((expandedCost / totalBudget) * 100)) : 0;

  const topDay = expandedIndices.length > 0 ? Math.max(...expandedIndices) + 1 : 0;

  const fromName = itinerary.from || tripData?.from?.fullName || tripData?.from;
  const toName = itinerary.to || tripData?.destination;

  return (
    <div className="border-t border-rule">
      {/* Sticky budget bar */}
      <div className="sticky top-[57px] z-10 bg-cream/95 backdrop-blur border-b border-rule px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] text-ink-light">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={11} />
              {expandedIndices.length > 0 ? `Day ${topDay}` : `${validDays.length} days`} of {validDays.length}
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
        <div>
          <h2 className="font-serif text-2xl text-ink">Your Itinerary</h2>
          {fromName && toName && (
            <p className="text-xs text-ink-muted mt-1">
              {fromName} → {toName} → {fromName}
            </p>
          )}
        </div>
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

      {/* Travel section */}
      <TravelSection
        from={fromName}
        to={toName}
        transportTo={itinerary.transport_to_destination}
        transportBack={itinerary.transport_back_home}
        dates={tripData?.dates}
      />

      {/* Days */}
      <div>
        {validDays.map((day, idx) => {
          const isExpanded = expandedDays.has(idx);
          const dayColor = DAY_COLORS[idx % DAY_COLORS.length];
          const cumCost = cumulativeCosts[idx];
          const pctUsed = totalBudget > 0 ? Math.round((cumCost / totalBudget) * 100) : 0;

          return (
            <div key={idx} className="border-b border-rule">
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

              {isExpanded && (
                <div className="px-6 pb-6 pt-2">
                  {day.meals && day.meals.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">Meals</h4>
                      <div className="border-t border-rule">
                        {day.meals.map((meal, mIdx) => (
                          <MealCard key={meal._uid || mIdx} meal={meal} destination={tripData?.destination} onClick={() => { setSelectedEvent(meal); setIsActivity(false); setIsEventChatOpen(true); }} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-2">Activities</h4>
                    {day.activities.map((activity, aIdx) => (
                      <ActivityCard
                        key={activity._uid || aIdx}
                        activity={{ ...activity, _itinerary: decorated }}
                        destination={tripData?.destination}
                        onClick={() => { setSelectedEvent(activity); setIsActivity(true); setIsEventChatOpen(true); }}
                      />
                    ))}
                  </div>

                  {day.accommodation_options && <AccommodationOptions options={day.accommodation_options} destination={tripData?.destination} checkin={tripData?.dates?.start} checkout={tripData?.dates?.end} numPeople={travelers} />}

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

      {showTracker && (
        <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
          <BudgetTracker
            itinerary={itinerary}
            tripData={tripData}
            onClose={() => setShowTracker(false)}
          />
        </div>
      )}

      {isEventChatOpen && selectedEvent && (
        <EventChat
          event={selectedEvent}
          isActivity={isActivity}
          currentItinerary={decorated}
          model={model}
          provider={provider}
          onClose={() => { setIsEventChatOpen(false); setSelectedEvent(null); }}
          onEventUpdate={handleEventUpdate}
        />
      )}
    </div>
  );
};

export default ItineraryDisplay;
