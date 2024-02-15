// preload.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PreloadService {
  // Initialize the progress BehaviorSubject with 0
  public loadingProgress = new BehaviorSubject<number>(0);

  constructor() { }

  preloadImages(urls: string[]): Promise<void> {
    const promises = urls.map((url, index) => this.preloadImage(url, urls.length, index));
    return Promise.all(promises).then(() => {
      // Once all images are loaded, ensure progress is 100%
      this.loadingProgress.next(100);
    });
  }

  private preloadImage(url: string, totalImages: number, currentIndex: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        // Calculate and update progress on each image load
        const progress = ((currentIndex + 1) / totalImages) * 100;
        this.loadingProgress.next(progress);
        resolve();
      };
      img.onerror = reject;
    });
  }
}
