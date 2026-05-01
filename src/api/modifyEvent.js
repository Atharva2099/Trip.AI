const API_BASE = 'https://tripai-api.athuspydy.workers.dev';

export const modifyEvent = async (message, context, currentItinerary) => {
  try {
    const response = await fetch(`${API_BASE}/api/modify-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, currentItinerary })
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
