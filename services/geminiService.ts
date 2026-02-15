import { GoogleGenAI, Type } from "@google/genai";
import { Curriculum, SkillRating, GroundingSource } from "../types";

// Lazy-initialized AI client to prevent build-time errors if API_KEY is temporarily unavailable
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API Key is missing. Please configure the API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

const curriculumSchema = {
  type: Type.OBJECT,
  properties: {
    specialization: { type: Type.STRING },
    overview: { type: Type.STRING },
    totalDuration: { type: Type.STRING },
    targetRole: { type: Type.STRING },
    adaptiveFocusReasoning: { type: Type.STRING },
    industryRelevanceScore: { type: Type.NUMBER, description: "A score from 0-100 reflecting the current job market demand for this specialization." },
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          duration: { type: Type.STRING },
          level: { type: Type.STRING },
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          },
          learningOutcomes: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          industryAlignment: { type: Type.STRING },
          academicAlignment: { type: Type.STRING }
        },
        required: ["id", "title", "duration", "level", "topics", "learningOutcomes", "industryAlignment", "academicAlignment"]
      }
    },
    suggestedCertifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    prerequisites: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["specialization", "overview", "totalDuration", "targetRole", "modules", "suggestedCertifications", "prerequisites", "industryRelevanceScore"]
};

export async function generateCurriculum(
  topic: string, 
  focus: 'Industry' | 'Academic' | 'Balanced',
  experience: string,
  assessment: SkillRating[] = [],
  refinementPrompt?: string,
  existingCurriculum?: Curriculum | null
): Promise<Curriculum> {
  const ai = getAIClient();
  
  const assessmentText = assessment.length > 0 
    ? `USER SKILLS: ${assessment.map(s => `${s.skill}: ${s.level}/5`).join(', ')}`
    : "No assessment provided.";

  let prompt = `Act as a world-class education architect. Design a specialization curriculum for "${topic}".
  Focus: ${focus}. User Level: ${experience}. ${assessmentText}.
  
  Use Google Search to find 2024/2025 industry trends, latest required tech stacks, and relevant academic standard updates.
  
  Requirements:
  1. Map modules to actual 2025 job market requirements.
  2. Map modules to ACM/IEEE or ISO standards.
  3. Provide 6-8 modules.`;

  if (refinementPrompt && existingCurriculum) {
    prompt = `The user wants to refine their existing curriculum for "${existingCurriculum.specialization}".
    Current Overview: ${existingCurriculum.overview}
    Refinement Request: "${refinementPrompt}"
    Please regenerate the curriculum applying these specific changes while maintaining the overall structure.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: curriculumSchema,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("The AI architect encountered a calculation error. Please refine your query and try again.");
    }

    const curriculum = JSON.parse(responseText.trim()) as Curriculum;

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Reference Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      ...curriculum,
      groundingSources: sources.length > 0 ? sources : undefined
    };
  } catch (error) {
    console.error("Error generating curriculum:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Architecture synthesis failed. Please check your connection or try a different topic.");
  }
}