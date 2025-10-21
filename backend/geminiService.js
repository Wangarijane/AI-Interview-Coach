import dotenv from "dotenv";
dotenv.config();
console.log("Loaded API_KEY:", process.env.API_KEY ? " Found" : " Missing");
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("Gemini API key not found. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const questionGenerationPrompt = (jobDescription, persona, resumeText) => `
You are an expert technical recruiter and interview coach acting with the persona of "${persona}".
Based on the following job description, and the candidate's resume if provided, generate exactly 10 interview questions.

Job Description:
${jobDescription}

${resumeText ? `Candidate's Resume:\n${resumeText}` : ''}

Requirements:
- If a resume is provided, generate at least 3 questions that directly reference specific projects or experiences from the resume.
- 4 technical/domain-specific questions matching the required skills
- 3 behavioral questions using STAR method format
- 2 situational questions
- 1 company/role-specific question

For each question, provide:
1. The question text
2. Category (Technical/Behavioral/Situational/Company)
3. Difficulty (Easy/Medium/Hard)
4. Expected answer duration in minutes

Format your response as a JSON array of question objects.
`;

const answerEvaluationPrompt = (question, questionType, userAnswer) => `
You are an expert interview coach providing constructive feedback.

Question: ${question}
Question Type: ${questionType}
Candidate's Answer: ${userAnswer}

Evaluate this answer on a scale of 1-10 and provide:
1. Overall Score (as 'overall_score') from 1-10
2. Three specific strengths (as 'strengths')
3. Three areas for improvement (as 'areas_for_improvement')
4. A suggested structure for a better answer (as 'suggested_answer_structure')
5. Key points the candidate missed (as 'key_points_missed')

Be constructive, encouraging, and specific. Format your response as a clean JSON object.
`;

const liveSessionReviewPrompt = (transcript, jobTitle) => `
You are an expert interview coach and communication specialist reviewing a recorded interview session for the role of ${jobTitle}.
You were provided a video stream of the candidate during the interview. Based on the full conversation transcript below and your visual observation of the candidate's non-verbal cues, provide a holistic evaluation.

Transcript:
${transcript.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n')}

Provide the following in your evaluation:
1. An overall summary of the candidate's performance.
2. Three specific strengths in their communication and answers.
3. Three areas for improvement in their communication and answers.
4. Specific feedback on non-verbal communication based on your visual observation. Comment on perceived confidence, clarity, pacing, eye contact, body language, and use of filler words.

Format your response as a clean JSON object.
`;


const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        category: { type: Type.STRING, enum: ['Technical', 'Behavioral', 'Situational', 'Company'] },
        difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
        expected_answer_duration_minutes: { type: Type.NUMBER },
    },
    required: ['question', 'category', 'difficulty', 'expected_answer_duration_minutes'],
};

const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        overall_score: { type: Type.NUMBER },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        areas_for_improvement: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggested_answer_structure: { type: Type.STRING },
        key_points_missed: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['overall_score', 'strengths', 'areas_for_improvement', 'suggested_answer_structure', 'key_points_missed'],
};

const liveFeedbackSchema = {
    type: Type.OBJECT,
    properties: {
        overall_summary: { type: Type.STRING },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        areas_for_improvement: { type: Type.ARRAY, items: { type: Type.STRING } },
        non_verbal_feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['overall_summary', 'strengths', 'areas_for_improvement', 'non_verbal_feedback'],
};

export const generateQuestions = async (jobDescription, persona, resumeText) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: questionGenerationPrompt(jobDescription, persona, resumeText),
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: questionSchema },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating questions:", error);
        throw new Error("Failed to generate interview questions from Gemini.");
    }
};

export const evaluateAnswer = async (question, questionType, userAnswer) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: answerEvaluationPrompt(question, questionType, userAnswer),
            config: {
                responseMimeType: "application/json",
                responseSchema: feedbackSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error evaluating answer:", error);
        throw new Error("Failed to evaluate the answer from Gemini.");
    }
};

export const generateLiveSessionReview = async (transcript, jobTitle) => {
    if (!transcript || transcript.length === 0) {
        return {
            overall_summary: "The interview session was empty and could not be evaluated.",
            strengths: [],
            areas_for_improvement: [],
            non_verbal_feedback: [],
        };
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: liveSessionReviewPrompt(transcript, jobTitle),
            config: {
                responseMimeType: "application/json",
                responseSchema: liveFeedbackSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating live session review:", error);
        throw new Error("Failed to generate the interview review from Gemini.");
    }
};
