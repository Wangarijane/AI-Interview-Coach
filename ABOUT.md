# About AI Interview Coach

## The Problem: Interview Anxiety is Real

For many job seekers, the interview process is the most stressful part of the job hunt. It's difficult to get realistic practice, and feedback is often non-existent or vague. Candidates are left wondering: "Did I answer that question well?", "Was I rambling?", or "How can I improve for next time?". This lack of preparation and feedback loop leads to missed opportunities and a significant blow to a candidate's confidence.

## Our Solution: Your Personal AI Interview Coach

**AI Interview Coach** is a web application designed to eliminate interview anxiety by providing a safe, realistic, and insightful practice environment. By harnessing the power of Google's Gemini models, our application acts as a personal coach, available 24/7 to help users master their interviewing skills and land their dream job.

We believe in letting you experience the value firsthand. **You can start a full interview session immediately—no account required.** When you're ready to save your sessions and track your improvement over time, you can easily create an account with a single click.

Our platform offers a deeply personalized experience. Users begin by providing a job title and description for the role they're targeting. For an even more tailored session, they can upload their resume, prompting the AI to ask specific, context-aware questions about their projects and work history—just like a real interviewer would.

## Key Functionality

The core of the experience is divided into two powerful practice modes, both available to guests and signed-in users:

1.  **Classic Practice Mode**: This turn-by-turn mode is perfect for methodically honing your answers. The AI generates a set of 10 relevant questions based on the job details. After a user submits an answer (via text or voice-to-text), they receive immediate, actionable feedback. This includes an overall score from 1-10, a breakdown of strengths, areas for improvement, a suggested answer structure (like the STAR method), and a list of key points they might have missed.

2.  **Live Conversation Mode**: For a more realistic challenge, this mode simulates a real-time video interview. Using the Gemini Live API, the user engages in a natural, low-latency spoken conversation with an AI interviewer. The AI not only asks questions and follow-ups but also observes the user's non-verbal cues from the video stream. At the end of the session, the user receives a holistic performance review.

For users who choose to sign in, a comprehensive **Dashboard** ties everything together, allowing them to track their progress, view their average scores, and identify which types of questions (Technical, Behavioral, etc.) need more practice.

## Technology Used

AI Interview Coach is built on a modern, robust tech stack:

-   **Frontend**: A responsive and interactive UI built with **React** and **TypeScript**, styled with **Tailwind CSS**.
-   **AI Engine**: We leverage multiple **Google Gemini** models, each selected for its specific strengths:
    -   `gemini-2.5-flash` for its speed in generating questions and evaluating individual answers.
    -   `gemini-2.5-pro` for its advanced reasoning capabilities, used to provide the holistic end-of-session review.
    -   `gemini-2.5-flash-native-audio-preview-09-2025` for the high-performance, real-time bidirectional audio and video streaming required for the Live Mode.
-   **Deployment**: The entire application is containerized and built to be deployed seamlessly as a **Google Cloud Run** service, ensuring scalability and reliability.
