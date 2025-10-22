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
    // Clone the response before reading it to avoid "body already read" errors
    const responseClone = response.clone();
    let errorMessage = `Server Error (Status: ${response.status})`;
    
    if (response.status === 404) {
      errorMessage = `API endpoint not found (404): The requested URL '${response.url}' was not found on the server. Please check that your backend is running and the VITE_API_URL in your frontend .env file is correct.`;
    } else if (response.status === 401 || response.status === 403) {
      errorMessage = "Authentication failed. Your session may have expired. Please sign in again.";
    }
    
    try {
        // Try to parse error as JSON first using the cloned response
        const errorData = await responseClone.json();
        errorMessage = errorData.message || errorMessage;
    } catch (jsonError) {
        // If JSON parsing fails, try to read as text
        try {
            const textError = await responseClone.text();
            if (textError) {
                errorMessage = `${errorMessage}. Response: ${textError.substring(0, 150)}`;
            }
        } catch (textError) {
            // If both methods fail, use the generic error message
            console.error('Could not read error response body:', textError);
        }
    }
    
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return null;
};

// A single, robust fetch wrapper to handle API calls.
const fetchWithHandling = async (url: string, options: RequestInit) => {
    try {
        const response = await fetch(url, options);
        // handleResponse will throw an error for non-2xx responses.
        return await handleResponse(response);
    } catch (error) {
        // This 'catch' block now handles two main types of errors:
        // 1. Errors thrown by handleResponse (for HTTP status codes like 4xx, 5xx).
        // 2. Network-level errors from 'fetch' itself (e.g., DNS error, CORS, connection refused).

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             // This generic message often indicates a network or CORS issue.
             console.error("Network or CORS error:", error);
             throw new Error(`Network Error: Could not connect to the backend at ${API_URL}. Please check:\n1. The backend server is running.\n2. The VITE_API_URL in your frontend .env file is correct.\n3. There are no CORS errors in the browser's developer console.\n4. Your device has an active internet connection.`);
        }
        
        // Re-throw the structured error from handleResponse or other specific errors.
        if (error instanceof Error) {
            throw error;
        }

        // Fallback for any other unknown error types.
        throw new Error("An unexpected error occurred during the API request.");
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