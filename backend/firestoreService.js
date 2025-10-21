import { Firestore } from '@google-cloud/firestore';

const db = new Firestore();

const getUserSessionsCollection = (userId) => {
  if (!userId) {
    throw new Error("User ID is required to access user-specific data.");
  }
  return db.collection('users').doc(userId).collection('interview_sessions');
};

export const createSession = async (userId, sessionData) => {
  const sessionsCollection = getUserSessionsCollection(userId);
  const docRef = sessionsCollection.doc();
  const newSession = {
    ...sessionData,
    id: docRef.id,
    userId: userId,
  };
  await docRef.set(newSession);
  return newSession;
};

export const getSessions = async (userId) => {
  const sessionsCollection = getUserSessionsCollection(userId);
  const snapshot = await sessionsCollection.orderBy('createdAt', 'desc').get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => doc.data());
};

export const getSession = async (userId, id) => {
  const sessionsCollection = getUserSessionsCollection(userId);
  const doc = await sessionsCollection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data();
};

export const updateSession = async (userId, id, updateData) => {
  const sessionsCollection = getUserSessionsCollection(userId);
  const docRef = sessionsCollection.doc(id);
  await docRef.set(updateData, { merge: true });
  const updatedDoc = await docRef.get();
  return updatedDoc.data();
};

export const importSession = async (userId, sessionData) => {
  const sessionsCollection = getUserSessionsCollection(userId);
  // Use the session ID generated on the client to keep URLs consistent after login.
  const docRef = sessionsCollection.doc(sessionData.id);
  const sessionToImport = {
    ...sessionData,
    userId: userId, // Overwrite with the real user ID
  };
  await docRef.set(sessionToImport);
  return sessionToImport;
};