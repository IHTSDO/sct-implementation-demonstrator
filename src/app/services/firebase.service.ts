import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db = getFirestore();
  readonly scoreLimit = 20;  // Define a constant for the limit

  async addScore(score: any) {
    try {
      const docRef = await addDoc(collection(this.db, "scoreboard"), score);
      // console.log("Document written with ID: ", docRef.id);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }
  
  async getScores() {
    const scoresCol = collection(this.db, "scoreboard");
    // Apply the limit to the query
    const q = query(scoresCol, orderBy("score", "desc"), limit(this.scoreLimit));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
