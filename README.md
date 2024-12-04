# TripAI

An AI-powered travel itinerary generator that creates personalized trip plans based on your preferences, including interactive maps and detailed daily schedules.

## Features

- Custom itinerary generation based on:
  - Destination
  - Date range
  - Budget
  - Interests
- Interactive map with location markers
- Detailed daily schedules
- Cost estimates
- Navigation links for each location
- OpenStreetMap integration

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tripai.git
cd tripai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Groq API key:
```
REACT_APP_GROQ_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm start
```

## Technologies Used

- React
- Tailwind CSS
- Leaflet Maps
- Groq API (llama3-8b-8192)
- OpenStreetMap

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)