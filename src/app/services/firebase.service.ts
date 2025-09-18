import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, query, orderBy, getDocs, limit, where, onSnapshot, Unsubscribe } from 'firebase/firestore';

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
}
