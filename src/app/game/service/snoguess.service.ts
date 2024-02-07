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

interface SnomedConcept {
  code: string;
  display: string;
}

@Injectable({
  providedIn: 'root'
})
export class SnoguessService {

  private game: BehaviorSubject<Game>;

  maxHitPoints: number = 5;

  fsn: string = '';
  scg: string = '';
  focusConcepts: SnomedConcept[] = [];
  attributePairs: { type: SnomedConcept, target: SnomedConcept }[] = [];

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
    let fsn = this.extractFSN(fullConcept);
    this.fsn = fsn? fsn : '';
    console.log(fsn) 
    let scg = this.extractScg(fullConcept);
    this.scg = scg? scg : '';
    let focusConcepts = this.extractFocusConcepts(scg? scg : '');
    this.focusConcepts = focusConcepts? focusConcepts : [];
    let attributePairs = this.extractAttributePairs(scg? scg : '');
    this.attributePairs = attributePairs? attributePairs : [];
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
  revealHint(): void {
    let newHint = '';
    // throw a coin to decide if it is oging to generate a hint from the focus concepts or the attribute pairs
    let coin = Math.random();
    if (coin < 0.5) {
      // choose a random concept from the focus concepts
      let randomFocusConceptIndex = Math.floor(Math.random() * this.focusConcepts.length);
      newHint = `One of the parent concepts is: ${this.focusConcepts[randomFocusConceptIndex].display}`;
    } else {
      // choose a random attribute pair
      let randomAttributePairIndex = Math.floor(Math.random() * this.attributePairs.length);
      let randomAttributePair = this.attributePairs[randomAttributePairIndex];
      newHint = `This concept ${randomAttributePair.type.display} of ${randomAttributePair.target.display}`;
    }

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
