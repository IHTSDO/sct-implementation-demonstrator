import { EventEmitter, Injectable, Output } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';

export interface Game {
  term: string; // The actual SNOMED CT term (FSN)
  displayTerm: string[]; // Representation of the term for display
  maxHitPoints: number; // Maximum number of attempts
  hitPoints: number; // Number of attempts left
  hints: string[]; // Hints that have been revealed
  hintsAvailable: boolean; // Whether hints are available
  state: 'playing' | 'gameOver' | 'choosingTerm' | 'won' | 'menu'; // Game state,
  score: number; // Score of the game
  round: number; // Round of the game
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

  // Rules and settings for the game
  maxHitPoints: number = 5;
  hitpointsAwardedForGuessingfullTerm: number = 1;
  revealFirstHintFree: boolean = false;
  pointsPerGuessedLetter: number = 1;

  goals: any[] = [
    { name: 'Bronze', score: 100 },
    { name: 'Silver', score: 200 },
    { name: 'Gold', score: 300 },
    { name: 'Platinum', score: 400 },
    { name: 'Diamond', score: 500 }
  ];

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
    this.game = new BehaviorSubject<Game>(this.resetGame());
  }

  loadMenu() {
    this.game.next({ ...this.game.value, state: 'menu' });
  }

  async getRandomConcept(reset?: boolean) {
    // Do nothing if game state is not playing
    this.game.next({ ...this.game.value, 
      state: 'choosingTerm', 
      score: reset ? 0 : this.game.value.score, 
      hitPoints: reset ? this.maxHitPoints : this.game.value.hitPoints, 
      round: reset ? 1 : this.game.value.round + 1
    });
    const randomIndex = Math.floor(Math.random() * this.randomLimit) + 1;
    const response = await lastValueFrom(
      this.terminologyService.expandValueSet('^ 816080008 |International Patient Summary| {{ C definitionStatus = defined }}', '', randomIndex, 1)
    );
    this.randomLimit = response.expansion.total -1;
    const fullConcept: any = await lastValueFrom(
      this.terminologyService.lookupConcept(response.expansion.contains[0].code)
    );
    let fsn = this.extractFSN(fullConcept);
    this.fsn = fsn? fsn : '';
    let scg = this.extractScg(fullConcept);
    this.scg = scg? scg : '';
    let focusConcepts = this.extractFocusConcepts(scg? scg : '');
    this.focusConcepts = focusConcepts? focusConcepts : [];
    let attributePairs = this.extractAttributePairs(scg? scg : '');
    this.attributePairs = attributePairs? attributePairs : [];
    if (fsn) {
      this.initializeGame(fsn, reset);
    } else {
      this.initializeGame('No term found');
    }
    this.game.next({ ...this.game.value, state: 'playing' });
    this.usedHints.clear();
  }

  extractFSN(data: any): string | undefined {
    let fsn: string | undefined;
    data.parameter.forEach((parameter: any) => {
      if (parameter.name === 'designation') {
        parameter.part.forEach((part: any) => {
          if (part.name === 'value' && part.valueString.endsWith(')')) {
            // if the part is the value and ends in ), return the valueString
            fsn = part.valueString;
          }
        });
      }
    });
    return fsn;
  }

  extractScg(data: any): string | undefined {
    let scg: string | undefined;
    data.parameter.forEach((parameter: any) => {
      if (parameter.name === 'property') {
        // and has some part that is a "valueString": "normalForm"
        if (parameter.part.some((part: any) => part.name === 'code' && part.valueString === 'normalForm')) {
          // then find the part that is a "valueString" and return it
          scg = parameter.part.find((part: any) => part.name === 'valueString')?.valueString;
        }
      }
    });
    return scg;
  }

  extractFocusConcepts(scg: string): SnomedConcept[] {
    // Extract the part of the SCG before the first colon (if it exists)
    const [focusPart] = scg.split(':').map(part => part.trim());
    // Use a regex to match all SNOMED CT concept patterns in the focus part
    const regex = /\d+\|.*?\|/g; // Adjusted to match any character inside the description
    const matches = focusPart.match(regex);
    
    // Transform each match into a SnomedConcept object
    const concepts: SnomedConcept[] = matches ? matches.map(match => {
      const concept = this.transformSnomedConcept(match.trim());
      // Return a dummy object if transformation fails, which should not happen if regex is correct
      return concept ? concept : { code: "", display: "" };
    }).filter(concept => concept.code !== "") : []; // Filter out any dummy objects
    
    return concepts;
  }

  extractAttributePairs(scg: string): { type: SnomedConcept, target: SnomedConcept }[] {
    const partsAfterColon = scg.split(':').slice(1).join(':').trim();
    // Use a regex to match patterns of the form "123456|Description| = 123457|Description2|"
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
  private resetGame(): Game {
    return {
      term: '', // This should be set to a randomly selected SNOMED CT term
      displayTerm: [],
      maxHitPoints: this.maxHitPoints,
      hitPoints: this.maxHitPoints,
      hintsAvailable: true,
      hints: [],
      state: 'playing',
      score: 0,
      round: 0
    };
  }

  // Initializes or restarts the game with a new term
  initializeGame(term: string, reset?: boolean): void {
    // Use a regular expression to find the semantic tag, which is the last set of parentheses
    const semanticTagMatch = term.match(/\(.*\)$/);
    const semanticTag = semanticTagMatch ? semanticTagMatch[0] : '';
    
    // Calculate the starting index of the semantic tag, or set it to the term's length if not found
    const semanticTagIndex = semanticTag ? term.indexOf(semanticTag) : term.length;
    
    // Replace letters and numbers outside the semantic tag with underscores, keep other characters unchanged
    const displayTerm = term.split('').map((char, index) => {
      if (index >= semanticTagIndex) {
        return char; // Keep the semantic tag visible
      }
      // Use a regular expression to test if the character is a letter or a number
      return /[a-zA-Z0-9]/.test(char) ? '_' : char;
    });
    
    this.game.next({
      ...this.game.value,
      term: term,
      displayTerm: displayTerm,
      maxHitPoints: this.maxHitPoints,
      hitPoints: reset ? this.maxHitPoints : this.game.value.hitPoints,
      hints: [],
      state: 'playing',
      score: reset ? 0 : this.game.value.score
    });

    if (this.revealFirstHintFree) {
      this.revealHint(true);
    }
  }
  
  

  // Guess a single letter
  guessLetter(letter: string): void {
    let newState = { ...this.game.value };
    let found = false;
  
    // Determine the index where the semantic tag begins
    const semanticTagIndex = newState.term.lastIndexOf('(');
  
    newState.term.split('').forEach((char, index) => {
      // Check if the index is within the range before the semantic tag
      // and if the character at that position has not been guessed yet
      if (index < semanticTagIndex && newState.displayTerm[index] === '_') {
        if (char.toLowerCase() === letter.toLowerCase()) {
          newState.displayTerm[index] = char; // Reveal the correctly guessed letter
          found = true;
          newState.score += this.pointsPerGuessedLetter; // Increment the score
          // check if won, score >= max goal score, but waiting until there are no more _ before semantic tag
          const isTermGessed = newState.displayTerm.slice(0, semanticTagIndex).indexOf('_') === -1;
          if (isTermGessed && newState.score >= this.goals[this.goals.length - 1].score) {
            newState.state = 'won';
          }
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
      }
    } else {
      this.guessResult.emit({ letter: letter, result: true });
      // Check if the term was guessed by verifying if there are no more '_' characters before the semantic tag
      const isTermGessed = newState.displayTerm.slice(0, semanticTagIndex).indexOf('_') === -1;
      if (isTermGessed && newState.state === 'playing') {
        this.termResult.emit(newState.term); // Emit true for correct term guesses
        newState.hitPoints = newState.hitPoints + this.hitpointsAwardedForGuessingfullTerm; // Add a hit points for winning
        if (newState.hitPoints > this.maxHitPoints) {
          newState.hitPoints = this.maxHitPoints;
        }
        setTimeout(() => {
          this.getRandomConcept();
        }, 1500);
      }
    }
  
    this.game.next(newState);
  }
  
  

  // Guess the full term
  guessTerm(guess: string): boolean {
    if (guess.toLowerCase() === this.game.value.term.toLowerCase()) {
      this.termResult.emit(guess); // Emit true for correct term guesses
      this.game.next({ ...this.game.value, displayTerm: this.game.value.term.split('') });
      return true;
    } else {
      this.game.next({ ...this.game.value, hitPoints: this.game.value.hitPoints - 1 });
      if (this.game.value.hitPoints <= 0) {
        this.game.next({ ...this.game.value, hitPoints: 0, state: 'gameOver' });
      }
      return false;
    }
  }

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
        newHint = `One of the focus concepts is: <i>${selectedConcept.display}</i>`;
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
        this.game.next(newState);
    }
  }


  // Get the current state as an Observable for subscription in components
  getGameState() {
    return this.game.asObservable();
  }
}
