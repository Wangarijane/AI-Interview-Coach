import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { InterviewSession } from '../types';
import { getSession } from '../services/apiService';
import { getGuestSession } from '../services/localStorageService';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Card from '../components/common/Card';
import { ThumbsUp, ThumbsDown, Target, HelpCircle, Star, Award, Eye, MessageSquare, User, Bot, LogIn } from 'lucide-react';

const Review: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessionData = async () => {
        if (!id) return;
        try {
            setIsLoading(true);
            let data: InterviewSession | null = null;
            if (user) {
              data = await getSession(id);
            } else {
              const guestSession = getGuestSession();
              if (guestSession && guestSession.id === id) {
                data = guestSession;
              } else {
                navigate('/');
                return;
              }
            }

            if (data.status !== 'completed') {
                navigate('/');
                return;
            }
            setSession(data);
        } catch (err: any) {
            setError(err.message || "Failed to load review.");
        } finally {
            setIsLoading(false);
        }
    };
    fetchSessionData();
  }, [id, user, navigate]);

  const handleSaveProgress = () => {
    if (session) {
      localStorage.setItem('sessionToSaveAfterLogin', JSON.stringify(session));
      signInWithGoogle();
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading your review..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!session) {
    return <p>Could not find review data for this session.</p>;
  }


  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const reviewContent = session.mode === 'live' ? <LiveReview session={session} /> : <ClassicReview session={session} getScoreColor={getScoreColor}/>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       {!user && session.status === 'completed' && (
        <Card className="text-center bg-primary-50 border-primary-200 border animate-fade-in-up">
          <h2 className="text-xl font-bold text-primary-800">Save Your Progress!</h2>
          <p className="text-primary-700 my-2">Sign in with Google to save this interview and track your performance over time.</p>
          <button
            onClick={handleSaveProgress}
            className="mt-2 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In & Save
          </button>
        </Card>
      )}
      {reviewContent}
    </div>
  )
};

const ClassicReview: React.FC<{session: InterviewSession, getScoreColor: (score: number) => string}> = ({session, getScoreColor}) => {
  return (
    <>
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">{session.jobTitle} Interview Review</h1>
            <p className="text-md text-gray-500">Completed on {new Date(session.createdAt).toLocaleDateString()}</p>
        </div>
         <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
            Back to Dashboard
        </Link>
      </div>

      <Card className="flex items-center justify-center space-x-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-xl">
        <Award className="w-12 h-12 text-white/90"/>
        <div>
          <h2 className="text-xl font-semibold text-white">Overall Performance</h2>
          <p className="text-3xl font-bold">{session.averageScore?.toFixed(1)} / 10</p>
        </div>
      </Card>

      <div className="space-y-4">
        {session.questions.map((q, index) => (
          <Card key={index}>
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-800 pr-4">{index + 1}. {q.question}</h3>
                {q.feedback && (
                    <div className={`flex items-center font-bold px-3 py-1 rounded-full text-lg ${getScoreColor(q.feedback.overall_score)}`}>
                        <Star className="w-5 h-5 mr-1" />
                        <span>{q.feedback.overall_score}/10</span>
                    </div>
                )}
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-md border">
              <p className="font-semibold text-gray-600 mb-2">Your Answer:</p>
              <p className="text-gray-700 whitespace-pre-wrap">{q.userAnswer || 'Not answered'}</p>
            </div>
            
            {q.feedback && (
              <div className="mt-4 space-y-4">
                <FeedbackSection title="Strengths" icon={ThumbsUp} items={q.feedback.strengths} color="green" />
                <FeedbackSection title="Areas for Improvement" icon={ThumbsDown} items={q.feedback.areas_for_improvement} color="red" />
                
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400">
                    <h4 className="flex items-center text-md font-semibold text-blue-800 mb-2"><Target className="w-5 h-5 mr-2" />Suggested Answer Structure</h4>
                    <p className="text-blue-700 text-sm whitespace-pre-wrap">{q.feedback.suggested_answer_structure}</p>
                </div>
                
                 <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
                    <h4 className="flex items-center text-md font-semibold text-yellow-800 mb-2"><HelpCircle className="w-5 h-5 mr-2" />Key Points Missed</h4>
                    <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
                        {q.feedback.key_points_missed.length > 0 ? q.feedback.key_points_missed.map((point, i) => <li key={i}>{point}</li>) : <li>None!</li>}
                    </ul>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
};

const LiveReview: React.FC<{session: InterviewSession}> = ({ session }) => {
    const { liveSessionFeedback: feedback, transcript } = session;

    if (!feedback) {
        return <LoadingSpinner text="Feedback not available." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{session.jobTitle} Live Interview Review</h1>
                    <p className="text-md text-gray-500">Completed on {new Date(session.createdAt).toLocaleDateString()}</p>
                </div>
                <Link to="/" className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    Back to Dashboard
                </Link>
            </div>

            <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-2">Overall Summary</h2>
                <p className="text-white/90">{feedback.overall_summary}</p>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <FeedbackSection title="Strengths" icon={ThumbsUp} items={feedback.strengths} color="green" />
                 <FeedbackSection title="Areas for Improvement" icon={ThumbsDown} items={feedback.areas_for_improvement} color="red" />
            </div>

            <Card>
                <h2 className="flex items-center text-xl font-semibold text-gray-800 mb-3">
                    <Eye className="w-6 h-6 mr-3 text-primary-600" /> Non-Verbal Communication Feedback
                </h2>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                    {feedback.non_verbal_feedback.map((point, i) => <li key={i}>{point}</li>)}
                </ul>
            </Card>

            <Card>
                <h2 className="flex items-center text-xl font-semibold text-gray-800 mb-4">
                    <MessageSquare className="w-6 h-6 mr-3 text-primary-600" /> Interview Transcript
                </h2>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
                    {transcript?.map((entry, index) => (
                        <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'flex-row-reverse' : ''}`}>
                             <div className={`p-2 rounded-full self-start ${entry.speaker === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-primary-100 text-primary-600'}`}>
                                {entry.speaker === 'user' ? <User className="w-5 h-5"/> : <Bot className="w-5 h-5" />}
                            </div>
                            <div className={`p-3 rounded-lg max-w-sm ${entry.speaker === 'user' ? 'bg-blue-50 text-right' : 'bg-gray-100'}`}>
                                <p className="text-sm text-gray-800">{entry.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};


interface FeedbackSectionProps {
    title: string;
    icon: React.ElementType;
    items: string[];
    color: 'green' | 'red';
}

const FeedbackSection: React.FC<FeedbackSectionProps> = ({ title, icon: Icon, items, color }) => {
    const colors = {
        green: { text: 'text-green-800', bg: 'bg-green-50', border: 'border-green-500', icon: 'text-green-600' },
        red: { text: 'text-red-800', bg: 'bg-red-50', border: 'border-red-500', icon: 'text-red-600' }
    };
    const selectedColor = colors[color];

    return (
        <Card className={`${selectedColor.bg} border-l-4 ${selectedColor.border} shadow-sm`}>
            <h4 className={`flex items-center text-md font-semibold ${selectedColor.text} mb-2`}>
                <Icon className={`w-5 h-5 mr-2 ${selectedColor.icon}`} />{title}
            </h4>
            <ul className={`list-disc list-inside ${selectedColor.text} text-sm space-y-1`}>
                {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
        </Card>
    );
}

export default Review;