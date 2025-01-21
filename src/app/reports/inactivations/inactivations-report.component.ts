import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-inactivations-report',
  templateUrl: './inactivations-report.component.html',
  styleUrl: './inactivations-report.component.css'
})
export class InactivationsReportComponent implements OnInit {

  loading = true;

  constructor(private http: HttpClient,
    private renderer: Renderer2,
    private elementRef: ElementRef) { }
  
  ngOnInit(): void {
      // Load the HTML file
      this.http.get('assets/reports/detect_inactivations_by_reason.html', { responseType: 'text' }).subscribe((html) => {
        this.loading = false;
        // Create a div element to hold the HTML
        const container = this.elementRef.nativeElement.querySelector('#chart-container');
        container.innerHTML = html;
  
        // Dynamically evaluate the scripts in the HTML
        const scripts = container.querySelectorAll('script');
        scripts.forEach((script: any) => {
          const newScript = this.renderer.createElement('script');
          newScript.type = script.type || 'text/javascript';
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.text = script.textContent || '';
          }
          this.renderer.appendChild(container, newScript);
        });
      });
    }
}
