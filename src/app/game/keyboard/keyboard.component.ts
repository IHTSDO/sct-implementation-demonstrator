import { Component, EventEmitter, Output } from '@angular/core';

@Component({
    selector: 'app-keyboard',
    templateUrl: './keyboard.component.html',
    styleUrls: ['./keyboard.component.css'],
    standalone: false
})
export class KeyboardComponent {
  keyboardLayout = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  guessedLetters: { [key: string]: 'correct' | 'wrong' } = {};

  @Output() letterGuessed = new EventEmitter<string>();

  addGuessedLetter(letter: string, reslt: boolean) {
    this.guessedLetters[letter] = reslt ? 'correct' : 'wrong';
  }

  guessLetter(letter: string) {
    this.letterGuessed.emit(letter);
  }

  isLetterGuessed(letter: string): boolean {
    return letter in this.guessedLetters;
  }

  markLetterAsGuessed(letter: string, status: 'correct' | 'wrong') {
    this.guessedLetters[letter] = status;
  }

  reset() {
    this.guessedLetters = {};
  }
}
