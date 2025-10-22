import 'dotenv/config'; // Load environment variables from .env file first
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { createSession, getSessions, getSession, updateSession, importSession } from './firestoreService.js';
import { generateQuestions, evaluateAnswer, generateLiveSessionReview } from './geminiService.js';
import { authMiddleware } from './authMiddleware.js';

// --- Pre-flight Checks and Configuration ---

// A specific error message for a common local development setup issue.
const CREDENTIALS_ERROR_MESSAGE = `Backend authentication with Google Cloud failed. This is a common issue during local development. 
Please fix this by doing ONE of the following:
1. (Recommended) Run 'gcloud auth application-default login' in your terminal and restart the backend.
2. (Alternative) Create a service account, download its JSON key, and set the GOOGLE_APPLICATION_CREDENTIALS environment variable in your backend/.env file to point to the key file.
See the README.md for more details.`;

// Helper to check for the credentials error.
const hasCredentialsError = (error) => error.message?.includes('Could not load the default credentials');


if (!process.env.GCLOUD_PROJECT) {
    console.error("Google Cloud Project ID not found. Please set the GCLOUD_PROJECT environment variable in your backend/.env file.");
    process.exit(1);
}

// Initialize Firebase Admin SDK.
// By not passing a credential, the SDK uses a default credential provider chain.
// It checks for GOOGLE_APPLICATION_CREDENTIALS env var first, then falls back to
// Application Default Credentials (set by `gcloud auth`).
try {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Firebase Admin SDK initialization error:", error.message);
    if (hasCredentialsError(error)) {
        console.error(CREDENTIALS_ERROR_MESSAGE);
    }
    process.exit(1);
}


const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// --- Protected API Routes ---
const apiRouter = express.Router();
apiRouter.use(authMiddleware);

// Get all interview sessions for the authenticated user
apiRouter.get('/sessions', async (req, res) => {
  try {
    const sessions = await getSessions(req.user.uid);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    if (hasCredentialsError(error)) {
      return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
    }
    // Check for a common Firestore indexing error.
    // The gRPC error code for a FAILED_PRECONDITION is 9.
    // This provides a much more helpful error message to the developer.
    if (error.code === 9 && error.message && error.message.includes('query requires an index')) {
      const helpfulMessage = `A backend database index is missing. This is common on first-time setup. Please check your backend console logs. Firestore usually provides a direct link to create the required index. The original error was: ${error.message}`;
      return res.status(500).json({ 
        message: helpfulMessage,
      });
    }
    res.status(500).json({ message: 'Failed to fetch interview sessions.' });
  }
});

// Get a single interview session by ID for the authenticated user
apiRouter.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getSession(req.user.uid, req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ message: 'Session not found or you do not have permission to view it.' });
    }
  } catch (error) {
    console.error(`Error fetching session ${req.params.id}:`, error);
    if (hasCredentialsError(error)) {
      return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
    }
    res.status(500).json({ message: 'Failed to fetch interview session.' });
  }
});


// Create a new interview session for the authenticated user
apiRouter.post('/sessions', async (req, res) => {
  try {
    const { jobTitle, company, jobDescription, persona, resumeText, mode } = req.body;
    if (!jobTitle || !jobDescription || !mode || !persona) {
        return res.status(400).json({ message: 'Missing required fields for creating a session.' });
    }

    let sessionData = {
        jobTitle,
        company,
        jobDescription,
        persona,
        resumeText: resumeText || '',
        mode,
        createdAt: new Date().toISOString(),
        status: 'in-progress',
        currentQuestionIndex: 0,
    };

    if (mode === 'classic') {
        const questions = await generateQuestions(jobDescription, persona, resumeText);
        sessionData.questions = questions;
    } else { // mode === 'live'
        sessionData.transcript = [];
    }

    const newSession = await createSession(req.user.uid, sessionData);
    res.status(201).json(newSession);

  } catch (error) {
    console.error('Error creating session:', error);
    if (hasCredentialsError(error)) {
      return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
    }
    res.status(500).json({ message: error.message || 'Failed to create interview session.' });
  }
});

// Update a session for the authenticated user
apiRouter.put('/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Ensure user can only update their own session
        const session = await getSession(req.user.uid, id);
        if (!session) return res.status(404).json({ message: 'Session not found.' });

        const updatedSession = await updateSession(req.user.uid, id, updateData);
        res.json(updatedSession);
    } catch (error) {
        console.error(`Error updating session ${req.params.id}:`, error);
        if (hasCredentialsError(error)) {
          return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
        }
        res.status(500).json({ message: 'Failed to update session.' });
    }
});

// Submit an answer for a classic session question for the authenticated user
apiRouter.post('/sessions/:id/answer', async (req, res) => {
    try {
        const { id } = req.params;
        const { questionIndex, answer } = req.body;

        const session = await getSession(req.user.uid, id);
        if (!session) return res.status(404).json({ message: 'Session not found.' });

        const question = session.questions[questionIndex];
        if (!question) return res.status(400).json({ message: 'Question not found at that index.' });

        const feedback = await evaluateAnswer(question.question, question.category, answer);
        
        const updatedQuestions = [...session.questions];
        updatedQuestions[questionIndex] = { ...question, userAnswer: answer, feedback };

        const updatedSession = await updateSession(req.user.uid, id, { questions: updatedQuestions });
        res.json(updatedSession);
    } catch (error) {
        console.error(`Error submitting answer for session ${req.params.id}:`, error);
        if (hasCredentialsError(error)) {
          return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
        }
        res.status(500).json({ message: error.message || 'Failed to submit answer.' });
    }
});

// Finish a session for the authenticated user
apiRouter.post('/sessions/:id/finish', async (req, res) => {
    try {
        const { id } = req.params;
        const { transcript } = req.body; // For live sessions

        const session = await getSession(req.user.uid, id);
        if (!session) return res.status(404).json({ message: 'Session not found.' });

        let finalUpdate = { status: 'completed' };

        if (session.mode === 'classic') {
            const answeredQuestions = session.questions.filter(q => q.feedback);
            const totalScore = answeredQuestions.reduce((sum, q) => sum + q.feedback.overall_score, 0);
            const averageScore = answeredQuestions.length > 0 ? totalScore / answeredQuestions.length : 0;
            finalUpdate.averageScore = averageScore;
        } else if (session.mode === 'live') {
            const feedback = await generateLiveSessionReview(transcript, session.jobTitle);
            finalUpdate.liveSessionFeedback = feedback;
            finalUpdate.transcript = transcript;
        }

        const finishedSession = await updateSession(req.user.uid, id, finalUpdate);
        res.json(finishedSession);

    } catch (error) {
        console.error(`Error finishing session ${req.params.id}:`, error);
        if (hasCredentialsError(error)) {
          return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
        }
        res.status(500).json({ message: error.message || 'Failed to finalize session.' });
    }
});

// Import a completed guest session for the authenticated user
apiRouter.post('/sessions/import', async (req, res) => {
    try {
        const sessionData = req.body;
        if (!sessionData || !sessionData.id || sessionData.status !== 'completed') {
            return res.status(400).json({ message: 'Invalid session data provided for import.' });
        }
        
        const importedSession = await importSession(req.user.uid, sessionData);
        res.status(201).json(importedSession);
    } catch (error) {
        console.error('Error importing session:', error);
        if (hasCredentialsError(error)) {
          return res.status(500).json({ message: CREDENTIALS_ERROR_MESSAGE });
        }
        res.status(500).json({ message: 'Failed to import session.' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

app.use('/api', apiRouter);


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});