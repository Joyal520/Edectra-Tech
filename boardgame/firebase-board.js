/**
 * EDTECHRA — Board Game Firebase Module
 * Reuses the same Firebase project as livequiz
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    getFirestore,
    serverTimestamp,
    Timestamp,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    getDocs,
    writeBatch,
    increment,
    limit,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase config (same project as livequiz)
const firebaseConfig = {
    apiKey: "AIzaSyC6d2ihQZBinYOh5NjYmC4CqlvH9Dh6Yo8",
    authDomain: "electratechlivequiz.firebaseapp.com",
    projectId: "electratechlivequiz",
    storageBucket: "electratechlivequiz.firebasestorage.app",
    messagingSenderId: "268767149449",
    appId: "1:268767149449:web:5b93fcf35bc86fd5513558",
    measurementId: "G-X5E0B5G6NH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Anonymous auth helper
export async function ensureAnonAuth() {
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
}

// Wait for auth to be ready
export function onAuthReady(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) callback(user);
    });
}

// Game state constants
export const GameState = {
    LOBBY: "lobby",
    QUESTION: "question",
    LOCKED: "locked",
    RESOLVED: "resolved",
    MOVING: "moving",
    ENDED: "ended"
};

// Game mode constants
export const GameMode = {
    SOLO: "solo",
    TEAMS: "teams"
};

// Team colors (matching existing player colors from app_v3.js CFG.COLORS)
export const TEAM_COLORS = ['#2B8CEE', '#8B5CF6', '#22C55E', '#EAB308'];
export const TEAM_NAMES = ['Blue Storm', 'Purple Reign', 'Green Force', 'Gold Rush'];

// Generate a 6-character join code
export function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Firestore helper exports
export const TS = serverTimestamp;
export const Fire = {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    getDocs,
    writeBatch,
    increment,
    limit,
    runTransaction,
    Timestamp
};
