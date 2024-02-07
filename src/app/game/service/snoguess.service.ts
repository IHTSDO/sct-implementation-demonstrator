import { EventEmitter, Injectable, Output } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';

export interface Game {
  term: string; // The actual SNOMED CT term (FSN)
  displayTerm: string[]; // Representation of the term for display
  maxHitPoints: number; // Maximum number of attempts
  hitPoints: number; // Number of attempts left
  hints: string[]; // Hints that have been revealed
  state: 'playing' | 'won' | 'lost' | 'loading'; // Game state
}

@Injectable({
  providedIn: 'root'
})
export class SnoguessService {

  private game: BehaviorSubject<Game>;

  maxHitPoints: number = 5;

  @Output() guessResult: EventEmitter<boolean> = new EventEmitter();


  constructor(private terminologyService: TerminologyService) {
    // Initialize the game with default values
    this.game = new BehaviorSubject<Game>(this.resetGame());
  }

  async getRandomConcept() {
    this.game.next({ ...this.game.value, state: 'loading' });
    // generate a random number between 1 and 4000
    const randomIndex = Math.floor(Math.random() * 4000) + 1;
    const response = await lastValueFrom(
      this.terminologyService.expandValueSet('^ 816080008 |International Patient Summary| {{ C definitionStatus = defined }}', '', randomIndex, 1)
    );
    const fullConcept: any = await lastValueFrom(
      this.terminologyService.lookupConcept(response.expansion.contains[0].code)
    );
    console.log(this.extractFSN(fullConcept))
    let fsn = this.extractFSN(fullConcept);

    if (fsn) {
      this.initializeGame(fsn);
    } else {
      this.initializeGame('No term found');
    }
    this.game.next({ ...this.game.value, state: 'playing' });
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

  // Resets and initializes the game state
  private resetGame(): Game {
    return {
      term: '', // This should be set to a randomly selected SNOMED CT term
      displayTerm: [],
      maxHitPoints: this.maxHitPoints,
      hitPoints: this.maxHitPoints,
      hints: [],
      state: 'playing'
    };
  }

  // Initializes or restarts the game with a new term
  initializeGame(term: string): void {
    // Use a regular expression to find the semantic tag, which is the last set of parentheses
    const semanticTagMatch = term.match(/\(.*\)$/);
    const semanticTag = semanticTagMatch ? semanticTagMatch[0] : '';
  
    // Calculate the starting index of the semantic tag, or set it to the term's length if not found
    const semanticTagIndex = semanticTag ? term.indexOf(semanticTag) : term.length;
  
    // Replace all characters except the semantic tag with underscores
    const displayTerm = term.split('').map((char, index) => {
      if (index >= semanticTagIndex) {
        return char; // Keep the semantic tag visible
      }
      return char === ' ' ? ' ' : '_'; // Replace other characters with underscores
    });
  
    this.game.next({
      ...this.game.value,
      term: term,
      displayTerm: displayTerm,
      maxHitPoints: this.maxHitPoints,
      hitPoints: 5,
      hints: [],
      state: 'playing'
    });
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
        }
      }
    });
  
    if (!found) {
      this.guessResult.emit(false); // Emit false for incorrect guesses
      newState.hitPoints -= 1;
      // Check if the game is lost
      if (newState.hitPoints <= 0) {
        newState.hitPoints = 0; // Ensure hit points don't go negative
        newState.state = 'lost'; // Update the state to 'lost'
      }
    } else {
      // Check if the game is won by verifying if there are no more '_' characters before the semantic tag
      const isGameWon = newState.displayTerm.slice(0, semanticTagIndex).indexOf('_') === -1;
      if (isGameWon) {
        newState.state = 'won'; // Update the state to 'won'
      }
    }
  
    this.game.next(newState);
  }
  
  

  // Guess the full term
  guessTerm(guess: string): boolean {
    if (guess.toLowerCase() === this.game.value.term.toLowerCase()) {
      this.game.next({ ...this.game.value, displayTerm: this.game.value.term.split(''), state: 'won' });
      return true;
    } else {
      this.game.next({ ...this.game.value, hitPoints: this.game.value.hitPoints - 1 });
      if (this.game.value.hitPoints <= 0) {
        this.game.next({ ...this.game.value, hitPoints: 0, state: 'lost' });
      }
      return false;
    }
  }

  // Reveal a hint
  revealHint(newHint: string): void {
    let newState = { ...this.game.value };
    newState.hints.push(newHint);
    newState.hitPoints -= 1;
    this.game.next(newState);
    if (this.game.value.hitPoints <= 0) {
      this.game.next({ ...this.game.value, hitPoints: 0, state: 'lost' });
    }
  }

  // Get the current state as an Observable for subscription in components
  getGameState() {
    return this.game.asObservable();
  }
}
