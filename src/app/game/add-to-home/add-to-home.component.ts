import { Component, OnInit } from '@angular/core';
import { PlatformDetectionService } from 'src/app/services/platform-detection.service';

@Component({
  selector: 'app-add-to-home',
  templateUrl: './add-to-home.component.html',
  styleUrls: ['./add-to-home.component.css']
})
export class AddToHomeComponent implements OnInit {
  isIosSafari: boolean = false;
  tooltipDismissed: boolean = false;

  constructor(private platformDetectionService: PlatformDetectionService) {}

  ngOnInit() {
    this.isIosSafari = this.platformDetectionService.isIosSafari();
    this.tooltipDismissed = this.platformDetectionService.tooltipDismissed();
  }

  dismiss() {
    this.tooltipDismissed = true;
    this.platformDetectionService.dismissTooltip();
  }
}
