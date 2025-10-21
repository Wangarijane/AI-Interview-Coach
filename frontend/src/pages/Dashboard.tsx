import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InterviewSession } from '../types';
import { getSessions } from '../services/apiService';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { PlusCircle, CheckCircle, Clock, Briefcase } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const fetchSessions = async () => {
        try {
          setIsLoading(true);
          const data = await getSessions();
          setSessions(data);
        } catch (err: any) {
          setError(err.message || "Failed to load session history.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchSessions();
    } else {
      // Guest users have no session history
      setSessions([]);
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return <LoadingSpinner text="Loading your dashboard..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }
  
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const classicCompleted = completedSessions.filter(s => s.mode === 'classic' && s.averageScore !== undefined);

  const totalInterviews = sessions.length;
  const avgScore = classicCompleted.length > 0
    ? classicCompleted.reduce((acc, s) => acc + s.averageScore!, 0) / classicCompleted.length
    : 0;
  
  const scoreTrendData = classicCompleted.map((s, index) => ({
      name: `Session ${index + 1}`,
      score: s.averageScore,
      job: s.jobTitle,
  })).reverse(); // Show oldest first

  const categoryScores: { [key: string]: { totalScore: number, count: number } } = {};
  classicCompleted.forEach(session => {
    session.questions.forEach(q => {
      if (q.feedback) {
        if (!categoryScores[q.category]) {
          categoryScores[q.category] = { totalScore: 0, count: 0 };
        }
        categoryScores[q.category].totalScore += q.feedback.overall_score;
        categoryScores[q.category].count++;
      }
    });
  });

  const categoryBreakdownData = Object.keys(categoryScores).map(category => ({
    name: category,
    'Average Score': categoryScores[category].totalScore / categoryScores[category].count,
  }));

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Card className="max-w-lg mx-auto">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-2 text-xl font-semibold text-gray-900">Welcome to your AI Interview Coach!</h2>
            <p className="mt-1 text-sm text-gray-500">
              {user ? "You haven't completed any interviews yet." : "Get started by creating a new practice session."}
            </p>
            <div className="mt-6">
              <Link
                to="/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
                Start Your First Interview
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-md text-gray-500 mt-1">Welcome back! Here's a summary of your interview practice.</p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
          New Interview
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="transition-transform transform hover:-translate-y-1">
          <h3 className="text-lg font-medium text-gray-500">Total Interviews</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalInterviews}</p>
        </Card>
        <Card className="transition-transform transform hover:-translate-y-1">
          <h3 className="text-lg font-medium text-gray-500">Avg. Score (Classic)</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{avgScore.toFixed(1)} / 10</p>
        </Card>
        <Card className="transition-transform transform hover:-translate-y-1">
          <h3 className="text-lg font-medium text-gray-500">Completed</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{completedSessions.length}</p>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="transition-transform transform hover:-translate-y-1">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Score Progression (Classic)</h2>
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={scoreTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 8 }} />
                  </LineChart>
              </ResponsiveContainer>
          </Card>
          <Card className="transition-transform transform hover:-translate-y-1">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Performance by Category (Classic)</h2>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryBreakdownData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Average Score" fill="#4f46e5" />
                  </BarChart>
              </ResponsiveContainer>
          </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Interview History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map(session => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{session.jobTitle}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`capitalize px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${session.mode === 'live' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {session.mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.status === 'completed' ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"><CheckCircle className="w-4 h-4 mr-1 inline"/>Completed</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800"><Clock className="w-4 h-4 mr-1 inline"/>In Progress</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.averageScore ? session.averageScore.toFixed(1) : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        if (session.status === 'completed') {
                            navigate(`/review/${session.id}`);
                        } else {
                            navigate(session.mode === 'live' ? `/live/${session.id}` : `/session/${session.id}`);
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium rounded-full transition-colors text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
                    >
                      {session.status === 'completed' ? 'Review' : (session.mode === 'live' ? 'Join' : 'Continue')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;