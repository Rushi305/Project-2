const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { GoogleGenAI, Modality } = require('@google/genai');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enhanced middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Initialize Gemini AI
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Enhanced system instructions with dynamic context awareness
const ENHANCED_SYSTEM_INSTRUCTIONS = `You are Rev, the advanced AI assistant for Revolt Motors, India's premier electric motorcycle company. You have enhanced capabilities to understand context, user intent, and provide personalized responses.

CORE IDENTITY & KNOWLEDGE:
- Company: Revolt Motors (Founded 2019)
- Products: RV400 BRZ, RV400 Prime, RV320 electric motorcycles
- Key Features: AI-enabled, smart connectivity, swappable batteries, mobile app integration
- Mission: Sustainable urban mobility solutions
- Availability: 40+ cities across India
- Services: Subscription plans, financing, service network

ENHANCED CAPABILITIES:
1. CONTEXT AWARENESS: Remember conversation history and user preferences
2. INTENT DETECTION: Understand user goals (purchase, service, information, comparison)
3. PERSONALIZED RESPONSES: Adapt tone and content based on user profile
4. PROACTIVE SUGGESTIONS: Offer relevant information before asked
5. EMOTIONAL INTELLIGENCE: Respond appropriately to user emotions
6. MULTI-MODAL SUPPORT: Handle text, voice, and visual inputs

RESPONSE PATTERNS:
- NEW USERS: Welcome warmly, explain Revolt's vision, highlight key benefits
- RETURNING USERS: Reference previous interactions, build on past conversations
- PURCHASE INTENT: Guide through product selection, pricing, financing options
- TECHNICAL QUERIES: Provide detailed specifications, comparisons, maintenance tips
- SERVICE ISSUES: Show empathy, provide solutions, escalate when needed
- GENERAL INTEREST: Share sustainability insights, EV market trends, Revolt news

PERSONALITY TRAITS:
- Enthusiastic about electric mobility and sustainability
- Knowledgeable but not overwhelming
- Helpful and solution-oriented
- Professional yet friendly
- Proactive in offering assistance
- Respectful of user privacy and preferences

CONVERSATION GUIDELINES:
- Always stay focused on Revolt Motors and electric mobility
- For off-topic queries, politely redirect to Revolt-related topics
- Use emojis and formatting to make responses engaging
- Provide actionable information and next steps
- Ask relevant follow-up questions to better assist users
- Maintain conversation flow and context

Remember: You're not just answering questions - you're building relationships and helping users discover how Revolt Motors can transform their mobility experience.`;

// User session management
class UserSession {
  constructor(userId) {
    this.userId = userId;
    this.conversationHistory = [];
    this.userProfile = {
      preferences: {},
      intent: null,
      location: null,
      interests: [],
      previousQueries: [],
      sessionStartTime: new Date(),
      interactionCount: 0
    };
    this.contextMemory = new Map();
  }

  addMessage(role, content, metadata = {}) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    this.userProfile.interactionCount++;
    
    // Keep only last 50 messages for performance
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  updateUserIntent(intent) {
    this.userProfile.intent = intent;
    this.contextMemory.set('currentIntent', intent);
  }

  setUserLocation(location) {
    this.userProfile.location = location;
  }

  addUserInterest(interest) {
    if (!this.userProfile.interests.includes(interest)) {
      this.userProfile.interests.push(interest);
    }
  }

  getContextualPrompt() {
    let contextPrompt = ENHANCED_SYSTEM_INSTRUCTIONS;
    
    if (this.conversationHistory.length > 0) {
      contextPrompt += `\n\nCONVERSATION CONTEXT:`;
      contextPrompt += `\n- User has had ${this.userProfile.interactionCount} interactions`;
      contextPrompt += `\n- Current session duration: ${Math.round((new Date() - this.userProfile.sessionStartTime) / 1000 / 60)} minutes`;
      
      if (this.userProfile.intent) {
        contextPrompt += `\n- Detected user intent: ${this.userProfile.intent}`;
      }
      
      if (this.userProfile.location) {
        contextPrompt += `\n- User location: ${this.userProfile.location}`;
      }
      
      if (this.userProfile.interests.length > 0) {
        contextPrompt += `\n- User interests: ${this.userProfile.interests.join(', ')}`;
      }
      
      // Add recent conversation context
      const recentMessages = this.conversationHistory.slice(-5);
      contextPrompt += `\n\nRECENT CONVERSATION:`;
      recentMessages.forEach(msg => {
        contextPrompt += `\n${msg.role}: ${msg.content.substring(0, 200)}`;
      });
    }
    
    return contextPrompt;
  }
}

// Enhanced Gemini Live Session with auto-response generation and voice support
class EnhancedGeminiSession {
  constructor(ws, userId) {
    this.ws = ws;
    this.userId = userId;
    this.userSession = new UserSession(userId);
    this.session = null;
    this.isConnected = false;
    this.autoResponseEnabled = true;
    this.responsePersonality = 'enthusiastic'; // enthusiastic, professional, casual, technical
    this.voiceSettings = {
      provider: 'browser', // browser, google, azure, amazon
      voice: 'default',
      language: 'en-IN',
      speed: 1.0,
      pitch: 1.0,
      volume: 0.8,
      gender: 'female' // male, female, neutral
    };
    this.availableVoices = this.initializeVoiceOptions();
  }

  initializeVoiceOptions() {
    return {
      browser: {
        'en-IN': [
          { name: 'Google हिन्दी', gender: 'female', lang: 'hi-IN' },
          { name: 'Google English (India)', gender: 'female', lang: 'en-IN' },
          { name: 'Microsoft Heera - English (India)', gender: 'female', lang: 'en-IN' },
          { name: 'Microsoft Ravi - English (India)', gender: 'male', lang: 'en-IN' }
        ],
        'en-US': [
          { name: 'Google US English Female', gender: 'female', lang: 'en-US' },
          { name: 'Google US English Male', gender: 'male', lang: 'en-US' },
          { name: 'Microsoft Zira - English (United States)', gender: 'female', lang: 'en-US' },
          { name: 'Microsoft David - English (United States)', gender: 'male', lang: 'en-US' }
        ]
      },
      google: {
        'en-IN': [
          { name: 'en-IN-Standard-A', gender: 'female', type: 'Standard' },
          { name: 'en-IN-Standard-B', gender: 'male', type: 'Standard' },
          { name: 'en-IN-Standard-C', gender: 'male', type: 'Standard' },
          { name: 'en-IN-Standard-D', gender: 'female', type: 'Standard' },
          { name: 'en-IN-Wavenet-A', gender: 'female', type: 'WaveNet' },
          { name: 'en-IN-Wavenet-B', gender: 'male', type: 'WaveNet' },
          { name: 'en-IN-Wavenet-C', gender: 'male', type: 'WaveNet' },
          { name: 'en-IN-Wavenet-D', gender: 'female', type: 'WaveNet' },
          { name: 'en-IN-Neural2-A', gender: 'female', type: 'Neural2' },
          { name: 'en-IN-Neural2-B', gender: 'male', type: 'Neural2' },
          { name: 'en-IN-Neural2-C', gender: 'male', type: 'Neural2' },
          { name: 'en-IN-Neural2-D', gender: 'female', type: 'Neural2' }
        ]
      },
      azure: {
        'en-IN': [
          { name: 'en-IN-NeerjaNeural', gender: 'female', style: 'General' },
          { name: 'en-IN-PrabhatNeural', gender: 'male', style: 'General' },
          { name: 'hi-IN-MadhurNeural', gender: 'male', style: 'General' },
          { name: 'hi-IN-SwaraNeural', gender: 'female', style: 'General' }
        ]
      }
    };
  }

  async initialize() {
    try {
      console.log(`Initializing enhanced Gemini session for user: ${this.userId}`);
      
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      
      const config = {
        responseModalities: [Modality.TEXT],
        systemInstruction: this.userSession.getContextualPrompt(),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
          topP: 0.95,
          topK: 40,
        }
      };

      // For text-based model (fallback if live not available)
      this.model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: config.systemInstruction,
        generationConfig: config.generationConfig
      });

      this.isConnected = true;
      this.sendToClient({
        type: 'session_ready',
        data: {
          userId: this.userId,
          capabilities: ['text', 'context_awareness', 'auto_responses', 'intent_detection', 'voice_synthesis'],
          availableVoices: this.availableVoices,
          currentVoice: this.voiceSettings
        }
      });

      // Send welcome message based on user session
      await this.generateWelcomeMessage();

    } catch (error) {
      console.error('Failed to initialize enhanced Gemini session:', error);
      this.sendToClient({
        type: 'initialization_error',
        message: error.message
      });
    }
  }

  async generateWelcomeMessage() {
    const isReturningUser = this.userSession.userProfile.interactionCount > 0;
    let welcomePrompt;
    
    if (isReturningUser) {
      welcomePrompt = "Welcome back! I remember our previous conversations. How can I help you with Revolt Motors today?";
    } else {
      welcomePrompt = "Welcome to Revolt Motors! I'm Rev, your AI assistant. I'm here to help you discover our revolutionary electric motorcycles and sustainable mobility solutions. What would you like to know?";
    }
    
    try {
      const response = await this.generateResponse(welcomePrompt, true);
      this.sendToClient({
        type: 'auto_welcome',
        data: response
      });
    } catch (error) {
      console.error('Error generating welcome message:', error);
    }
  }

  async handleUserInput(input, inputType = 'text') {
    try {
      // Detect user intent
      const detectedIntent = await this.detectUserIntent(input);
      this.userSession.updateUserIntent(detectedIntent);

      // Extract user interests/preferences
      await this.extractUserPreferences(input);

      // Add to conversation history
      this.userSession.addMessage('user', input, { type: inputType, intent: detectedIntent });

      // Generate contextual response
      const response = await this.generateResponse(input);

      // Add AI response to history
      this.userSession.addMessage('assistant', response, { 
        type: 'generated_response',
        personality: this.responsePersonality 
      });

      // Send response to client
      this.sendToClient({
        type: 'ai_response',
        data: {
          text: response,
          intent: detectedIntent,
          suggestions: await this.generateSuggestions(detectedIntent),
          voiceData: await this.generateVoiceResponse(response),
          metadata: {
            responseTime: new Date(),
            confidence: 0.95,
            personality: this.responsePersonality,
            voiceSettings: this.voiceSettings
          }
        }
      });

      // Generate proactive follow-up if appropriate
      setTimeout(() => {
        this.generateProactiveResponse(detectedIntent);
      }, 2000);

    } catch (error) {
      console.error('Error handling user input:', error);
      this.sendToClient({
        type: 'error',
        message: 'Failed to process your message. Please try again.'
      });
    }
  }

  async generateResponse(input, isWelcome = false) {
    try {
      const contextualPrompt = this.userSession.getContextualPrompt();
      
      let prompt = `${contextualPrompt}\n\nUser: ${input}\n\nPlease provide a helpful, engaging response that:
      1. Addresses the user's specific question or need
      2. Maintains conversation context and continuity  
      3. Offers relevant Revolt Motors information
      4. Includes a follow-up question or suggestion when appropriate
      5. Uses an ${this.responsePersonality} tone
      
      Response:`;

      if (isWelcome) {
        prompt = `${contextualPrompt}\n\nGenerate a personalized welcome message for this user. Consider their session context and make it engaging.`;
      }

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      return "I apologize, but I'm having trouble generating a response right now. Please try again or contact our support team for assistance.";
    }
  }

  async detectUserIntent(input) {
    try {
      const intentPrompt = `Analyze the following user message and detect the primary intent. Respond with only one word from these options: purchase, service, information, comparison, complaint, general, technical, financing, booking.

User message: "${input}"

Intent:`;

      const result = await this.model.generateContent(intentPrompt);
      const intent = result.response.text().trim().toLowerCase();
      
      return ['purchase', 'service', 'information', 'comparison', 'complaint', 'general', 'technical', 'financing', 'booking'].includes(intent) 
        ? intent 
        : 'general';
    } catch (error) {
      console.error('Error detecting intent:', error);
      return 'general';
    }
  }

  async extractUserPreferences(input) {
    try {
      // Simple keyword extraction for user interests
      const keywords = ['RV400', 'RV320', 'battery', 'range', 'price', 'service', 'app', 'charging', 'subscription'];
      keywords.forEach(keyword => {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          this.userSession.addUserInterest(keyword);
        }
      });

      // Extract location mentions
      const locationMatch = input.match(/(?:in|from|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (locationMatch) {
        this.userSession.setUserLocation(locationMatch[1]);
      }
    } catch (error) {
      console.error('Error extracting preferences:', error);
    }
  }

  async generateSuggestions(intent) {
    const suggestions = {
      purchase: ["Compare RV400 vs RV320", "Check financing options", "Find nearest dealer", "Book test ride"],
      service: ["Find service center", "Book service appointment", "Check warranty", "Maintenance tips"],
      information: ["Explore features", "Check specifications", "Learn about battery", "See pricing"],
      technical: ["Battery specifications", "Range calculator", "Charging options", "App features"],
      financing: ["EMI calculator", "Subscription plans", "Exchange offers", "Bank partnerships"],
      general: ["Product overview", "Why choose Revolt", "Sustainability benefits", "Customer stories"]
    };

    return suggestions[intent] || suggestions.general;
  }

  async generateProactiveResponse(intent) {
    if (!this.autoResponseEnabled) return;

    try {
      let proactiveMessage = null;

      switch (intent) {
        case 'purchase':
          proactiveMessage = "💡 Pro tip: You can also explore our subscription plans starting at just ₹3,499/month. Would you like me to explain how it works?";
          break;
        case 'technical':
          proactiveMessage = "🔧 Did you know our motorcycles come with smart features like geo-fencing and ride analytics through the MyRevolt app?";
          break;
        case 'service':
          proactiveMessage = "📅 Quick reminder: Regular software updates are available through our app to keep your motorcycle running at peak performance!";
          break;
      }

      if (proactiveMessage) {
        setTimeout(() => {
          this.sendToClient({
            type: 'proactive_message',
            data: proactiveMessage
          });
        }, 5000);
      }
    } catch (error) {
      console.error('Error generating proactive response:', error);
    }
  }

  async generateVoiceResponse(text) {
    try {
      // For browser-based TTS, just return the settings
      if (this.voiceSettings.provider === 'browser') {
        return {
          provider: 'browser',
          text: text,
          settings: this.voiceSettings,
          ssml: this.generateSSML(text)
        };
      }

      // For external TTS providers, you would integrate their APIs here
      // This is a placeholder for Google Cloud Text-to-Speech, Azure Speech, etc.
      return {
        provider: this.voiceSettings.provider,
        text: text,
        settings: this.voiceSettings,
        audioUrl: null, // Would contain the generated audio URL
        ssml: this.generateSSML(text)
      };

    } catch (error) {
      console.error('Error generating voice response:', error);
      return null;
    }
  }

  generateSSML(text) {
    // Generate SSML (Speech Synthesis Markup Language) for better voice control
    const { speed, pitch, volume } = this.voiceSettings;
    
    let ssml = `<speak>`;
    ssml += `<prosody rate="${speed}" pitch="${pitch > 1 ? '+' : ''}${Math.round((pitch - 1) * 50)}%" volume="${Math.round(volume * 100)}%">`;
    
    // Add emphasis and pauses for better natural speech
    let enhancedText = text
      .replace(/Revolt Motors/g, '<emphasis level="strong">Revolt Motors</emphasis>')
      .replace(/RV400|RV320/g, '<emphasis level="moderate">  setResponsePersonality(personality) {
    this.responsePersonality = personality;
    
    // Adjust voice characteristics based on personality
    const personalityVoiceMap = {
      'enthusiastic': { speed: 1.1, pitch: 1.1, volume: 0.9 },
      'professional': { speed: 1.0, pitch: 1.0, volume: 0.8 },
      'casual': { speed: 0.95, pitch: 0.95, volume: 0.85 },
      'technical': { speed: 0.9, pitch: 0.9, volume: 0.8 }
    };
    
    const voiceAdjustments = personalityVoiceMap[personality];
    if (voiceAdjustments) {
      Object.assign(this.voiceSettings, voiceAdjustments);
    }
    
    this.sendToClient({
      type: 'personality_updated',
      data: {
        personality: personality,
        voiceSettings: this.voiceSettings
      }
    });
  }</emphasis>')
      .replace(/\./g, '.<break time="300ms"/>')
      .replace(/\?/g, '?<break time="500ms"/>')
      .replace(/!/g, '!<break time="400ms"/>');
    
    ssml += enhancedText;
    ssml += `</prosody>`;
    ssml += `</speak>`;
    
    return ssml;
  }

  changeVoice(voiceConfig) {
    try {
      // Validate voice configuration
      const { provider, voice, language, speed, pitch, volume, gender } = voiceConfig;
      
      // Update voice settings
      if (provider) this.voiceSettings.provider = provider;
      if (voice) this.voiceSettings.voice = voice;
      if (language) this.voiceSettings.language = language;
      if (speed !== undefined) this.voiceSettings.speed = Math.max(0.25, Math.min(4.0, speed));
      if (pitch !== undefined) this.voiceSettings.pitch = Math.max(0.5, Math.min(2.0, pitch));
      if (volume !== undefined) this.voiceSettings.volume = Math.max(0.0, Math.min(1.0, volume));
      if (gender) this.voiceSettings.gender = gender;

      // Send updated voice settings to client
      this.sendToClient({
        type: 'voice_changed',
        data: {
          voiceSettings: this.voiceSettings,
          availableVoices: this.getAvailableVoicesForProvider(this.voiceSettings.provider),
          message: `Voice changed to ${this.voiceSettings.voice || 'default'} (${this.voiceSettings.gender})`
        }
      });

      console.log(`Voice changed for user ${this.userId}:`, this.voiceSettings);
      return true;

    } catch (error) {
      console.error('Error changing voice:', error);
      this.sendToClient({
        type: 'error',
        message: 'Failed to change voice settings'
      });
      return false;
    }
  }

  getAvailableVoicesForProvider(provider) {
    return this.availableVoices[provider] || {};
  }

  async testVoice(testText = "Hello! This is Rev, your AI assistant from Revolt Motors. How do I sound?") {
    try {
      const voiceData = await this.generateVoiceResponse(testText);
      
      this.sendToClient({
        type: 'voice_test',
        data: {
          text: testText,
          voiceData: voiceData,
          settings: this.voiceSettings
        }
      });

    } catch (error) {
      console.error('Error testing voice:', error);
      this.sendToClient({
        type: 'error',
        message: 'Failed to test voice'
      });
    }
  }

  toggleAutoResponses(enabled) {
    this.autoResponseEnabled = enabled;
    this.sendToClient({
      type: 'auto_responses_toggled',
      data: enabled
    });
  }

  sendToClient(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  getSessionAnalytics() {
    return {
      userId: this.userId,
      sessionDuration: Math.round((new Date() - this.userSession.userProfile.sessionStartTime) / 1000 / 60),
      messageCount: this.userSession.userProfile.interactionCount,
      detectedIntents: [...new Set(this.userSession.conversationHistory.map(msg => msg.metadata?.intent).filter(Boolean))],
      userInterests: this.userSession.userProfile.interests,
      location: this.userSession.userProfile.location
    };
  }
}

// WebSocket connection handling with enhanced features
const activeConnections = new Map();

wss.on('connection', async (ws, req) => {
  const userId = req.url?.split('?userId=')[1] || `user_${Date.now()}`;
  console.log(`New enhanced WebSocket connection: ${userId}`);
  
  const enhancedSession = new EnhancedGeminiSession(ws, userId);
  activeConnections.set(userId, enhancedSession);
  
  // Initialize enhanced session
  await enhancedSession.initialize();
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'text_input':
          await enhancedSession.handleUserInput(data.data, 'text');
          break;
          
        case 'voice_input':
          // Handle voice input (future enhancement)
          await enhancedSession.handleUserInput(data.data, 'voice');
          break;
          
        case 'set_personality':
          enhancedSession.setResponsePersonality(data.data);
          break;
          
        case 'change_voice':
          enhancedSession.changeVoice(data.data);
          break;
          
        case 'test_voice':
          await enhancedSession.testVoice(data.data?.testText);
          break;
          
        case 'get_available_voices':
          enhancedSession.sendToClient({
            type: 'available_voices',
            data: enhancedSession.availableVoices
          });
          break;
          
        case 'toggle_auto_responses':
          enhancedSession.toggleAutoResponses(data.data);
          break;
          
        case 'get_analytics':
          enhancedSession.sendToClient({
            type: 'analytics_data',
            data: enhancedSession.getSessionAnalytics()
          });
          break;
          
        case 'clear_session':
          enhancedSession.userSession = new UserSession(userId);
          enhancedSession.sendToClient({
            type: 'session_cleared'
          });
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log(`WebSocket connection closed: ${userId}`);
    activeConnections.delete(userId);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
  });
});

// Enhanced API endpoints
app.post('/api/change-voice', async (req, res) => {
  try {
    const { userId, voiceConfig } = req.body;
    
    if (!userId || !voiceConfig) {
      return res.status(400).json({ error: 'userId and voiceConfig are required' });
    }
    
    const connection = activeConnections.get(userId);
    if (!connection) {
      return res.status(404).json({ error: 'User session not found' });
    }
    
    const success = connection.changeVoice(voiceConfig);
    
    res.json({
      success,
      voiceSettings: connection.voiceSettings,
      message: success ? 'Voice changed successfully' : 'Failed to change voice'
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/voices', (req, res) => {
  const tempSession = new EnhancedGeminiSession(null, 'temp');
  res.json({
    availableVoices: tempSession.availableVoices,
    providers: Object.keys(tempSession.availableVoices),
    defaultSettings: tempSession.voiceSettings
  });
});

app.post('/api/generate-response', async (req, res) => {
  try {
    const { message, userId, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Create temporary session for API calls
    const tempSession = new EnhancedGeminiSession(null, userId || 'api_user');
    await tempSession.initialize();
    
    if (context) {
      Object.assign(tempSession.userSession.userProfile, context);
    }
    
    const response = await tempSession.generateResponse(message);
    const intent = await tempSession.detectUserIntent(message);
    const suggestions = await tempSession.generateSuggestions(intent);
    
    res.json({
      response,
      intent,
      suggestions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analytics', (req, res) => {
  const analytics = {
    totalConnections: activeConnections.size,
    activeUsers: Array.from(activeConnections.keys()),
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  
  res.json(analytics);
});

app.get('/api/user/:userId/session', (req, res) => {
  const { userId } = req.params;
  const connection = activeConnections.get(userId);
  
  if (!connection) {
    return res.status(404).json({ error: 'User session not found' });
  }
  
  res.json(connection.getSessionAnalytics());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    connections: activeConnections.size,
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start enhanced server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Enhanced Revolt Motors AI Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🤖 Gemini AI integration active`);
  console.log(`⚡ Auto-response generation enabled`);
});