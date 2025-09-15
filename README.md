# 🌍 Multilingual Chat PWA

A Progressive Web App for seamless multilingual communication with real-time translation using ChatGPT API.

## Features

- **Language Selection**: Choose from 12+ languages for both users
- **Real-time Translation**: Automatic translation using ChatGPT API
- **Show Original**: Toggle between translated and original text
- **PWA Support**: Installable on mobile devices like a native app
- **Offline Support**: Works offline with cached content
- **Mobile-First Design**: Optimized for mobile devices
- **User Switching**: Easy switching between User 1 and User 2

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add your OpenAI API key** (optional):
   - Create a `.env` file in the root directory
   - Add: `REACT_APP_OPENAI_API_KEY=your_api_key_here`
   - Without an API key, the app will use mock translations for demo purposes

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Usage

1. **Select Languages**: Choose languages for both User 1 and User 2
2. **Start Chatting**: Type messages as either user
3. **Automatic Translation**: Messages are automatically translated if languages differ
4. **Toggle Original**: Click "Show original" to see the original text
5. **Switch Users**: Use the "Switch to User X" button to change perspective

## Installation as PWA

1. Open the app in your mobile browser
2. Look for the "Add to Home Screen" option in your browser menu
3. Tap to install the app on your device
4. The app will now work like a native mobile app!

## Supported Languages

- 🇺🇸 English
- 🇪🇸 Spanish
- 🇫🇷 French
- 🇩🇪 German
- 🇮🇹 Italian
- 🇵🇹 Portuguese
- 🇷🇺 Russian
- 🇯🇵 Japanese
- 🇰🇷 Korean
- 🇨🇳 Chinese
- 🇸🇦 Arabic
- 🇮🇳 Hindi

## Technology Stack

- React 18 with TypeScript
- PWA (Progressive Web App)
- Service Worker for offline support
- OpenAI ChatGPT API for translation
- Mobile-first responsive design
- CSS Grid and Flexbox for layout

## API Integration

The app uses the OpenAI ChatGPT API for high-quality translations. To use real translations:

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add it to your `.env` file as `REACT_APP_OPENAI_API_KEY`
3. The app will automatically use the API for translations

Without an API key, the app falls back to mock translations for demonstration purposes.

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
