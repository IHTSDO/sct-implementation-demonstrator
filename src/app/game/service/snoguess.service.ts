import { EventEmitter, Injectable, Output } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';

export interface Game {
  term: string; // The actual SNOMED CT term (FSN)
  displayTerm: string[]; // Representation of the term for display
  hitPoints: number; // Number of attempts left
  hints: string[]; // Hints that have been revealed
  hintsAvailable: boolean; // Whether hints are available
  state: 'playing' | 'gameOver' | 'choosingTerm' | 'won' | 'menu'; // Game state
  score: number; // Score of the game
  round: number; // Round of the game
  difficultyLevel: string; // Difficulty level of the game
  rules: any; // Rules and settings for the game
  startTimestamp: number; // Timestamp when the game started
  endTimestamp: number; // Timestamp when the game ended
  difficultyBonus: number; // Bonus points for difficulty level
  livesBonus: number; // Bonus points for remaining lives
  timeBonus: number; // Bonus points for time remaining
  maxRoundTime: number; // Time to guess the term
  remainingTime: number; // Remaining time in seconds
}

interface SnomedConcept {
  code: string;
  display: string;
}

@Injectable({
  providedIn: 'root'
})
export class SnoguessService {

  private game: BehaviorSubject<Game>;

  private roundTimer: any; // For storing the interval ID

  goals: any[] = [
    { name: 'Bronze', score: 100 },
    { name: 'Silver', score: 200 },
    { name: 'Gold', score: 300 },
    { name: 'Platinum', score: 400 },
    { name: 'Diamond', score: 500 }
  ];

  difficultyLevels: any[] = [
    // { 
    //   name: 'Tournament', 
    //   rules: { maxHitPoints: 3, hitpointsAwardedForGuessingfullTerm: 1, freeHints: 1, pointsPerGuessedLetter: 2, goals: this.goals, difficultyBonus: 50, endless: true, maxRoundTime: 25 }
    // },
    { 
      name: 'Easy',
      rules: { maxHitPoints: 5, hitpointsAwardedForGuessingfullTerm: 1, freeHints: 2, pointsPerGuessedLetter: 1, goals: this.goals, difficultyBonus: 0, endless: false, maxRoundTime: 60 }
    },
    { 
      name: 'Medium', 
      rules: { maxHitPoints: 4, hitpointsAwardedForGuessingfullTerm: 1, freeHints: 1, pointsPerGuessedLetter: 2, goals: this.goals, difficultyBonus: 50, endless: false, maxRoundTime: 50 }
    },
    { 
      name: 'Hard', 
      rules: { maxHitPoints: 3, hitpointsAwardedForGuessingfullTerm: 1, freeHints: 0, pointsPerGuessedLetter: 3, goals: this.goals, difficultyBonus: 100, endless: false, maxRoundTime: 40 }
    },
    { 
      name: 'Endless', 
      rules: { maxHitPoints: 3, hitpointsAwardedForGuessingfullTerm: 1, freeHints: 0, pointsPerGuessedLetter: 3, goals: this.goals, difficultyBonus: 100, endless: true, maxRoundTime: 30 }
    }
  ];

  // Rules and settings for the game
  rules = this.difficultyLevels[0].rules;

  fsn: string = '';
  scg: string = '';
  focusConcepts: SnomedConcept[] = [];
  attributePairs: { type: SnomedConcept, target: SnomedConcept }[] = [];

  usedHints: Set<string> = new Set();

  randomLimit: number = 4000;

  @Output() guessResult: EventEmitter<any> = new EventEmitter();
  @Output() termResult: EventEmitter<string> = new EventEmitter();

  constructor(private terminologyService: TerminologyService) {
    // Initialize the game with default values
    this.game = new BehaviorSubject<Game>(this.initialize());
  }

  loadMenu() {
    this.clearRoundTimer(); // Clear timer when loading menu
    this.game.next({ ...this.game.value, state: 'menu' });
  }

  getDifficultyLevels() {
    return this.difficultyLevels;
  }

  async newRound(reset?: boolean) {
    // Clear existing timer
    this.clearRoundTimer();

    // Set state to 'choosingTerm' and reset necessary properties
    this.game.next({ 
      ...this.game.value, 
      state: 'choosingTerm', 
      score: reset ? 0 : this.game.value.score, 
      hitPoints: reset ? this.rules.maxHitPoints : this.game.value.hitPoints, 
      round: reset ? 1 : this.game.value.round + 1,
      remainingTime: this.rules.maxRoundTime // Ensure remainingTime is at max
    });

    // Fetch a new term asynchronously
    const randomIndex = Math.floor(Math.random() * this.randomLimit) + 1;
    const response = await lastValueFrom(
      this.terminologyService.expandValueSetFromServer(
        this.terminologyService.getSnowstormFhirBase(), 
        'http://snomed.info/sct/705115006', 
        '^ 816080008 |International Patient Summary| {{ C definitionStatus = defined }}', 
        '', randomIndex, 1)
    );
    this.randomLimit = response.expansion.total - 1;
    const fullConcept: any = await lastValueFrom(
      this.terminologyService.lookupConcept(response.expansion.contains[0].code)
    );
    let fsn = this.extractFSN(fullConcept);
    this.fsn = fsn ? fsn : '';
    let scg = this.extractScg(fullConcept);
    this.scg = scg ? scg : '';
    let focusConcepts = this.extractFocusConcepts(scg ? scg : '');
    this.focusConcepts = focusConcepts ? focusConcepts : [];
    let attributePairs = this.extractAttributePairs(scg ? scg : '');
    this.attributePairs = attributePairs ? attributePairs : [];

    if (fsn) {
      this.initializeRound(fsn, reset);
    } else {
      this.initializeRound('No term found');
    }

    this.usedHints.clear();
  }

  extractFSN(data: any): string | undefined {
    let term = this.extractTerm(data, '900000000000003001', this.terminologyService.getLang());
    if (!term) {
      term = this.extractTerm(data, '900000000000013009', this.terminologyService.getLang());
    }
    if (!term) {
      term = this.extractTerm(data, '900000000000003001', 'en');
    }
    return term;
  }

  extractTerm(data: any, typeId: string, lang: string): string {
    let term: string = '';
    data.parameter.forEach((parameter: any) => {
      if (parameter.name === 'designation') {
        let isFsn = parameter.part.some((part: any) => part.name === 'use' && part.valueCoding.code === typeId);
        let isLang = parameter.part.some((part: any) => part.name === 'language' && part.valueCode === lang);
        if (isFsn && isLang) {
          term = parameter.part.find((part: any) => part.name === 'value')?.valueString;
        }
      }
    });
    return term;
  }

  extractScg(data: any): string | undefined {
    let scg: string | undefined;
    data.parameter.forEach((parameter: any) => {
      if (parameter.name === 'property') {
        if (parameter.part.some((part: any) => part.name === 'code' && part.valueString === 'normalForm')) {
          scg = parameter.part.find((part: any) => part.name === 'valueString')?.valueString;
        }
      }
    });
    return scg;
  }

  extractFocusConcepts(scg: string): SnomedConcept[] {
    const [focusPart] = scg.split(':').map(part => part.trim());
    const regex = /\d+\|.*?\|/g;
    const matches = focusPart.match(regex);

    const concepts: SnomedConcept[] = matches ? matches.map(match => {
      const concept = this.transformSnomedConcept(match.trim());
      return concept ? concept : { code: "", display: "" };
    }).filter(concept => concept.code !== "") : [];

    return concepts;
  }

  extractAttributePairs(scg: string): { type: SnomedConcept, target: SnomedConcept }[] {
    const partsAfterColon = scg.split(':').slice(1).join(':').trim();
    const regex = /(\d+\|.*?\|)\s*=\s*(\d+\|.*?\|)/g;
    let matches;
    const attributes: { type: SnomedConcept, target: SnomedConcept }[] = [];

    while ((matches = regex.exec(partsAfterColon)) !== null) {
      const type = this.transformSnomedConcept(matches[1].trim());
      const target = this.transformSnomedConcept(matches[2].trim());

      if (type && target) {
        attributes.push({ type, target });
      }
    }

    return attributes;
  }

  transformSnomedConcept(concept: string): SnomedConcept | null {
    const regex = /^(\d+)\|(.+?)\|$/;
    const match = concept.match(regex);

    if (match) {
      return {
        code: match[1],
        display: match[2]
      };
    } else {
      return null;
    }
  }

  // Resets and initializes the game state
  private initialize(): Game {
    return {
      term: '',
      displayTerm: [],
      hitPoints: this.rules.maxHitPoints,
      hintsAvailable: true,
      hints: [],
      state: 'menu',
      score: 0,
      round: 0,
      rules: this.rules,
      difficultyLevel: '',
      startTimestamp: 0,
      endTimestamp: 0,
      difficultyBonus: 0,
      livesBonus: 0,
      timeBonus: 0,
      maxRoundTime: 0,
      remainingTime: 0
    };
  }

  startGame(difficulty: string) {
    this.clearRoundTimer(); // Clear timer when starting a new game
    this.rules = this.difficultyLevels.find(level => level.name.toLowerCase() === difficulty.toLowerCase())?.rules;
    this.game.next({ 
      term: '',
      displayTerm: [],
      hitPoints: this.rules.maxHitPoints,
      hintsAvailable: true,
      hints: [],
      state: 'playing',
      score: 0,
      round: 0,
      rules: this.rules,
      difficultyLevel: difficulty,
      startTimestamp: Date.now(),
      endTimestamp: 0,
      difficultyBonus: 0,
      livesBonus: 0,
      timeBonus: 0,
      maxRoundTime: this.rules.maxRoundTime,
      remainingTime: this.rules.maxRoundTime
     });
    this.newRound(true);
  }

  // Initializes or restarts the game with a new term
  initializeRound(term: string, reset?: boolean): void {
    // Use a regular expression to find the semantic tag, which is the last set of parentheses
    const semanticTagMatch = term.match(/\(([^)]+)\)$/);
    const semanticTag = semanticTagMatch ? semanticTagMatch[0] : '';
    
    // Calculate the starting index of the semantic tag, or set it to the term's length if not found
    const semanticTagIndex = semanticTag ? term.lastIndexOf(semanticTag) : term.length;
    
    // Replace letters and numbers outside the semantic tag with underscores, keep other characters unchanged
    const displayTermArray: string[] = term.split('').map((char, index) => {
      if (index >= semanticTagIndex) {
        return char; // Keep the semantic tag visible
      }
      // Use a regular expression to test if the character is a letter or a number
      return /[a-zA-Z0-9á-úñ]/.test(char) ? '_' : char;
    });
    
    this.game.next({
      ...this.game.value,
      term: term,
      displayTerm: displayTermArray,
      hitPoints: reset ? this.rules.maxHitPoints : this.game.value.hitPoints,
      hints: [],
      state: 'playing',
      score: reset ? 0 : this.game.value.score,
      remainingTime: this.rules.maxRoundTime // Initialize remainingTime when term is set
    });

    // Start the timer after the term is selected and state is 'playing'
    this.startRoundTimer();

    for (let i = 0; i < this.rules.freeHints; i++) {
      this.revealHint(true);
    }
  }
  
  removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  // Guess a single letter
  guessLetter(letter: string): void {
    let newState = { ...this.game.value };
    let found = false;
  
    // Determine the index where the semantic tag begins
    const semanticTagIndex = newState.term.lastIndexOf('(');
    const effectiveLength = semanticTagIndex !== -1 ? semanticTagIndex : newState.term.length;

    newState.term.split('').forEach((char, index) => {
      // Check if the index is within the effective length (either before the semantic tag or the entire term)
      // and if the character at that position has not been guessed yet
      if (index < effectiveLength && newState.displayTerm[index] === '_') {
        // Compare normalized versions of the characters
        if (this.removeAccents(char.toLowerCase()) === this.removeAccents(letter.toLowerCase())) {
          newState.displayTerm[index] = char; // Reveal the correctly guessed letter
          found = true;
          newState.score += this.rules.pointsPerGuessedLetter; // Increment the score
        }
      }
    });
  
    if (!found) {
      this.guessResult.emit({ letter: letter, result: false }); // Emit false for incorrect guesses
      newState.hitPoints -= 1;
      // Check if the game is lost
      if (newState.hitPoints <= 0) {
        newState.hitPoints = 0; // Ensure hit points don't go negative
        newState.state = 'gameOver'; // Update the state to 'gameOver'
        newState.endTimestamp = Date.now();
        newState.difficultyBonus = this.rules.difficultyBonus;
        newState.score += newState.difficultyBonus;
        this.clearRoundTimer(); // Clear the timer when game is over
      }
    } else {
      this.guessResult.emit({ letter: letter, result: true });
      // Check if the term was guessed by verifying if there are no more '_' characters before the semantic tag
      const isTermGuessed = newState.displayTerm.slice(0, effectiveLength).indexOf('_') === -1;
      if (isTermGuessed && newState.state === 'playing') {
        this.termResult.emit(newState.term); // Emit the term when correctly guessed
        this.clearRoundTimer(); // Stop the timer when term is guessed

        // Check if the game is won
        if (newState.score > this.goals[this.goals.length - 1].score && this.rules.endless === false) {
          newState.state = 'won'; // Update the state to 'won'
          newState.endTimestamp = Date.now();
          // Add bonuses to the score
          newState.difficultyBonus = this.rules.difficultyBonus;
          newState.livesBonus = newState.hitPoints * 10;
          const elapsedTime = Math.round((newState.endTimestamp - newState.startTimestamp) / 1000);
          newState.timeBonus = Math.max(0, 180 - elapsedTime);
          newState.score += newState.difficultyBonus + newState.livesBonus + newState.timeBonus;
        } else {
          newState.hitPoints = newState.hitPoints + this.rules.hitpointsAwardedForGuessingfullTerm; // Add hit points for winning
          if (newState.hitPoints > this.rules.maxHitPoints) {
            newState.hitPoints = this.rules.maxHitPoints;
          }
          setTimeout(() => {
            this.newRound();
          }, 1500);
        }
      }
    }
  
    this.game.next(newState);
  }

  // Reveal a hint
  revealHint(isFree?: boolean): void {
    let newState = { ...this.game.value };
    let newHint = '';

    // Check if there are hints available
    if (this.focusConcepts.length === 0 && this.attributePairs.length === 0) {
        newState.hints.push("No more hints available.");
        this.game.next(newState);
        return;
    }

    let useFocusConcepts = this.focusConcepts.length > 0;
    let useAttributePairs = this.attributePairs.length > 0;

    // Use the coin flip logic only if both types of hints are available
    if (useFocusConcepts && useAttributePairs) {
        let coin = Math.random();
        useFocusConcepts = coin < 0.5;
    }

    if (useFocusConcepts) {
        let randomIndex = Math.floor(Math.random() * this.focusConcepts.length);
        let selectedConcept = this.focusConcepts[randomIndex];
        newHint = `One of the parents of this concept is: <i>${selectedConcept.display}</i>`;
        // Remove used hint to avoid repetition
        this.focusConcepts.splice(randomIndex, 1);
    } else if (useAttributePairs) {
        let randomIndex = Math.floor(Math.random() * this.attributePairs.length);
        let selectedPair = this.attributePairs[randomIndex];
        newHint = `This concept has a <i>${selectedPair.type.display}</i> of <i>${selectedPair.target.display}</i>`;
        // Remove used hint to avoid repetition
        this.attributePairs.splice(randomIndex, 1);
    }

    // Update the game state with the new hint and decrement hit points
    this.usedHints.add(newHint); // Track used hint
    newState.hints.push(newHint);
    if (!isFree) {
      newState.hitPoints -= 1;
    }
    newState.hintsAvailable = this.focusConcepts.length > 0 || this.attributePairs.length > 0;
    this.game.next(newState);

    // Check for loss condition
    if (newState.hitPoints <= 0) {
        newState.hitPoints = 0;
        newState.state = 'gameOver';
        newState.endTimestamp = Date.now();
        this.clearRoundTimer(); // Clear the timer when game is over
        this.game.next(newState);
    }
  }

  // Get the current state as an Observable for subscription in components
  getGameState() {
    return this.game.asObservable();
  }

  // Start the round timer
  private startRoundTimer() {
    this.roundTimer = setInterval(() => {
      const currentGameState = this.game.value;
      const newRemainingTime = currentGameState.remainingTime - 1;
      const newGameState = { ...currentGameState, remainingTime: newRemainingTime };
      if (newRemainingTime <= 0) {
        // Time is up, end the game
        newGameState.remainingTime = 0;
        newGameState.state = 'gameOver';
        newGameState.endTimestamp = Date.now();
        this.clearRoundTimer();
        this.game.next(newGameState);
      } else {
        this.game.next(newGameState);
      }
    }, 1000);
  }

  // Clear the round timer
  private clearRoundTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
}
