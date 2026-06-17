import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

// Initialize the Google GenAI SDK. It automatically loads GEMINI_API_KEY from environment variables.
const ai = new GoogleGenAI({});

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Missing required field: message' });
      return;
    }

    // Prepare contents array for the multi-turn conversation
    let contents: any[] = [];
    if (history && Array.isArray(history)) {
      contents = [...history];
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: contents,
      config: {
        systemInstruction: 'Eres el asistente de IA de AutoParts WebHub. Ayuda al usuario a buscar repuestos, verificar stock y agendar citas de retiro. Sé conciso, profesional y responde siempre en español.',
      }
    });

    res.status(200).json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in handleChat:', error);
    res.status(500).json({
      error: 'Failed to communicate with Gemini AI',
      message: error.message || error
    });
  }
};
