import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, Renderer2 } from '@angular/core';

@Component({
    selector: 'app-new-concepts-report',
    templateUrl: './new-concepts-report.component.html',
    styleUrl: './new-concepts-report.component.css',
    standalone: false
})
export class NewConceptsReportComponent implements OnInit {

  loading = true;

  constructor(private http: HttpClient,
    private renderer: Renderer2,
    private elementRef: ElementRef) { }
  
  ngOnInit(): void {
      // Load the HTML file
      this.http.get('assets/reports/new_concepts_by_semantic_tag.html', { responseType: 'text' }).subscribe((html) => {
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
