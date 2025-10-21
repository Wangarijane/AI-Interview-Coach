import { InterviewSession } from '../types';

const GUEST_SESSION_KEY = 'guestInterviewSession';

/**
 * Saves the guest's interview session to local storage.
 * @param session The interview session object to save.
 * @returns The saved interview session object.
 */
export const saveGuestSession = (session: InterviewSession): InterviewSession => {
    try {
        localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
        console.error("Could not save session to local storage:", error);
        // We still return the session so the app can continue, but log the error.
    }
    return session;
};

/**
 * Retrieves the guest's interview session from local storage.
 * @returns The interview session object, or null if not found or on error.
 */
export const getGuestSession = (): InterviewSession | null => {
    try {
        const sessionJSON = localStorage.getItem(GUEST_SESSION_KEY);
        if (sessionJSON) {
            return JSON.parse(sessionJSON) as InterviewSession;
        }
        return null;
    } catch (error) {
        console.error("Could not retrieve session from local storage:", error);
        return null;
    }
};

/**
 * Clears the guest's interview session from local storage.
 */
export const clearGuestSession = (): void => {
    try {
        localStorage.removeItem(GUEST_SESSION_KEY);
    } catch (error) {
        console.error("Could not clear session from local storage:", error);
    }
};
