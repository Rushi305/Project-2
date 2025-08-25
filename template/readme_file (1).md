# Revolt Motors Voice Assistant

A real-time conversational voice interface using the Gemini Live API that replicates the functionality of the Revolt Motors chatbot. This application features natural conversation flow, interruption handling, and low-latency responses.

## Features

- **Real-time Voice Interaction**: Natural conversation with AI using voice input and audio responses
- **Interruption Support**: Users can interrupt the AI mid-response for dynamic conversations
- **Low Latency**: Optimized for quick response times (1-2 seconds)
- **Server-to-Server Architecture**: Built with Node.js/Express backend and WebSocket communication
- **Responsive UI**: Clean, modern interface that works on desktop and mobile
- **Revolt Motors Focused**: AI assistant specifically trained to discuss Revolt Motors and electric vehicles

## Tech Stack

- **Backend**: Node.js, Express.js, WebSocket
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: Google Gemini Live API (gemini-2.5-flash-preview-native-audio-dialog)
- **Real-time Communication**: WebSocket for low-latency audio streaming

## Prerequisites

- Node.js 18+ installed
- Google Gemini API key (free tier available at [aistudio.google.com](https://aistudio.google.com))
- Modern web browser with microphone access

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd revolt-motors-voice-assistant
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=development
```

### 4. Get Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Get API Key" in the top right
4. Create a new API key
5. Copy the key to your `.env` file

### 5. Start the Development Server

```bash
npm run dev
# or
npm start
```

The server will start on `http://localhost:3000`

### 6. Test the Application

1. Open your browser and navigate to `http://localhost:3000`
2. Allow microphone access when prompted
3. Hold down the microphone button to speak
4. Release to send your message
5. The AI will respond with both text and audio

## Usage Guide

### Basic Controls

- **Hold Mic Button**: Record your voice message
- **Release Mic Button**: Send the recorded message to AI
- **Stop AI Button**: Interrupt the AI while it's speaking
- **Clear Chat Button**: Clear the conversation history

### Voice Interaction Tips

- Speak clearly and at normal volume
- Wait for the "Ready to chat" status before speaking
- You can interrupt the AI at any time by clicking "Stop AI"
- The app works best with questions about Revolt Motors and electric vehicles

## API Model Configuration

The application is configured to use:
- **Production**: `gemini-2.5-flash-preview-native-audio-dialog` (recommended, but has rate limits)
- **Development**: `gemini-2.0-flash-live-001` or `gemini-live-2.5-flash-preview` (for testing)

To change the model, edit the model name in `server.js`:

```javascript
this.session = await this.genAI.startLiveSession({
  model: 'gemini-2.0-flash-live-001', // Change this line
  systemInstruction: SYSTEM_INSTRUCTIONS,
  // ... other config
});
```

## System Instructions

The AI is configured with specific instructions to:
- Only discuss Revolt Motors and related electric vehicle topics
- Provide enthusiastic and knowledgeable responses about Revolt products
- Redirect non-related queries back to Revolt Motors
- Keep responses concise but informative

You can modify the system instructions in `server.js` in the `SYSTEM_INSTRUCTIONS` constant.

## Troubleshooting

### Common Issues

1. **"Microphone access denied"**
   - Ensure your browser has microphone permissions
   - Check if other applications are using the microphone
   - Try refreshing the page and allowing access again

2. **"Connection error"**
   - Verify your API key is correct in the `.env` file
   - Check your internet connection
   - Ensure the Gemini API key has sufficient quota

3. **High latency or slow responses**
   - Switch to a development model if using the native audio dialog model
   - Check your network connection speed
   - Consider upgrading your Gemini API plan

4. **Audio not playing**
   - Check browser audio settings
   - Ensure volume is turned up
   - Try a different browser

### Rate Limits

The free tier of Gemini API has rate limits:
- **gemini-2.5-flash-preview-native-audio-dialog**: Strict daily limits
- **gemini-2.0-flash-live-001**: More generous limits for development

For extensive testing, use the development models or consider upgrading your API plan.

## File Structure

```
revolt-motors-voice-assistant/
├── server.js                 # Main server file with WebSocket and Gemini integration
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (create this)
├── .env.example             # Environment variables template
├── README.md                # This file
└── public/
    └── index.html           # Frontend application
```

## Architecture

### Server-to-Server Flow

1. **Client** connects via WebSocket to **Node.js Server**
2. **Server** initializes Gemini Live session
3. **Client** sends audio data to **Server**
4. **Server** forwards audio to **Gemini Live API**
5. **Gemini** processes and returns audio response
6. **Server** streams response back to **Client**
7. **Client** plays audio response

### Key Components

- **GeminiLiveSession Class**: Manages the Gemini Live API connection
- **WebSocket Server**: Handles real-time communication with frontend
- **Audio Processing**: Handles recording, encoding, and playback
- **UI Components**: Voice controls, visualizer, and status updates

## Development vs Production

### Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm start    # Standard node server
```

For production deployment:
1. Set `NODE_ENV=production` in your `.env`
2. Consider using PM2 or similar process manager
3. Set up HTTPS/SSL for secure microphone access
4. Configure proper CORS if deploying to different domains

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the [Gemini Live API documentation](https://ai.google.dev/gemini-api/docs/live)
3. Test with the [Interactive Playground](https://aistudio.google.com/live)
4. Create an issue in this repository