import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PlatformDetectionService {
  private readonly tooltipDismissedKey = 'iosSafariTooltipDismissed';

  constructor() {}

  isIosSafari(): boolean {
    return /iP(ad|od|hone)/i.test(window.navigator.userAgent) &&
           /Safari/i.test(window.navigator.userAgent) &&
           !/CriOS/i.test(window.navigator.userAgent) &&
           !/FxiOS/i.test(window.navigator.userAgent);
  }

  tooltipDismissed(): boolean {
    return localStorage.getItem(this.tooltipDismissedKey) === 'true';
  }

  dismissTooltip(): void {
    localStorage.setItem(this.tooltipDismissedKey, 'true');
  }

  isRunningStandalone(): boolean {
    return ('standalone' in window.navigator) && ((window.navigator as any)['standalone']);
  }
  
}
