import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from "@google/genai";
import { InterviewSession, TranscriptEntry, LiveSessionFeedback } from '../types';
import { getSession, finishSession as finishApiSession } from '../services/apiService';
import { getGuestSession, saveGuestSession } from '../services/localStorageService';
import { generateLiveSessionReview } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Mic, PhoneOff, Bot, User, CameraOff, AlertCircle, ThumbsUp, ThumbsDown, Award, Eye, MessageSquare } from 'lucide-react';

// Audio/Video Constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const FRAME_RATE = 10; // Frames per second for video stream
const JPEG_QUALITY = 0.6;

// A local interface for the Gemini Live Session object as it's not exported from the SDK.
interface GeminiLiveSession {
    sendRealtimeInput(input: { media: GenaiBlob }): void;
    close(): void;
}

// Helper Functions
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// This function constructs the system instruction string on the client-side.
const getLiveSessionSystemInstruction = (jobTitle: string, company: string, persona: string, resumeText?: string): string => {
    let instruction = `You are an AI interviewer and communication coach conducting a live, conversational interview for a ${jobTitle} position at ${company}. Your persona is "${persona}".
- You are receiving a real-time video and audio stream from the candidate.
- Begin the interview by introducing yourself and setting the stage.
- Ask a mix of technical, behavioral, and situational questions relevant to the job.
- Ask follow-up questions based on my responses to dig deeper.
- Keep your questions and responses concise to maintain a natural conversation flow.
- You must respond with voice. Do not provide text-only responses.`;
    if (resumeText) {
        instruction += `\n- You have my resume. Ask me specific questions about my projects and experiences listed there. Here is the resume:\n${resumeText}`;
    }
    instruction += `\n- Throughout the conversation, observe my non-verbal cues from the video stream. You will be asked to provide feedback on this after the interview.`;
    instruction += `\n- When I indicate I am ready to end the interview, say "Thank you for your time. This concludes the interview." and end the conversation.`;
    return instruction;
};


const LiveSession: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [status, setStatus] = useState<'loading' | 'idle' | 'requesting' | 'ready' | 'active' | 'ending' | 'error' | 'review'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [isConfirmingEndSession, setIsConfirmingEndSession] = useState(false);

    // Use a ref for the transcript to get synchronous access in callbacks, avoiding stale state.
    const [transcript, _setTranscript] = useState<TranscriptEntry[]>([]);
    const transcriptRef = useRef<TranscriptEntry[]>([]);
    const setTranscript = (updater: React.SetStateAction<TranscriptEntry[]>) => {
        const newTranscript = typeof updater === 'function' ? updater(transcriptRef.current) : updater;
        transcriptRef.current = newTranscript;
        _setTranscript(newTranscript);
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sessionPromiseRef = useRef<Promise<GeminiLiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const frameIntervalRef = useRef<number | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    
    // Audio playback queue
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

    useEffect(() => {
        const fetchSessionData = async () => {
            if (!id) return;
            try {
                let data: InterviewSession | null = null;
                if (user) {
                  data = await getSession(id);
                } else {
                  const guestSession = getGuestSession();
                  if (guestSession && guestSession.id === id) {
                    data = guestSession;
                  } else {
                    navigate('/'); // Guest session not found or mismatch
                    return;
                  }
                }
                setSession(data);
                setStatus('idle');
            } catch (err: any) {
                setError(err.message || "Failed to load session.");
                setStatus('error');
            }
        };
        fetchSessionData();
    }, [id, user, navigate]);

    const cleanup = () => {
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
        if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
        if (outputAudioContextRef.current?.state !== 'closed') outputAudioContextRef.current?.close();
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        sessionPromiseRef.current?.then(s => s.close()).catch(console.error);
        sessionPromiseRef.current = null;
    };

    useEffect(() => {
        return cleanup;
    }, []);

    const requestPermissions = async () => {
        setStatus('requesting');
        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            if (videoRef.current) videoRef.current.srcObject = mediaStreamRef.current;
            setStatus('ready');
        } catch (err) {
            console.error('Permission denied:', err);
            setError('Microphone and camera access are required for a live session. Please grant permission and refresh the page.');
            setStatus('error');
        }
    };
    
    const handleStartSession = () => {
        if (!session || !mediaStreamRef.current) return;
        setStatus('active');

        // The Live API requires a client-side connection for real-time media streaming.
        // fix: Cast import.meta to any to access env properties in TypeScript
        if (!(import.meta as any).env.VITE_API_KEY) {
            setError("Gemini API key not found. Please set the VITE_API_KEY environment variable. This is required for live sessions.");
            setStatus('error');
            return;
        }
        // fix: Cast import.meta to any to access env properties in TypeScript
        const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_API_KEY });
        
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
        outputAudioContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
        nextStartTimeRef.current = 0;

        const systemInstruction = getLiveSessionSystemInstruction(session.jobTitle, session.company, session.persona, session.resumeText);
        
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                systemInstruction,
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    const inputAudioContext = inputAudioContextRef.current!;
                    const source = inputAudioContext.createMediaStreamSource(mediaStreamRef.current!);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                        const pcmBlob: GenaiBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        sessionPromiseRef.current?.then((s) => s.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);

                    // Video streaming
                    const canvasEl = canvasRef.current!;
                    const videoEl = videoRef.current!;
                    const ctx = canvasEl.getContext('2d');
                    frameIntervalRef.current = window.setInterval(() => {
                        if (videoEl.readyState >= 2) {
                            canvasEl.width = videoEl.videoWidth;
                            canvasEl.height = videoEl.videoHeight;
                            ctx?.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                            canvasEl.toBlob(async (blob) => {
                                if (blob) {
                                    const base64Data = await blobToBase64(blob);
                                    sessionPromiseRef.current?.then((s) => s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
                                }
                            }, 'image/jpeg', JPEG_QUALITY);
                        }
                    }, 1000 / FRAME_RATE);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio) {
                        const outputAudioContext = outputAudioContextRef.current!;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, OUTPUT_SAMPLE_RATE, 1);
                        const sourceNode = outputAudioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(outputAudioContext.destination);
                        sourceNode.addEventListener('ended', () => sourcesRef.current.delete(sourceNode));
                        sourceNode.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(sourceNode);
                    }
                    
                    if (message.serverContent?.outputTranscription) {
                        const text = message.serverContent.outputTranscription.text;
                        setTranscript(prev => {
                            const newTranscript = [...prev];
                            const lastEntry = newTranscript.length > 0 ? newTranscript[newTranscript.length - 1] : null;
                            if (lastEntry?.speaker === 'ai') {
                                lastEntry.text += text;
                            } else if (text.trim()) {
                                newTranscript.push({ speaker: 'ai', text });
                            }
                            return newTranscript;
                        });
                    }
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        setTranscript(prev => {
                            const newTranscript = [...prev];
                            const lastEntry = newTranscript.length > 0 ? newTranscript[newTranscript.length - 1] : null;
                            if (lastEntry?.speaker === 'user') {
                                lastEntry.text += text;
                            } else if (text.trim()) {
                                newTranscript.push({ speaker: 'user', text });
                            }
                            return newTranscript;
                        });
                    }

                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Session error:', e);
                    setError('A connection error occurred. The session has ended.');
                    setStatus('error');
                    cleanup();
                },
                onclose: () => {},
            }
        });
    };

    const handleEndSession = async () => {
        if (!id || !session) return;
        setStatus('ending');
        cleanup();
        
        try {
            const finalTranscript = transcriptRef.current;
            let finishedSession: InterviewSession;

            if (user) {
                finishedSession = await finishApiSession(id, finalTranscript);
            } else {
                const feedback = await generateLiveSessionReview(finalTranscript, session.jobTitle);
                finishedSession = {
                    ...session,
                    status: 'completed',
                    transcript: finalTranscript,
                    liveSessionFeedback: feedback,
                };
                saveGuestSession(finishedSession);
            }
            setSession(finishedSession);
            setTranscript(finishedSession.transcript || []);
            setStatus('review');
        } catch (err: any) {
            setError(err.message || 'Failed to generate your performance review.');
            setStatus('error');
        }
    };
    
    const renderOverlayContent = () => {
        switch (status) {
            case 'loading':
                return <LoadingSpinner text="Loading session..." />;
            case 'idle':
                return (
                    <div className="text-center p-6 bg-black bg-opacity-70 rounded-lg">
                        <h2 className="text-2xl font-semibold mb-3 text-white">Live Interview</h2>
                        <p className="text-gray-300 mb-6">Grant camera and microphone access to begin.</p>
                        <button onClick={requestPermissions} className="px-6 py-3 font-semibold text-white bg-primary-600 rounded-lg shadow-md hover:bg-primary-700 transition">
                            Allow Access
                        </button>
                    </div>
                );
            case 'requesting':
                return <LoadingSpinner text="Waiting for permissions..." />;
            case 'ready':
                return (
                     <div className="text-center p-6 bg-black bg-opacity-70 rounded-lg">
                        <h2 className="text-2xl font-semibold mb-3 text-white">Ready to Start!</h2>
                        <p className="text-gray-300 mb-6">The AI interviewer is waiting for you.</p>
                        <button onClick={handleStartSession} className="px-6 py-3 font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition">
                            Start Interview
                        </button>
                    </div>
                );
            case 'error':
                 return (
                     <div className="text-center p-6 bg-black bg-opacity-80 rounded-lg max-w-md shadow-lg border border-red-500/50">
                        {mediaStreamRef.current ? <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" /> : <CameraOff className="w-12 h-12 text-red-400 mx-auto mb-4" />}
                        <h2 className="text-xl font-bold text-white mb-2">{mediaStreamRef.current ? 'Session Error' : 'Permissions Blocked'}</h2>
                        <p className="text-gray-300 mb-4">{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700">
                            {mediaStreamRef.current ? 'Try Again' : 'Refresh'}
                        </button>
                    </div>
                );
            case 'ending':
                return <LoadingSpinner text="Analyzing your performance..." />;
            case 'active':
            default: return null;
        }
    };
    
    if (status === 'review' && session) {
        return <LiveReviewDisplay session={session} />;
    }

    return (
        <div className="max-w-5xl mx-auto bg-gray-800 p-4 sm:p-6 rounded-lg shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-1">{session?.jobTitle} Live Practice</h1>
            <p className="text-md text-gray-300 mb-4">Interviewer Persona: {session?.persona}</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative aspect-video w-full">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-lg bg-black transform scale-x-[-1]"></video>
                        <canvas ref={canvasRef} className="hidden"></canvas>
                         {status !== 'active' &&
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black bg-opacity-70 p-4">
                                {renderOverlayContent()}
                            </div>
                        }
                        {status === 'active' && (
                            <>
                                <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center animate-pulse">
                                    <Mic className="w-3 h-3 mr-1.5"/> LIVE
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex justify-center items-center">
                                    <button onClick={() => setIsConfirmingEndSession(true)} disabled={status !== 'active'} className="px-6 py-3 text-lg font-semibold text-white bg-red-600 rounded-full shadow-md hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <PhoneOff className="w-6 h-6"/> End Session
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-1">
                    <TranscriptDisplay transcript={transcript} />
                </div>
            </div>

            {isConfirmingEndSession && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <div className="text-center">
                            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-gray-800 mb-2">End Interview Session?</h2>
                            <p className="text-gray-600 mb-6">Are you sure you want to end the interview? This will finalize the session and generate your performance review.</p>
                        </div>
                        <div className="flex justify-center gap-4 mt-4">
                            <button 
                                onClick={() => setIsConfirmingEndSession(false)} 
                                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    setIsConfirmingEndSession(false);
                                    handleEndSession();
                                }} 
                                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
                            >
                                Yes, End Session
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

const TranscriptDisplay: React.FC<{transcript: TranscriptEntry[]}> = ({ transcript }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    return (
        <Card className="h-[calc(100vh-20rem)] lg:h-full bg-gray-900 border border-gray-700 !p-4">
            <h3 className="text-lg font-semibold text-white mb-3 border-b border-gray-600 pb-2">Conversation Transcript</h3>
            <div ref={scrollRef} className="h-full max-h-[calc(100%-3rem)] overflow-y-auto space-y-4 pr-2">
                 {transcript.length === 0 && <p className="text-gray-400 text-center pt-8">Your conversation will appear here...</p>}
                 {transcript.map((entry, index) => (
                    <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
                        {entry.speaker === 'ai' && <div className="flex-shrink-0 p-2 rounded-full bg-primary-900/50 text-primary-300"><Bot className="w-5 h-5" /></div>}
                        <div className={`p-3 rounded-lg max-w-sm ${entry.speaker === 'ai' ? 'bg-gray-700' : 'bg-blue-600'}`}>
                            <p className="text-sm text-white">{entry.text}</p>
                        </div>
                        {entry.speaker === 'user' && <div className="flex-shrink-0 p-2 rounded-full bg-blue-900/50 text-blue-300"><User className="w-5 h-5" /></div>}
                    </div>
                ))}
            </div>
        </Card>
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

const LiveReviewDisplay: React.FC<{ session: InterviewSession }> = ({ session }) => {
    const { liveSessionFeedback: feedback, transcript } = session;

    if (!feedback) {
        return <ErrorMessage message="Feedback for this session could not be loaded." />;
    }

    return (
        <div className="bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6 text-gray-800">
            <div className="max-w-4xl mx-auto space-y-6">
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
        </div>
    );
};

export default LiveSession;