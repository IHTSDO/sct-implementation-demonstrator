import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'elapsedTime',
    standalone: false
})
export class ElapsedTimePipe implements PipeTransform {

  transform(value: any, ...args: any[]): string {
    if (!value) return value;

    const seconds = Math.floor((value / 1000) % 60);
    const minutes = Math.floor((value / (1000 * 60)) % 60);
    const hours = Math.floor((value / (1000 * 60 * 60)) % 24);

    // Modify for minutes as well: no leading "0" if hours are not shown
    const minutesStr = (hours === 0 && minutes < 10) ? minutes.toString() : (minutes < 10 ? "0" + minutes : minutes);
    // Adjust secondsStr based on the new logic for minutes
    const secondsStr = (hours === 0 && minutes === 0 && seconds < 10) ? seconds.toString() : (seconds < 10 ? "0" + seconds : seconds);
    
    const hoursStr = (hours < 10) ? "0" + hours : hours;

    let result = "";
    if (hours > 0) {
      result += `${hoursStr}h `;
    }
    if (minutes > 0 || hours > 0) { // Only add minutes if they are greater than 0 or if hours are also being shown
      result += `${minutesStr}m `;
    }
    result += `${secondsStr}s`;

    return result;
  }
}
