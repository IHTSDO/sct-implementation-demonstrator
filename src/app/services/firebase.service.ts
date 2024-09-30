import { Injectable } from '@angular/core';
import { getFirestore, collection, addDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db = getFirestore();
  readonly scoreLimit = 20;  // Define a constant for the limit

  async addScore(collectionName: string, score: any) {
    try {
      const docRef = await addDoc(collection(this.db, collectionName), score);
      // console.log("Document written with ID: ", docRef.id);
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
}
