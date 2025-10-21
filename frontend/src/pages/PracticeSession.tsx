import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InterviewSession, Question } from '../types';
import { getSession, updateSession, submitAnswer, finishSession as finishApiSession } from '../services/apiService';
import { getGuestSession, saveGuestSession } from '../services/localStorageService';
import { evaluateAnswer } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import Card from '../components/common/Card';
import { Tag, Clock, ChevronLeft, ChevronRight, Check, Mic, MicOff, Timer, AlertCircle } from 'lucide-react';

const PracticeSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For API calls like submitting answer
  const [isPageLoading, setIsPageLoading] = useState(true); // For initial session load
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimeUp, setIsTimeUp] = useState(false);
  
  const speechRecognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const fetchSessionData = async () => {
        if (!id) return;
        try {
            setIsPageLoading(true);
            let data: InterviewSession | null = null;
            if (user) {
              data = await getSession(id);
            } else {
              const guestSession = getGuestSession();
              if (guestSession && guestSession.id === id) {
                data = guestSession;
              } else {
                navigate('/'); // Guest session not found or mismatch, redirect home
                return;
              }
            }
            
            if(data.mode !== 'classic' || data.status === 'completed') {
                navigate('/');
                return;
            }
            setSession(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load session.');
        } finally {
            setIsPageLoading(false);
        }
    };
    fetchSessionData();
  }, [id, user, navigate]);

  useEffect(() => {
    if (session) {
      const question = session.questions[session.currentQuestionIndex];
      setCurrentQuestion(question);
      setAnswer(question.userAnswer || '');
       if (timeLeft === 0 && question.expected_answer_duration_minutes > 0) {
           setTimeLeft(question.expected_answer_duration_minutes * 60);
       }
      setIsTimeUp(false);
    }
  }, [session]);
  
  // Timer countdown effect
  useEffect(() => {
    if (isLoading || isPageLoading || isTimeUp || timeLeft <= 0) {
      if (timeLeft <= 0 && currentQuestion && currentQuestion.expected_answer_duration_minutes > 0) {
        setIsTimeUp(true);
      }
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, isLoading, isTimeUp, currentQuestion, isPageLoading]);


  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                }
            }
            if (final_transcript) {
                setAnswer(prev => (prev ? prev + ' ' : '') + final_transcript.trim());
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setError(`Speech recognition error: ${event.error}. Please ensure microphone access is allowed.`);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        speechRecognition.current = recognition;
    }

    return () => {
        if (speechRecognition.current) {
            speechRecognition.current.abort();
        }
    };
  }, []);

  const handleToggleRecording = () => {
    if (!speechRecognition.current) return;
    if (isRecording) {
        speechRecognition.current.stop();
    } else {
        speechRecognition.current.start();
    }
    setIsRecording(!isRecording);
  };

  const navigateQuestion = async (newIndex: number) => {
      if (!session || !id) return;
      try {
          const updatedSessionData = { ...session, currentQuestionIndex: newIndex };
          let updatedSession: InterviewSession;
          if (user) {
            updatedSession = await updateSession(id, { currentQuestionIndex: newIndex });
          } else {
            updatedSession = saveGuestSession(updatedSessionData);
          }
          setSession(updatedSession);
          setTimeLeft(0); // Reset timer for next question
      } catch (err: any) {
          setError(err.message || "Failed to navigate.");
      }
  };

  const handleNext = () => {
    if (!session) return;
    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex < session.questions.length) {
      navigateQuestion(nextIndex);
    }
  };

  const handlePrev = () => {
    if (!session) return;
    const prevIndex = session.currentQuestionIndex - 1;
    if (prevIndex >= 0) {
      navigateQuestion(prevIndex);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!session || !currentQuestion || !answer.trim() || !id) {
      setError("Answer cannot be empty.");
      return;
    }

    setError(null);
    setIsLoading(true);
    if(isTimeUp) setIsTimeUp(false);

    try {
      let updatedSession: InterviewSession;
      if (user) {
        updatedSession = await submitAnswer(id, session.currentQuestionIndex, answer);
      } else {
        const feedback = await evaluateAnswer(currentQuestion.question, currentQuestion.category, answer);
        const updatedQuestions = [...session.questions];
        updatedQuestions[session.currentQuestionIndex] = { ...currentQuestion, userAnswer: answer, feedback };
        updatedSession = saveGuestSession({ ...session, questions: updatedQuestions });
      }
      setSession(updatedSession);
      
      if (session.currentQuestionIndex < session.questions.length - 1) {
          navigateQuestion(session.currentQuestionIndex + 1);
      } else {
          await handleFinish();
      }

    } catch (err: any) {
      setError(err.message || "Failed to get feedback.");
    } finally {
      setIsLoading(false);
    }
  };

    const handleFinish = async () => {
        if (!id || !session) return;
        try {
            if (user) {
              await finishApiSession(id);
            } else {
              const answeredQuestions = session.questions.filter(q => q.feedback);
              const totalScore = answeredQuestions.reduce((sum, q) => sum + q.feedback.overall_score, 0);
              const averageScore = answeredQuestions.length > 0 ? totalScore / answeredQuestions.length : 0;
              saveGuestSession({ ...session, status: 'completed', averageScore });
            }
            navigate(`/review/${id}`);
        } catch(err: any) {
            setError(err.message || 'Failed to finish session.');
        }
    };

    const handleExtendTime = () => {
        setTimeLeft(prev => prev + 60);
        setIsTimeUp(false);
    };

  if (isPageLoading) return <LoadingSpinner />;
  if (error && !session) return <ErrorMessage message={error} />;
  if (!session || !currentQuestion) return <p>Session not found.</p>;
  
  const progress = ((session.currentQuestionIndex + 1) / session.questions.length) * 100;
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 30) return 'text-red-600 bg-red-100 animate-pulse';
    if (timeLeft <= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-800 bg-gray-100';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {isTimeUp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4"/>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Time's Up!</h2>
            <p className="text-gray-600 mb-6">The suggested time for this question has elapsed. You can extend the time or submit your answer now.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleExtendTime} className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50">
                Extend Time by 1 min
              </button>
              <button onClick={handleSubmitAnswer} className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Submit Answer
              </button>
            </div>
          </Card>
        </div>
      )}
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{session.jobTitle} Practice</h1>
      <p className="text-md text-gray-500 mb-6">at {session.company}</p>

      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-base font-medium text-primary-700">Question {session.currentQuestionIndex + 1} of {session.questions.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <Card>
        {isLoading && <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"><LoadingSpinner text="Evaluating answer..."/></div>}
        <div className="space-y-6 relative">
            <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full"><Tag className="w-4 h-4 mr-1"/>{currentQuestion.category}</span>
                <span className={`flex items-center px-2 py-1 rounded-full ${
                    currentQuestion.difficulty === 'Easy' ? 'bg-green-100 text-green-800' : 
                    currentQuestion.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }`}>{currentQuestion.difficulty}</span>
                <span className="flex items-center bg-gray-100 text-gray-800 px-2 py-1 rounded-full"><Clock className="w-4 h-4 mr-1"/>{currentQuestion.expected_answer_duration_minutes} min answer</span>
                <span className={`flex items-center px-2 py-1 rounded-full font-mono transition-colors ${getTimerColor()}`}>
                  <Timer className="w-4 h-4 mr-1.5"/>{formatTime(timeLeft)}
                </span>
            </div>

            <p className="text-xl font-semibold text-gray-800">{currentQuestion.question}</p>
            
            <div className="relative">
                <textarea
                    rows={10}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here or use the microphone..."
                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    disabled={isLoading}
                />
                {speechRecognition.current && (
                    <button
                        type="button"
                        onClick={handleToggleRecording}
                        className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
                            isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                        disabled={isLoading}
                    >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                )}
            </div>
            {isRecording && <p className="text-sm text-center text-gray-600 -mt-2">Recording... Click the mic to stop.</p>}


            {error && <ErrorMessage message={error} />}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                    <button onClick={handlePrev} disabled={session.currentQuestionIndex === 0 || isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center"><ChevronLeft className="w-4 h-4 mr-1"/> Prev</button>
                    <button onClick={handleNext} disabled={session.currentQuestionIndex === session.questions.length - 1 || isLoading || !!currentQuestion.userAnswer} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center">Next <ChevronRight className="w-4 h-4 ml-1"/></button>
                </div>
                <div className="flex gap-2">
                    {session.currentQuestionIndex === session.questions.length - 1 ? (
                        <button onClick={handleFinish} disabled={isLoading || !currentQuestion.userAnswer} className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center"><Check className="w-4 h-4 mr-1"/> Finish & Review</button>
                    ) : (
                         <button onClick={handleSubmitAnswer} disabled={isLoading || !!currentQuestion.userAnswer} className="px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50">Submit & Next</button>
                    )}
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default PracticeSession;