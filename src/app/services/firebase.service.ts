import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, query, orderBy, getDocs, limit, where, onSnapshot, Unsubscribe, doc, deleteDoc } from 'firebase/firestore';

// Interface for maturity assessment result data
export interface MaturityAssessmentResult {
  selectedStakeholder: string;
  selectedKpas: Record<string, boolean>;
  name: string;
  author: string;
  timestamp: string;
  systemName: string;
  location: any;
  allQuestions?: any[]; // Made optional since we're not saving it to Firebase due to nested arrays
  // Raw scores (0-100 scale) - for internal calculations and utilities
  overallScore: number;
  kpasScores: Record<string, number>;
  // Normalized scores (0-5 scale) - for display and user-facing features
  overallScoreNormalized: number;
  kpasScoresNormalized: Record<string, number>;
  level: string;
  eventName?: string; // For grouping assessments by event (e.g., "Expo 2025")
  [key: string]: any; // Allow for additional question responses and comments
}

// Interface for quiz leaderboard entry
export interface QuizLeaderboardEntry {
  name: string;
  score: number;
  quiz: string;
  date: string;
  eventName?: string; // For grouping by event (e.g., "Expo 2025")
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db = getFirestore();
  readonly scoreLimit = 20;  // Define a constant for the limit

  async addScore(collectionName: string, score: any) {
    try {
      const docRef = await addDoc(collection(this.db, collectionName), score);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }
  
  async getScores(collectionName: string) {
    const scoresCol = collection(this.db, collectionName);
    // Apply the limit to the query
    const q = query(scoresCol, orderBy("score", "desc"), limit(this.scoreLimit));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Add a maturity assessment result to Firebase
   * @param assessmentResult The maturity assessment data to save
   * @param eventName Optional event name for grouping (e.g., "Expo 2025")
   * @returns Promise that resolves when the document is added
   */
  async addMaturityAssessmentResult(assessmentResult: MaturityAssessmentResult, eventName?: string): Promise<void> {
    try {
      // Add eventName to the assessment result if provided
      const dataToSave = {
        ...assessmentResult,
        eventName: eventName || 'General',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(this.db, 'maturityAssessments'), dataToSave);
    } catch (error) {
      console.error("Error adding maturity assessment document: ", error);
      throw error;
    }
  }

  /**
   * Get maturity assessment results, optionally filtered by event name
   * @param eventName Optional event name to filter by (e.g., "Expo 2025")
   * @param limitCount Optional limit for number of results (default: 50)
   * @returns Promise that resolves to array of assessment results
   */
  async getMaturityAssessmentResults(eventName?: string, limitCount: number = 50): Promise<MaturityAssessmentResult[]> {
    try {
      const assessmentsCol = collection(this.db, 'maturityAssessments');
      
      let q;
      if (eventName) {
        // Filter by event name and order by timestamp (newest first)
        q = query(
          assessmentsCol,
          where('eventName', '==', eventName),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      } else {
        // Get all results ordered by timestamp (newest first)
        q = query(
          assessmentsCol,
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      
      const results = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as MaturityAssessmentResult & { id: string };
      });
      
      return results;
    } catch (error) {
      console.error("❌ FirebaseService error getting maturity assessment results: ", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get maturity assessment results grouped by event name
   * @returns Promise that resolves to object with event names as keys and arrays of assessments as values
   */
  async getMaturityAssessmentResultsByEvent(): Promise<Record<string, MaturityAssessmentResult[]>> {
    try {
      const assessmentsCol = collection(this.db, 'maturityAssessments');
      const q = query(assessmentsCol, orderBy('timestamp', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const allAssessments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MaturityAssessmentResult & { id: string }));

      // Group by event name
      const groupedResults: Record<string, MaturityAssessmentResult[]> = {};
      allAssessments.forEach(assessment => {
        const event = assessment.eventName || 'General';
        if (!groupedResults[event]) {
          groupedResults[event] = [];
        }
        groupedResults[event].push(assessment);
      });

      return groupedResults;
    } catch (error) {
      console.error("Error getting maturity assessment results by event: ", error);
      throw error;
    }
  }

  /**
   * Delete a maturity assessment result from Firebase
   * @param docId The document ID of the assessment to delete
   * @returns Promise that resolves when the document is deleted
   */
  async deleteMaturityAssessmentResult(docId: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'maturityAssessments', docId);
      await deleteDoc(docRef);
      console.log('✅ Assessment deleted successfully:', docId);
    } catch (error) {
      console.error("❌ Error deleting maturity assessment document:", error);
      throw error;
    }
  }

  // Real-time listener for maturity assessment results
  subscribeToMaturityAssessmentResults(
    eventName: string,
    onDataChange: (changes: { type: 'added' | 'removed' | 'modified', data: MaturityAssessmentResult, docId: string }[]) => void,
    limitCount: number = 50
  ): Unsubscribe {
    const assessmentsCol = collection(this.db, 'maturityAssessments');
    const q = query(
      assessmentsCol,
      where('eventName', '==', eventName),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const changes = snapshot.docChanges().map(change => {
        const data = change.doc.data() as MaturityAssessmentResult;
        
        return {
          type: change.type as 'added' | 'removed' | 'modified',
          data: data,
          docId: change.doc.id
        };
      });

      if (changes.length > 0) {
        onDataChange(changes);
      }
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
    });
  }

  /**
   * Add a quiz leaderboard entry to Firebase
   * @param leaderboardEntry The quiz leaderboard entry to save
   * @param eventName Optional event name for grouping (e.g., "Expo 2025")
   * @returns Promise that resolves when the document is added
   */
  async addQuizLeaderboardEntry(leaderboardEntry: QuizLeaderboardEntry, eventName?: string): Promise<void> {
    try {
      const dataToSave = {
        ...leaderboardEntry,
        eventName: eventName || 'General',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(this.db, 'quizLeaderboard'), dataToSave);
      console.log('✅ Quiz leaderboard entry added successfully:', docRef.id);
    } catch (error) {
      console.error("❌ Error adding quiz leaderboard entry: ", error);
      throw error;
    }
  }

  /**
   * Get quiz leaderboard entries, optionally filtered by quiz type and event name
   * @param quizType Optional quiz type to filter by (e.g., "food", "snomed")
   * @param eventName Optional event name to filter by (e.g., "Expo 2025")
   * @param limitCount Optional limit for number of results (default: 10)
   * @returns Promise that resolves to array of leaderboard entries
   */
  async getQuizLeaderboardEntries(quizType?: string, eventName?: string, limitCount: number = 10): Promise<QuizLeaderboardEntry[]> {
    try {
      const leaderboardCol = collection(this.db, 'quizLeaderboard');
      
      let q;
      if (quizType && eventName) {
        // Filter by both quiz type and event name
        q = query(
          leaderboardCol,
          where('quiz', '==', quizType),
          where('eventName', '==', eventName),
          orderBy('score', 'desc'),
          orderBy('date', 'asc'),
          limit(limitCount)
        );
      } else if (quizType) {
        // Filter by quiz type only
        q = query(
          leaderboardCol,
          where('quiz', '==', quizType),
          orderBy('score', 'desc'),
          orderBy('date', 'asc'),
          limit(limitCount)
        );
      } else if (eventName) {
        // Filter by event name only
        q = query(
          leaderboardCol,
          where('eventName', '==', eventName),
          orderBy('score', 'desc'),
          orderBy('date', 'asc'),
          limit(limitCount)
        );
      } else {
        // Get all results
        q = query(
          leaderboardCol,
          orderBy('score', 'desc'),
          orderBy('date', 'asc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      
      const results = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as QuizLeaderboardEntry & { id: string };
      });
      
      return results;
    } catch (error) {
      console.error("❌ Error getting quiz leaderboard entries: ", error);
      throw error;
    }
  }

  /**
   * Get quiz leaderboard entries grouped by quiz type
   * @param eventName Optional event name to filter by (e.g., "Expo 2025")
   * @returns Promise that resolves to object with quiz types as keys and arrays of entries as values
   */
  async getQuizLeaderboardEntriesByQuizType(eventName?: string): Promise<Record<string, QuizLeaderboardEntry[]>> {
    try {
      const leaderboardCol = collection(this.db, 'quizLeaderboard');
      
      let q;
      if (eventName) {
        q = query(
          leaderboardCol,
          where('eventName', '==', eventName),
          orderBy('score', 'desc'),
          orderBy('date', 'asc')
        );
      } else {
        q = query(
          leaderboardCol,
          orderBy('score', 'desc'),
          orderBy('date', 'asc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      const allEntries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as QuizLeaderboardEntry & { id: string }));

      // Group by quiz type and keep only top 10 for each
      const groupedResults: Record<string, QuizLeaderboardEntry[]> = {};
      allEntries.forEach(entry => {
        const quizType = entry.quiz;
        if (!groupedResults[quizType]) {
          groupedResults[quizType] = [];
        }
        if (groupedResults[quizType].length < 10) {
          groupedResults[quizType].push(entry);
        }
      });

      return groupedResults;
    } catch (error) {
      console.error("❌ Error getting quiz leaderboard entries by quiz type: ", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates for quiz leaderboard entries
   * @param quizType Optional quiz type to filter by (e.g., "food", "snomed")
   * @param eventName Optional event name to filter by (e.g., "Expo 2025")
   * @param onDataChange Callback function to handle data changes
   * @param limitCount Optional limit for number of results (default: 10)
   * @returns Unsubscribe function to stop listening
   */
  subscribeToQuizLeaderboardEntries(
    quizType: string | undefined,
    eventName: string | undefined,
    onDataChange: (entries: QuizLeaderboardEntry[]) => void,
    limitCount: number = 10
  ): Unsubscribe {
    const leaderboardCol = collection(this.db, 'quizLeaderboard');
    
    let q;
    if (quizType && eventName) {
      // Filter by both quiz type and event name
      q = query(
        leaderboardCol,
        where('quiz', '==', quizType),
        where('eventName', '==', eventName),
        orderBy('score', 'desc'),
        orderBy('date', 'asc'),
        limit(limitCount)
      );
    } else if (quizType) {
      // Filter by quiz type only
      q = query(
        leaderboardCol,
        where('quiz', '==', quizType),
        orderBy('score', 'desc'),
        orderBy('date', 'asc'),
        limit(limitCount)
      );
    } else if (eventName) {
      // Filter by event name only
      q = query(
        leaderboardCol,
        where('eventName', '==', eventName),
        orderBy('score', 'desc'),
        orderBy('date', 'asc'),
        limit(limitCount)
      );
    } else {
      // Get all results
      q = query(
        leaderboardCol,
        orderBy('score', 'desc'),
        orderBy('date', 'asc'),
        limit(limitCount)
      );
    }

    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as QuizLeaderboardEntry & { id: string };
      });
      
      onDataChange(entries);
    }, (error) => {
      console.error('❌ Real-time quiz leaderboard listener error:', error);
    });
  }

  /**
   * Subscribe to real-time updates for both quiz leaderboards
   * @param eventName Optional event name to filter by (e.g., "Expo 2025")
   * @param onDataChange Callback function to handle data changes
   * @param limitCount Optional limit for number of results (default: 10)
   * @returns Object with unsubscribe functions for both listeners
   */
  subscribeToAllQuizLeaderboards(
    eventName: string | undefined,
    onDataChange: (foodEntries: QuizLeaderboardEntry[], snomedEntries: QuizLeaderboardEntry[]) => void,
    limitCount: number = 10
  ): { unsubscribeFood: Unsubscribe, unsubscribeSnomed: Unsubscribe } {
    let foodEntries: QuizLeaderboardEntry[] = [];
    let snomedEntries: QuizLeaderboardEntry[] = [];

    const updateCallback = () => {
      onDataChange(foodEntries, snomedEntries);
    };

    const unsubscribeFood = this.subscribeToQuizLeaderboardEntries(
      'food',
      eventName,
      (entries) => {
        foodEntries = entries;
        updateCallback();
      },
      limitCount
    );

    const unsubscribeSnomed = this.subscribeToQuizLeaderboardEntries(
      'snomed',
      eventName,
      (entries) => {
        snomedEntries = entries;
        updateCallback();
      },
      limitCount
    );

    return { unsubscribeFood, unsubscribeSnomed };
  }
}
