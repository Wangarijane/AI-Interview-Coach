import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { createSession } from '../services/apiService';
import { saveGuestSession } from '../services/localStorageService';
import { generateQuestions } from '../services/geminiService';
import { InterviewSession } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Card from '../components/common/Card';
import { useAuth } from '../hooks/useAuth';
import { Upload, Lightbulb, Mic, Type, Smile, UserCheck, BrainCircuit, Zap } from 'lucide-react';

const personas = [
    { name: 'Friendly & Encouraging', icon: Smile, description: 'A supportive interviewer for building confidence.' },
    { name: 'Strict & Technical', icon: BrainCircuit, description: 'A no-nonsense interviewer who grills on details.' },
    { name: 'HR Screener', icon: UserCheck, description: 'Focuses on behavioral and cultural fit questions.' },
];

const NewInterview: React.FC = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [mode, setMode] = useState<'classic' | 'live'>('classic');
  const [persona, setPersona] = useState(personas[0].name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleResumeFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setResumeText(e.target?.result as string);
        setError(null);
      };
      reader.readAsText(file);
    } else {
      setError('Please upload a valid .txt file for your resume.');
    }
    event.target.value = ''; // Reset file input
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle || !jobDescription) {
      setError('Job Title and Job Description are required.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
        const sessionDetails = {
            jobTitle,
            company,
            jobDescription,
            persona,
            resumeText,
            mode,
        };
        
        if (user) {
            // Logged-in user flow
            const newSession = await createSession(sessionDetails);
            if (newSession.mode === 'classic') {
                navigate(`/session/${newSession.id}`);
            } else {
                navigate(`/live/${newSession.id}`);
            }
        } else {
            // Guest user flow
            const guestSession: InterviewSession = {
                ...sessionDetails,
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                status: 'in-progress',
                currentQuestionIndex: 0,
                questions: [],
                resumeText: resumeText || '',
            };

            if (mode === 'classic') {
                const questions = await generateQuestions(jobDescription, persona, resumeText);
                guestSession.questions = questions;
            } else { // mode === 'live'
                guestSession.transcript = [];
            }

            saveGuestSession(guestSession);
            navigate(guestSession.mode === 'classic' ? `/session/${guestSession.id}` : `/live/${guestSession.id}`);
        }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while creating the session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Start a New Interview</h1>
      <Card>
        {isLoading ? (
          <LoadingSpinner text={mode === 'classic' ? "Generating AI questions..." : "Setting up live session..."} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && <ErrorMessage message={error} />}

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">1. Interview Mode</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModeCard
                        icon={Type}
                        title="Classic Practice"
                        description="Answer pre-generated questions via text or voice input, one by one."
                        isActive={mode === 'classic'}
                        onClick={() => setMode('classic')}
                    />
                    <ModeCard
                        icon={Mic}
                        title="Live Conversation"
                        description="Engage in a real-time, spoken conversation with an AI interviewer."
                        isActive={mode === 'live'}
                        onClick={() => setMode('live')}
                    />
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">2. Job Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700">Job Title</label>
                        <input type="text" id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required className="mt-1 block w-full input-style" placeholder="e.g., Senior React Developer"/>
                    </div>
                    <div>
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company (Optional)</label>
                        <input type="text" id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full input-style" placeholder="e.g., Acme Corp"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                    <textarea id="jobDescription" rows={8} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} required className="block w-full input-style" placeholder="Paste the job description here..."/>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">3. Personalization (Optional)</h2>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Resume (.txt file)</label>
                    <div className="flex items-center gap-4">
                        <label htmlFor="resume-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                            <Upload className="h-5 w-5 mr-2" /> Upload Resume
                        </label>
                        <input id="resume-upload" name="resume-upload" type="file" className="sr-only" onChange={handleResumeFileChange} accept=".txt" />
                        {resumeText && <span className="text-sm text-green-600 font-medium">Resume uploaded successfully!</span>}
                    </div>
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start">
                        <Lightbulb className="h-5 w-5 text-blue-500 mr-3 mt-1 flex-shrink-0" />
                        <p className="text-sm text-blue-700">
                            <strong>Tip:</strong> Uploading your resume allows the AI to ask you specific questions about your experience, making the interview much more realistic.
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">4. Interviewer Persona</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {personas.map(p => (
                        <PersonaCard key={p.name} {...p} isActive={persona === p.name} onClick={() => setPersona(p.name)} />
                    ))}
                </div>
            </section>

            <div className="text-right pt-4">
              <button type="submit" className="inline-flex items-center justify-center py-3 px-8 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50" disabled={isLoading}>
                <Zap className="w-5 h-5 mr-2" />
                {isLoading ? 'Setting up...' : `Start ${mode === 'live' ? 'Live' : 'Classic'} Session`}
              </button>
            </div>
          </form>
        )}
      </Card>
      <style>{`.input-style { border-radius: 0.375rem; border: 1px solid #D1D5DB; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding: 0.5rem 0.75rem; } .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4F46E5; box-shadow: 0 0 0 2px #A5B4FC; }`}</style>
    </div>
  );
};

interface ModeCardProps { icon: React.ElementType; title: string; description: string; isActive: boolean; onClick: () => void; }
const ModeCard: React.FC<ModeCardProps> = ({ icon: Icon, title, description, isActive, onClick }) => (
    <div onClick={onClick} className={`p-4 border rounded-lg cursor-pointer transition-all ${isActive ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500' : 'border-gray-300 bg-white hover:border-primary-300 hover:shadow-sm'}`}>
        <div className="flex items-center mb-2">
            <Icon className={`w-6 h-6 mr-3 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
            <h3 className="text-md font-bold text-gray-800">{title}</h3>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
    </div>
);

interface PersonaCardProps { icon: React.ElementType; name: string; description: string; isActive: boolean; onClick: () => void; }
const PersonaCard: React.FC<PersonaCardProps> = ({ icon: Icon, name, description, isActive, onClick }) => (
    <div onClick={onClick} className={`p-4 border rounded-lg cursor-pointer text-center transition-all ${isActive ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500' : 'border-gray-300 bg-white hover:border-primary-300 hover:shadow-sm'}`}>
        <Icon className={`w-8 h-8 mx-auto mb-2 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
        <h3 className="text-sm font-bold text-gray-800">{name}</h3>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
    </div>
);

export default NewInterview;