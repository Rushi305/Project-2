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
GEMINI_API_KEY=your