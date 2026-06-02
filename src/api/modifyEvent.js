import { API_BASE } from '../config';

export const modifyEvent = async (message, context, currentItinerary, model, provider) => {
  try {
    const grounding = {
      destination: currentItinerary?.to || currentItinerary?.destination,
      home: currentItinerary?.from
    };

    const response = await fetch(`${API_BASE}/api/modify-event`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, currentItinerary, model, provider, grounding })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      message: data.message,
      updatedEvent: data.updatedEvent
    };
  } catch (error) {
    console.error('Error modifying event:', error);
    throw error;
  }
};
