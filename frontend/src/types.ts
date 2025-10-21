export interface Question {
  question: string;
  category: 'Technical' | 'Behavioral' | 'Situational' | 'Company';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  expected_answer_duration_minutes: number;
  userAnswer?: string;
  feedback?: Feedback;
}

export interface Feedback {
  overall_score: number;
  strengths: string[];
  areas_for_improvement: string[];
  suggested_answer_structure: string;
  key_points_missed: string[];
}

export interface LiveSessionFeedback {
  overall_summary: string;
  strengths: string[];
  areas_for_improvement: string[];
  non_verbal_feedback: string[];
}

export interface TranscriptEntry {
  speaker: 'user' | 'ai';
  text: string;
}

export interface InterviewSession {
  id: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  createdAt: string;
  status: 'in-progress' | 'completed';

  // New fields for different modes
  mode: 'classic' | 'live';
  persona: string;
  resumeText?: string;

  // Classic mode data
  questions: Question[];
  currentQuestionIndex: number;
  averageScore?: number;

  // Live mode data
  transcript?: TranscriptEntry[];
  liveSessionFeedback?: LiveSessionFeedback;
}

// Add types for the Web Speech API.
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}