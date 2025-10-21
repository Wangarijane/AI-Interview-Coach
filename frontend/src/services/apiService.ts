import { InterviewSession, TranscriptEntry } from '../types';
import { auth } from './firebase';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080/api';

const getAuthHeader = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You are not signed in. Please sign in to continue.");
    }
    const token = await user.getIdToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`API endpoint not found (Error 404). Please ensure the backend server is running and the API URL in your .env file is correctly configured to point to the backend's API endpoint (e.g., http://localhost:8080/api).`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Your session may have expired. Please sign in again.");
    }
    if (response.status >= 500) {
        throw new Error("A server error occurred. We're working on fixing it! Please try again later.");
    }
    
    const errorData = await response.json().catch(() => ({ 
      message: `An unexpected error occurred. (Status: ${response.status})` 
    }));
    throw new Error(errorData.message || `An unknown error occurred.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return null;
};

// A single, robust fetch wrapper to handle API calls, including network errors.
const fetchWithHandling = async (url: string, options: RequestInit) => {
    try {
        const response = await fetch(url, options);
        return await handleResponse(response);
    } catch (error) {
        // This block catches network errors (e.g., connection refused), not HTTP errors from handleResponse.
        if (error instanceof Error && error.message.startsWith('API endpoint not found')) {
            throw error; // Re-throw our specific 404 error
        }
        console.error("Network or Fetch API error:", error);
        throw new Error("Network Error: Could not connect to the backend. Please ensure the backend server is running and there are no network issues (like a VPN or proxy) blocking the connection.");
    }
};

export const getSessions = async (): Promise<InterviewSession[]> => {
  const headers = await getAuthHeader();
  return fetchWithHandling(`${API_URL}/sessions`, { headers });
};

export const getSession = async (id: string): Promise<InterviewSession> => {
  const headers = await getAuthHeader();
  return fetchWithHandling(`${API_URL}/sessions/${id}`, { headers });
};

interface CreateSessionPayload {
    jobTitle: string;
    company: string;
    jobDescription: string;
    persona: string;
    resumeText?: string;
    mode: 'classic' | 'live';
}

export const createSession = async (payload: CreateSessionPayload): Promise<InterviewSession> => {
  const headers = await getAuthHeader();
  return fetchWithHandling(`${API_URL}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
};

export const updateSession = async (id: string, payload: Partial<InterviewSession>): Promise<InterviewSession> => {
    const headers = await getAuthHeader();
    return fetchWithHandling(`${API_URL}/sessions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });
};

export const submitAnswer = async (sessionId: string, questionIndex: number, answer: string): Promise<InterviewSession> => {
    const headers = await getAuthHeader();
    return fetchWithHandling(`${API_URL}/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionIndex, answer }),
    });
};

export const finishSession = async (sessionId: string, transcript?: TranscriptEntry[]): Promise<InterviewSession> => {
    const headers = await getAuthHeader();
    return fetchWithHandling(`${API_URL}/sessions/${sessionId}/finish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transcript }),
    });
};

export const importSession = async (sessionData: InterviewSession): Promise<InterviewSession> => {
    const headers = await getAuthHeader();
    return fetchWithHandling(`${API_URL}/sessions/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sessionData),
    });
};