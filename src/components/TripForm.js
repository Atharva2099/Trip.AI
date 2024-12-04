import React, { useState } from 'react';

const TripForm = ({ onSubmit, disabled }) => {
  const [formData, setFormData] = useState({
    destination: '',
    dates: {
      start: '',
      end: ''
    },
    budget: '',
    interests: '',
    additionalNotes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-6">Plan Your Trip</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Destination
          </label>
          <input
            type="text"
            value={formData.destination}
            onChange={(e) => setFormData({...formData, destination: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formData.dates.start}
              onChange={(e) => setFormData({
                ...formData, 
                dates: {...formData.dates, start: e.target.value}
              })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={formData.dates.end}
              onChange={(e) => setFormData({
                ...formData, 
                dates: {...formData.dates, end: e.target.value}
              })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget (USD)
          </label>
          <input
            type="number"
            value={formData.budget}
            onChange={(e) => setFormData({...formData, budget: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interests (comma-separated)
          </label>
          <input
            type="text"
            value={formData.interests}
            onChange={(e) => setFormData({...formData, interests: e.target.value})}
            className="w-full p-2 border rounded-md"
            placeholder="e.g., hiking, food, museums"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes
          </label>
          <textarea
            value={formData.additionalNotes}
            onChange={(e) => setFormData({...formData, additionalNotes: e.target.value})}
            className="w-full p-2 border rounded-md"
            rows="3"
          />
        </div>

        <button 
          type="submit"
          disabled={disabled}
          className={`w-full p-3 rounded-md transition-colors ${
            disabled 
            ? 'bg-blue-300 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {disabled ? 'Generating...' : 'Generate Itinerary'}
        </button>
      </form>
    </div>
  );
};

export default TripForm;