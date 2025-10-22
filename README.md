# AI Interview Coach

**AI Interview Coach** is a production-ready, full-stack web application that helps job seekers prepare for interviews with personalized, AI-generated questions and real-time conversational practice. **Users can try the full interview experience without an account**, and can optionally sign in with Google to save their session history and track their progress over time.

Powered by Google's Gemini models, a Node.js backend, and a Firestore database, it is designed for scalable deployment on Google Cloud Run and features secure user authentication via Firebase.

![AI Interview Coach Screenshot](https://storage.googleapis.com/aistudio-marketplace/project-breeze-2/docs/preview.gif)

## Features

- **Frictionless Guest Access**: Try the complete "Classic" or "Live" interview experience instantly, with no signup required.
- **Optional & Secure User Accounts**: Sign up and log in with Google to save your interview history and track performance analytics across devices.
- **Two Distinct Practice Modes**:
    - **Classic Mode**: Answer pre-generated questions one-by-one via text or voice. Receive detailed, structured feedback on each answer.
    - **Live Mode**: Engage in a real-time, low-latency voice conversation with an AI interviewer that mimics a real video interview.
- **Deep Personalization**:
    - Upload your resume (`.txt`, `.pdf`, `.docx`) to receive questions tailored specifically to your experience.
    - Choose from multiple AI interviewer personas (e.g., Friendly, Strict, HR Screener) to simulate different interview styles.
- **Comprehensive AI-Powered Feedback**:
    - **Classic Mode**: Get a score (1-10), strengths, areas for improvement, suggested answer structures, and key points missed for every question.
    - **Live Mode**: Receive a holistic review of the entire conversation, including feedback on non-verbal cues observed by the AI.
- **Performance Analytics Dashboard (for signed-in users)**:
    - Track your progress over time with a visual dashboard.
    - View your average score, score progression, and performance breakdown by question category.
- **Persistent & Secure**: A dedicated backend service securely manages API keys and stores all user-specific interview data in a central Firestore database for authenticated users.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: Google Firestore
- **Authentication**: Firebase Authentication
- **AI/ML**: Google Gemini API
    - `gemini-2.5-flash` for fast question generation and answer evaluation.
    - `gemini-2.5-pro` for in-depth, holistic analysis of live interview transcripts.
    - `gemini-2.5-flash-native-audio-preview-09-2025` for real-time, bidirectional audio and video streaming.
- **Deployment**: Google Cloud Run (as two containerized services)
- **Utilities**: `lucide-react` for icons, `recharts` for charts.

## Architecture Diagram

```mermaid
graph TD
    subgraph "User's Device"
        Browser[User's Browser]
    end

    subgraph "Google Cloud Platform"
        subgraph "Frontend Service (Cloud Run)"
            Frontend[React App]
        end

        subgraph "Backend Service (Cloud Run)"
            Backend[Node.js/Express API]
        end

        subgraph "Authentication"
            FirebaseAuth[Firebase Authentication]
        end

        subgraph "Database"
            Firestore[Firestore Database]
        end
        
        subgraph "AI Services"
            GeminiFlash[Gemini 2.5 Flash]
            GeminiPro[Gemini 2.5 Pro]
            GeminiLive[Gemini 2.5 Flash Native Audio]
        end

        subgraph "Security"
            SecretManager[Secret Manager]
        end
    end

    %% Guest User Flow
    Browser -- "HTTPs (Guest Session)" --> Frontend
    Frontend -- "Stores Session Data" --> LocalStorage[Browser LocalStorage]
    Frontend -- "Client-side API Calls (w/ Client Key)" --> GeminiFlash
    Frontend -- "Real-time Streaming (Live Mode)" --> GeminiLive

    %% Sign-in and Authenticated User Flow
    Browser -- "1. Google Sign-In" --> FirebaseAuth
    FirebaseAuth -- "2. Returns JWT" --> Browser
    Browser -- "3. Authenticated Requests (with JWT)" --> Frontend
    
    %% Session Import Flow (Guest to User)
    Frontend -- "4. POST /api/sessions/import (with Session Data)" --> Backend
    
    %% Authenticated Backend Interactions
    Backend -- "Verifies JWT with" --> FirebaseAuth
    Backend -- "CRUD Operations" --> Firestore
    Backend -- "Retrieves API Key" --> SecretManager
    SecretManager -- "Securely provides API Key" --> Backend
    Backend -- "Server-side API Calls (Classic & Review)" --> GeminiFlash
    Backend -- "Server-side API Calls (Live Review)" --> GeminiPro
    
    %% Linkages
    linkStyle 0 stroke:#4f46e5,stroke-width:2px;
    linkStyle 1 stroke:#4f46e5,stroke-width:2px;
    linkStyle 2 stroke:#4f46e5,stroke-width:2px;
    linkStyle 3 stroke:#4f46e5,stroke-width:2px;
    linkStyle 4 stroke:#34d399,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 5 stroke:#34d399,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 6 stroke:#34d399,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 7 stroke:#34d399,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 8 stroke:#3b82f6,stroke-width:2px;
    linkStyle 9 stroke:#3b82f6,stroke-width:2px;
    linkStyle 10 stroke:#3b82f6,stroke-width:2px;
    linkStyle 11 stroke:#3b82f6,stroke-width:2px;
    linkStyle 12 stroke:#3b82f6,stroke-width:2px;
    linkStyle 13 stroke:#3b82f6,stroke-width:2px;

```

## Getting Started (Local Development)

Follow these steps to run the full-stack application on your local machine.

### Prerequisites

- Node.js (v18 or later)
- pnpm
- A Google Cloud Project with Billing enabled.
- A Google Gemini API Key.
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and configured.
    - **Verify installation** by running `gcloud --version` in your terminal.
    - **Log in to the CLI** by running `gcloud auth login`.
    - **Set your project** by running `gcloud config set project YOUR_PROJECT_ID`.

### 1. Configure Your Google Cloud & Firebase Project

- In your [Firebase Console](https://console.firebase.google.com/), select your Google Cloud project.
- **Authentication:**
    - Go to **Authentication** -> **Sign-in method** and ensure the **Google** provider is enabled.
    - **Crucially, authorize your development domain.** Go to **Authentication** -> **Settings** -> **Authorized domains**. Click **Add domain** and enter `localhost`.
- **Firestore:**
    - Go to **Firestore Database** and create a database in **Native mode**. Choose a region close to you.

### 2. Clone the repository and install dependencies
```bash
git clone <your-repo-url>
cd <repo-directory>
pnpm install # Installs dependencies for both frontend and backend
```

### 3. Set up Environment Variables

- Create a file named `backend/.env`. A `.gitignore` file is included in the `backend` directory to prevent this file from being committed.
    ```
    # Your Google Gemini API Key
    API_KEY="your_gemini_api_key_here"

    # Your Google Cloud Project ID
    GCLOUD_PROJECT="your-gcp-project-id"

    # (Optional) See Authentication Step 4 for details on this variable
    # GOOGLE_APPLICATION_CREDENTIALS="./your-service-account-key.json"
    ```

- Create a file named `frontend/.env`. You can find your Firebase config in your Firebase project settings ("Project settings" > "General" > "Your apps" > "Web app").
    ```
    # The URL for the backend API endpoint
    VITE_API_URL="http://localhost:8080/api"

    # Required for client-side Gemini calls (e.g., Live API for guests and users)
    VITE_API_KEY="your_gemini_api_key_here"

    # Firebase Client-side configuration
    VITE_FIREBASE_API_KEY="your_firebase_web_api_key"
    VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
    VITE_FIREBASE_PROJECT_ID="your-project-id"
    VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
    VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
    VITE_FIREBASE_APP_ID="your_app_id"
    ```

### 4. Authenticate Your Local Backend (Crucial Step)

The backend needs credentials to securely connect to Google Cloud services like Firestore. This is the most common point of failure during setup. Please follow **one** of the two methods below carefully.

---

#### **Method 1: Using the gcloud CLI (Recommended)**

This method uses your personal Google Cloud account credentials and is the quickest way to get started.

1.  **Run the Login Command:** In your terminal, run:
    ```bash
    gcloud auth application-default login
    ```
2.  **Follow Browser Prompts:** This command will open a browser window. Sign in with the Google account that has access to your Cloud project.
3.  **Verification:** The CLI securely stores a credential file on your system. The backend will automatically find and use these credentials. There is **no need** to set `GOOGLE_APPLICATION_CREDENTIALS` in your `.env` file with this method.

**Troubleshooting Method 1:**
- **"I still see the authentication error!"**
    - Make sure you are logged into the correct Google account with access to the project.
    - Ensure you have set your active project in the gcloud CLI by running `gcloud config set project YOUR_PROJECT_ID`.
    - Try running `gcloud auth application-default revoke` and then running the `login` command again.

---

#### **Method 2: Using a Service Account Key File (Alternative)**

This method uses a dedicated, non-human account. It's more explicit and can bypass potential issues with your local `gcloud` configuration.

1.  **Create a Service Account:**
    - In the Google Cloud Console, go to **IAM & Admin** > **Service Accounts**.
    - Click **+ CREATE SERVICE ACCOUNT**.
    - Give it a name (e.g., `ai-coach-local-dev`) and click **CREATE AND CONTINUE**.
    - Grant it the following two roles:
        - `Cloud Datastore User` (allows access to Firestore)
        - `Firebase Authentication Admin` (allows verifying user tokens)
    - Click **DONE**.

2.  **Generate and Download a Key:**
    - Find your new service account in the list. Click the three-dot menu under **Actions** and select **Manage keys**.
    - Click **ADD KEY** -> **Create new key**. Choose **JSON** and click **CREATE**. A JSON key file will be downloaded.

3.  **Configure the Backend:**
    - **Move the downloaded JSON file** into the `backend` directory.
    - **Rename the file** to something simple, like `service-account-key.json`.
    - **Open `backend/.env`** and add/uncomment the `GOOGLE_APPLICATION_CREDENTIALS` variable, setting its value to the path of your key file:
      ```
      # Path to your service account key file for local development
      GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
      ```
      > The provided `.gitignore` file will prevent this key from being accidentally committed.

---

### 5. Run the Application

Once you have completed the authentication setup, you can run the application. Open two separate terminals.

-   In **Terminal 1**, run the **backend**:
    ```bash
    pnpm --filter backend start
    ```
    > **On success**, you should see "Firebase Admin SDK initialized successfully."
    > **If you see an auth error**, please revisit Step 4.

-   In **Terminal 2**, run the **frontend**:
    ```bash
    pnpm --filter frontend start
    ```

The application will be available at `http://localhost:5173`.


## Deployment to Google Cloud Run

Deploying this application involves creating two separate Cloud Run services: one for the backend and one for the frontend.

### 1. Backend Deployment

The backend service holds the API keys and connects to Firestore. It must be deployed first.

1.  **Build and submit the container image:**
    From the project root directory, run:
    ```bash
    gcloud builds submit --pack image=gcr.io/[PROJECT_ID]/ai-coach-backend --source=backend
    ```

2.  **Deploy to Cloud Run:**
    Deploy the image, passing your Gemini API key as a secret.
    - First, create the secret:
    ```bash
    echo -n "your_gemini_api_key_here" | gcloud secrets create gemini-api-key --data-file=-
    ```
    - Then, deploy the service. **Crucially, you must assign a service account that has the "Firebase Authentication Admin" and "Cloud Datastore User" roles.**
    ```bash
    gcloud run deploy ai-coach-backend \
      --image gcr.io/[PROJECT_ID]/ai-coach-backend \
      --platform managed \
      --region [YOUR_REGION] \
      --allow-unauthenticated \
      --set-secrets="API_KEY=gemini-api-key:latest" \
      --service-account [YOUR_SERVICE_ACCOUNT_EMAIL]
    ```
    Take note of the backend service URL after deployment.

### 2. Frontend Deployment

The frontend needs to know the URL of the deployed backend and have the Firebase configuration.

1.  **Build and submit the container image:**
    This step requires passing the backend API URL, the client-side Gemini key, and all Firebase config values as build arguments. This command should be run from the project root.
    ```bash
    gcloud builds submit \
      --tag gcr.io/[PROJECT_ID]/ai-coach-frontend \
      --source=frontend \
      --build-arg="VITE_API_URL=[YOUR_BACKEND_URL_FROM_PREVIOUS_STEP]/api" \
      --build-arg="VITE_API_KEY=[YOUR_GEMINI_API_KEY]" \
      --build-arg="VITE_FIREBASE_API_KEY=[YOUR_FIREBASE_WEB_API_KEY]" \
      --build-arg="VITE_FIREBASE_AUTH_DOMAIN=[...]" \
      --build-arg="VITE_FIREBASE_PROJECT_ID=[...]" \
      --build-arg="VITE_FIREBASE_STORAGE_BUCKET=[...]" \
      --build-arg="VITE_FIREBASE_MESSAGING_SENDER_ID=[...]" \
      --build-arg="VITE_FIREBASE_APP_ID=[...]"
    ```

2.  **Deploy to Cloud Run:**
    ```bash
    gcloud run deploy ai-coach-frontend \
      --image gcr.io/[PROJECT_ID]/ai-coach-frontend \
      --platform managed \
      --region [YOUR_REGION] \
      --allow-unauthenticated
    ```
This will give you the public URL to access your application.