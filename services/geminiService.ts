
import { GoogleGenAI, Type } from "@google/genai";
import { Curriculum, SkillRating } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const curriculumSchema = {
  type: Type.OBJECT,
  properties: {
    specialization: { type: Type.STRING },
    overview: { type: Type.STRING },
    totalDuration: { type: Type.STRING },
    targetRole: { type: Type.STRING },
    adaptiveFocusReasoning: { type: Type.STRING, description: "Explanation of how the curriculum was customized based on the user's skill assessment." },
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
  required: ["specialization", "overview", "totalDuration", "targetRole", "modules", "suggestedCertifications", "prerequisites"]
};

export async function generateCurriculum(
  topic: string, 
  focus: 'Industry' | 'Academic' | 'Balanced',
  experience: string,
  assessment: SkillRating[] = []
): Promise<Curriculum> {
  const assessmentText = assessment.length > 0 
    ? `USER SELF-ASSESSMENT:
       The user has rated their skills as follows (1=Novice, 5=Expert):
       ${assessment.map(s => `- ${s.skill}: ${s.level}/5`).join('\n')}
       
       ADAPTATION RULE: 
       - If a skill is rated 4 or 5, reduce basic coverage and move to advanced applications or specific edge cases.
       - If a skill is rated 1 or 2, provide comprehensive foundation modules.
       - Ensure the curriculum addresses the gaps specifically.`
    : "No specific skill assessment provided. Design for general proficiency based on the experience level.";

  const prompt = `Design a highly detailed adaptive specialization curriculum for "${topic}". 
  The target user has a general background of "${experience}".
  Focus preference: ${focus}.
  
  ${assessmentText}
  
  CRITICAL REQUIREMENTS:
  1. INDUSTRY STANDARDS: Align with modern market requirements (FAANG, leading startups) and current tech stacks.
  2. ACADEMIC STANDARDS: Align with frameworks like ACM/IEEE CS2023 or high-ranking university syllabi.
  3. STRUCTURE: Provide 6-8 modules.
  4. ALIGNMENT: Each module must map to a specific certification or academic standard.
  5. REASONING: In 'adaptiveFocusReasoning', explain how you tailored this to the assessment provided.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: curriculumSchema,
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    const text = response.text.trim();
    return JSON.parse(text) as Curriculum;
  } catch (error) {
    console.error("Error generating curriculum:", error);
    throw new Error("Failed to architect your curriculum. Please try again.");
  }
}
