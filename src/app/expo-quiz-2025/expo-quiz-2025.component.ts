import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FirebaseService, QuizLeaderboardEntry } from '../services/firebase.service';
import { Unsubscribe } from 'firebase/firestore';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface QuizData {
  questions: QuizQuestion[];
}

// Using the QuizLeaderboardEntry interface from FirebaseService

@Component({
  selector: 'app-expo-quiz-2025',
  templateUrl: './expo-quiz-2025.component.html',
  styleUrls: ['./expo-quiz-2025.component.css'],
  standalone: false
})
export class ExpoQuiz2025Component implements OnInit, OnDestroy {
  // Quiz data structure
  quizData: { [key: string]: QuizData } = {
    food: {
      questions: [
        {
          question: "In the UK, what is \"pudding\" most commonly used to describe?",
          options: [
            "A savory meat dish",
            "A type of creamy, sweet dessert", 
            "A general term for any dessert served after the main course",
            "A thick gravy"
          ],
          correct: 2,
          explanation: "A general term for any dessert served after the main course. In the UK, \"pudding\" can refer to sticky toffee pudding, but also to crumble, pie, and even the \"pudding\" course itself."
        },
        {
          question: "If an American orders a \"biscuit\" at a restaurant, what is the closest equivalent they would get in the UK?",
          options: [
            "A scone",
            "A soft cookie",
            "A hard cracker", 
            "A piece of bread"
          ],
          correct: 0,
          explanation: "A scone. A British \"biscuit\" is a hard baked good, similar to a cookie or cracker. A fluffy, savory American \"biscuit\" is much closer to a scone."
        },
        {
          question: "In Australia, what would a café serve if you ordered \"chips\"?",
          options: [
            "Thin, fried slices of potato from a bag",
            "Thick-cut, deep-fried potato wedges",
            "Tortilla chips with salsa",
            "Potato fries"
          ],
          correct: 3,
          explanation: "Potato fries. While \"chips\" can mean potato chips in Australia (the bagged variety), it most often refers to hot chips or fries."
        },
        {
          question: "A \"courgette\" in the UK is the same vegetable as a \"zucchini\" in the US. What country is the word \"courgette\" borrowed from?",
          options: [
            "Germany",
            "Italy", 
            "France",
            "Spain"
          ],
          correct: 2,
          explanation: "France. \"Courgette\" comes from the French word for the vegetable. \"Zucchini\" comes from Italian."
        },
        {
          question: "What is the main difference between what a \"jam\" is in the UK and a \"jelly\" is in the US?",
          options: [
            "Jam has pieces of fruit, while jelly is smooth",
            "Jam is a savory spread, while jelly is sweet",
            "Jam is served warm, while jelly is served cold",
            "Jam is made with less sugar than jelly"
          ],
          correct: 0,
          explanation: "Jam has pieces of fruit, while jelly is smooth. This is the key distinction. In the US, \"jelly\" is made from fruit juice and is smooth, while \"jam\" contains crushed fruit. In the UK, \"jam\" is the more common term for a fruit spread."
        }
      ]
    },
    snomed: {
      questions: [
        {
          question: "In the United States, a patient with a \"bruise\" would likely have a diagnosis of 6218003 |Contusion (disorder)|. In the United Kingdom, what is the most common and preferred term for this finding?",
          options: [
            "Ecchymosis",
            "Hematoma",
            "Laceration",
            "Bruising"
          ],
          correct: 3,
          explanation: "Bruising. While \"contusion\" is the official SNOMED CT concept, \"bruising\" is a more common and often preferred term in UK clinical practice and is included in the UK extension."
        },
        {
          question: "A procedure for a full-term cesarean section is represented differently in different countries. A common American English description is 364379007 |Caesarean section for delivery (procedure)|. What is the common Australian English preferred term for this concept?",
          options: [
            "Cesarean section delivery",
            "Delivery by caesarean section",
            "Delivery - caesarean",
            "Cesarean section, delivery"
          ],
          correct: 1,
          explanation: "Delivery by caesarean section. The official International Edition may use one term, but national extensions often have a locally preferred synonym."
        },
        {
          question: "The term \"GP\" is widely understood in many countries to mean a General Practitioner. However, which country's SNOMED CT extension includes a specific concept for \"GP referral\" as a type of procedure, reflecting a specific workflow?",
          options: [
            "Australia",
            "United States",
            "United Kingdom",
            "Canada"
          ],
          correct: 2,
          explanation: "United Kingdom. The NHS uses the SNOMED CT UK Extension to model specific concepts like \"GP referral\" that are integral to their national healthcare system's workflows."
        },
        {
          question: "The concept for \"heart attack\" has a standard SNOMED CT identifier. However, the American English preferred term is 22298006 |Myocardial infarction (disorder)|. What is the common preferred term for this concept in British English?",
          options: [
            "Myocardial infarction",
            "Myocardial infarct",
            "Heart attack",
            "Acute myocardial infarction"
          ],
          correct: 2,
          explanation: "Heart attack. While the official SNOMED CT concept ID is the same for all languages, different countries have a preferred term that is most commonly used by clinicians. In the UK, \"heart attack\" is the preferred term, while in the US, it is \"myocardial infarction.\""
        },
        {
          question: "The US and UK editions of SNOMED CT have different ways of representing drug products. In the UK, the terminology is tightly linked to the NHS dictionary of medicines and devices (dm+d). What does this mean for drug concepts in the UK vs. US editions?",
          options: [
            "The UK edition contains more generic drug concepts, while the US edition is more specific",
            "The UK edition includes concepts for specific brand-name and pack-size drug products",
            "The US edition uses a separate terminology entirely for drugs",
            "There is no difference in how drug concepts are represented"
          ],
          correct: 1,
          explanation: "The UK edition includes concepts for specific brand-name and pack-size drug products. The UK's close integration with dm+d means that its SNOMED CT extension has a much more granular and specific set of concepts for drug products than the international edition, which focuses on generic drugs. The US also has its own extension for drug concepts, but it is not a direct analog to the UK model."
        }
      ]
    }
  };

  // Component state
  currentQuiz: string | null = null;
  currentQuestion: number = 0;
  score: number = 0;
  selectedAnswer: number | null = null;
  answers: number[] = [];
  
  // UI state
  showQuizSelector: boolean = true;
  showFoodQuiz: boolean = false;
  showSnomedQuiz: boolean = false;
  showAnswersModal: boolean = false;
  showResultsModal: boolean = false;
  showLeaderboardModal: boolean = false;
  
  // Feedback state
  showFeedback: boolean = false;
  isAnswerCorrect: boolean = false;
  feedbackMessage: string = '';
  currentCorrectAnswer: number | null = null;
  
  // Modal data
  incorrectAnswers: any[] = [];
  playerName: string = '';
  leaderboard: QuizLeaderboardEntry[] = [];
  foodLeaderboard: QuizLeaderboardEntry[] = [];
  snomedLeaderboard: QuizLeaderboardEntry[] = [];
  nameSubmitted: boolean = false;
  
  // Event name for grouping quiz results
  eventName: string = 'Expo 2025';
  
  // Background image path
  backgroundImage: string = 'assets/img/antwerp.png';
  
  // Loading states
  isLoadingLeaderboards: boolean = false;
  
  // Real-time listeners
  private leaderboardUnsubscribers: { unsubscribeFood?: Unsubscribe, unsubscribeSnomed?: Unsubscribe } = {};

  constructor(private firebaseService: FirebaseService) { }

  ngOnInit(): void {
    this.initializeApp();
  }

  ngOnDestroy(): void {
    // Clean up real-time listeners
    this.unsubscribeFromLeaderboards();
  }

  private initializeApp(): void {
    // Component is ready, no additional initialization needed
  }

  private subscribeToLeaderboards(): void {
    // Subscribe to real-time updates for both leaderboards
    const { unsubscribeFood, unsubscribeSnomed } = this.firebaseService.subscribeToAllQuizLeaderboards(
      this.eventName,
      (foodEntries, snomedEntries) => {
        this.foodLeaderboard = foodEntries;
        this.snomedLeaderboard = snomedEntries;
      },
      10
    );

    this.leaderboardUnsubscribers.unsubscribeFood = unsubscribeFood;
    this.leaderboardUnsubscribers.unsubscribeSnomed = unsubscribeSnomed;
  }

  private unsubscribeFromLeaderboards(): void {
    if (this.leaderboardUnsubscribers.unsubscribeFood) {
      this.leaderboardUnsubscribers.unsubscribeFood();
      this.leaderboardUnsubscribers.unsubscribeFood = undefined;
    }
    if (this.leaderboardUnsubscribers.unsubscribeSnomed) {
      this.leaderboardUnsubscribers.unsubscribeSnomed();
      this.leaderboardUnsubscribers.unsubscribeSnomed = undefined;
    }
  }

  async viewLeaderboardFromHome(): Promise<void> {
    // Show modal immediately for better UX
    this.showLeaderboardModal = true;
    this.isLoadingLeaderboards = true;
    
    try {
      // Subscribe to real-time updates
      this.subscribeToLeaderboards();
      
      // Load initial data
      await this.loadBothLeaderboards();
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      this.isLoadingLeaderboards = false;
    }
  }

  startQuiz(quizType: string): void {
    this.currentQuiz = quizType;
    this.currentQuestion = 0;
    this.score = 0;
    this.selectedAnswer = null;
    this.answers = [];
    this.nameSubmitted = false;

    // Hide quiz selector and show selected quiz
    this.showQuizSelector = false;
    
    if (quizType === 'food') {
      this.showFoodQuiz = true;
      this.showSnomedQuiz = false;
    } else {
      this.showSnomedQuiz = true;
      this.showFoodQuiz = false;
    }

    this.resetQuizState();
  }

  private resetQuizState(): void {
    this.selectedAnswer = null;
    this.showFeedback = false;
    this.isAnswerCorrect = false;
    this.feedbackMessage = '';
    this.currentCorrectAnswer = null;
  }

  selectAnswer(answerIndex: number): void {
    // Don't allow changing answer while feedback is showing
    if (this.showFeedback) return;
    
    this.selectedAnswer = answerIndex;
    
    // Check if answer is correct
    const correctAnswer = this.quizData[this.currentQuiz!].questions[this.currentQuestion].correct;
    this.currentCorrectAnswer = correctAnswer;
    this.isAnswerCorrect = (answerIndex === correctAnswer);
    
    // Set feedback message
    if (this.isAnswerCorrect) {
      const messages = ['🎉 Correct!', '✨ Well done!', '🌟 Excellent!', '👏 Great job!', '💯 Perfect!'];
      this.feedbackMessage = messages[Math.floor(Math.random() * messages.length)];
    } else {
      const messages = ['❌ Incorrect', '🤔 Not quite', '💭 Try again next time', '📚 Keep learning'];
      this.feedbackMessage = messages[Math.floor(Math.random() * messages.length)];
    }
    
    // Show feedback
    this.showFeedback = true;
  }

  nextQuestion(): void {
    if (this.selectedAnswer === null) return;
    
    // Store the answer
    this.answers[this.currentQuestion] = this.selectedAnswer;
    
    // Check if answer is correct
    const correctAnswer = this.quizData[this.currentQuiz!].questions[this.currentQuestion].correct;
    if (this.selectedAnswer === correctAnswer) {
      this.score++;
    }
    
    // Move to next question
    this.currentQuestion++;
    this.selectedAnswer = null;
    this.showFeedback = false;
    this.isAnswerCorrect = false;
    this.feedbackMessage = '';
    this.currentCorrectAnswer = null;
  }

  finishQuiz(): void {
    if (this.selectedAnswer === null) return;
    
    // Store the final answer
    this.answers[this.currentQuestion] = this.selectedAnswer;
    
    // Check if final answer is correct
    const correctAnswer = this.quizData[this.currentQuiz!].questions[this.currentQuestion].correct;
    if (this.selectedAnswer === correctAnswer) {
      this.score++;
    }
    
    // Go directly to results, skip the answers modal
    this.showResults();
  }

  private showAnswers(): void {
    const questions = this.quizData[this.currentQuiz!].questions;
    
    // Filter to only show incorrect answers
    this.incorrectAnswers = [];
    questions.forEach((question, index) => {
      const userAnswer = this.answers[index];
      const correctAnswer = question.correct;
      const isCorrect = userAnswer === correctAnswer;
      
      if (!isCorrect) {
        this.incorrectAnswers.push({ question, index, userAnswer, correctAnswer });
      }
    });
    
    // If no incorrect answers, skip directly to results
    if (this.incorrectAnswers.length === 0) {
      this.showResults();
      return;
    }
    
    this.showAnswersModal = true;
  }

  async viewResults(): Promise<void> {
    this.showAnswersModal = false;
    this.showResultsModal = true;
    this.isLoadingLeaderboards = true;
    
    try {
      // Subscribe to real-time updates
      this.subscribeToLeaderboards();
      
      // Load initial data
      await this.loadBothLeaderboards();
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      this.isLoadingLeaderboards = false;
    }
  }

  private async showResults(): Promise<void> {
    this.showAnswersModal = false;
    this.showResultsModal = true;
    this.isLoadingLeaderboards = true;
    
    try {
      // Subscribe to real-time updates
      this.subscribeToLeaderboards();
      
      // Load initial data
      await this.loadBothLeaderboards();
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      this.isLoadingLeaderboards = false;
    }
  }

  private async loadBothLeaderboards(): Promise<void> {
    try {
      // Load food quiz leaderboard from Firebase
      this.foodLeaderboard = await this.firebaseService.getQuizLeaderboardEntries('food', this.eventName, 10);
      
      // Load SNOMED quiz leaderboard from Firebase
      this.snomedLeaderboard = await this.firebaseService.getQuizLeaderboardEntries('snomed', this.eventName, 10);
    } catch (error) {
      console.error('Error loading leaderboards:', error);
      // Fallback to empty arrays if Firebase fails
      this.foodLeaderboard = [];
      this.snomedLeaderboard = [];
    }
  }

  getScoreMessage(): string {
    if (this.score === 5) {
      return '🎉 Perfect! You\'re a quiz master!';
    } else if (this.score >= 4) {
      return '🌟 Excellent work!';
    } else if (this.score >= 3) {
      return '👍 Good job!';
    } else if (this.score >= 2) {
      return '📚 Keep learning!';
    } else {
      return '💪 Don\'t give up!';
    }
  }

  async addToLeaderboard(): Promise<void> {
    if (!this.playerName.trim()) {
      alert('Please enter your name!');
      return;
    }
    
    try {
      // Create new leaderboard entry
      const newEntry: QuizLeaderboardEntry = {
        name: this.playerName.trim(),
        score: this.score,
        quiz: this.currentQuiz!,
        date: new Date().toISOString(),
        eventName: this.eventName
      };
      
      // Add to Firebase
      await this.firebaseService.addQuizLeaderboardEntry(newEntry, this.eventName);
      
      // Refresh both leaderboards in the current view
      await this.loadBothLeaderboards();
      
      // Mark name as submitted and clear input
      this.nameSubmitted = true;
      this.playerName = '';
      
      // Trigger flash animation by adding/removing class
      // The leaderboard will update with real-time data and the new entry will flash
    } catch (error) {
      console.error('Error adding to leaderboard:', error);
      alert('Sorry, there was an error saving your score. Please try again.');
    }
  }

  async showLeaderboard(): Promise<void> {
    // Show modal immediately
    this.showResultsModal = false;
    this.showLeaderboardModal = true;
    this.isLoadingLeaderboards = true;
    
    try {
      // Subscribe to real-time updates
      this.subscribeToLeaderboards();
      
      // Load current quiz leaderboard from Firebase
      this.leaderboard = await this.firebaseService.getQuizLeaderboardEntries(this.currentQuiz!, this.eventName, 10);
      
      // Also load both leaderboards for the modal
      await this.loadBothLeaderboards();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Fallback to empty arrays if Firebase fails
      this.leaderboard = [];
      this.foodLeaderboard = [];
      this.snomedLeaderboard = [];
    } finally {
      this.isLoadingLeaderboards = false;
    }
  }

  hideLeaderboard(): void {
    this.showLeaderboardModal = false;
    
    // Unsubscribe from real-time updates when hiding leaderboard
    this.unsubscribeFromLeaderboards();
    
    this.resetQuiz();
  }

  cancelQuiz(): void {
    // Simple method to return to home without saving progress
    this.resetQuiz();
  }

  resetQuiz(): void {
    // Hide all modals
    this.showAnswersModal = false;
    this.showResultsModal = false;
    this.showLeaderboardModal = false;
    
    // Unsubscribe from real-time updates when resetting
    this.unsubscribeFromLeaderboards();
    
    // Show quiz selector
    this.showQuizSelector = true;
    
    // Hide quiz containers
    this.showFoodQuiz = false;
    this.showSnomedQuiz = false;
    
    // Reset state
    this.currentQuiz = null;
    this.currentQuestion = 0;
    this.score = 0;
    this.selectedAnswer = null;
    this.answers = [];
    this.playerName = '';
    this.nameSubmitted = false;
  }

  getLeaderboardTitle(): string {
    const quizName = this.currentQuiz === 'food' ? 'Global Food Quiz' : 'SNOMED CT International Quiz';
    return `🏆 ${quizName} Leaderboard`;
  }

  getRankDisplay(index: number): string {
    const rank = index + 1;
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  }

  getQuizIcon(quiz: string): string {
    return quiz === 'food' ? '🍽️' : '🏥';
  }

  canProceed(): boolean {
    return this.selectedAnswer !== null;
  }

  isLastQuestion(): boolean {
    return this.currentQuestion === 4;
  }

  getCurrentQuestion(): QuizQuestion {
    return this.quizData[this.currentQuiz!].questions[this.currentQuestion];
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // Keyboard support for accessibility
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.showResultsModal || this.showLeaderboardModal || this.showAnswersModal) {
      return;
    }
    
    if (event.key >= '1' && event.key <= '4') {
      const answerIndex = parseInt(event.key) - 1;
      if (this.currentQuiz && this.currentQuestion < 5) {
        this.selectAnswer(answerIndex);
      }
    }
  }
}