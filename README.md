# Trip.AI 

An AI-powered travel itinerary generator that creates personalized trip plans based on your preferences, including interactive maps, detailed daily schedules, and cost estimates.

## 🚀 Try It Now!

Visit [Trip.AI](https://atharva2099.github.io/Trip.AI/) to plan your next adventure. You'll need an OpenRouter API key to get started - get one for free at [OpenRouter](https://openrouter.ai/keys).

## ✨ Features

- Custom itinerary generation based on:
  - Destination
  - Date range
  - Budget
  - Number of travelers
  - Interests
- Interactive map with location markers and routes
- Detailed daily schedules with activities and meals
- Cost estimates and breakdowns
- Real-time navigation links
- OpenStreetMap integration
- Interactive customization - chat with the AI to modify any aspect of your itinerary, from restaurants to activity timings, ensuring your plan is perfect for you
- **Multiple AI models** - choose from Kimi, Mistral, MiniMax, DeepSeek, Claude, and more via OpenRouter

## 🔑 API Setup

Trip.AI uses the OpenRouter API for generating travel itineraries. To use the application:

1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Sign up for an account
3. Generate a new API key
4. Use the key in the application when creating itineraries

Your API key is stored locally in your browser and is never sent to our servers. This ensures you have full control over your API usage and costs.

### Supported Models

Choose the AI model that best fits your needs:

| Model ID | Provider | Notes |
|----------|----------|-------|
| `qwen/qwen3.6-max-preview` | Alibaba Cloud | Strong reasoning, default choice |
| `moonshotai/kimi-k2.6` | Moonshot AI | Excellent long-context and planning |
| `deepseek/deepseek-v4-pro` | DeepSeek | Top-tier reasoning and coding |
| `google/gemma-4-31b-it:free` | Google | Free tier, fast and capable |

## 🛠️ Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/Atharva2099/Trip.AI.git
cd Trip.AI
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

4. Create a .env file and add your API key using the env variable (No spaces):
```Text
REACT_APP_OPENROUTER_API_KEY=
```


## 💻 Technologies Used

- React
- Tailwind CSS
- Leaflet Maps
- OpenRouter API (Kimi, Mistral, MiniMax, DeepSeek, Claude, Gemma)
- OpenStreetMap
- date-fns
- shadcn/ui components

## 📝 Usage Notes

- Each itinerary generation requires one API call to OpenRouter
- Monitor your API usage and credits in your [OpenRouter dashboard](https://openrouter.ai/settings/credits)
- Free tier limits apply based on your OpenRouter account and the model chosen
- Keep your API key secure and never share it

## 📧 Contact

- GitHub: [@FullMLAlchemist](https://github.com/Atharva2099)
- Twitter: [@Attharave](https://x.com/attharave)

---
<p align="center">
  Made with ☕️  by FullMLAlchemist
</p>

<p align="center">
  <small>Location icons created by Freepik - Flaticon</small>
</p>)
