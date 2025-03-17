import { Component, Input } from '@angular/core';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
  selector: 'app-refset-viewer',
  templateUrl: './refset-viewer.component.html',
  styleUrl: './refset-viewer.component.css',
  standalone: false
})
export class RefsetViewerComponent {

  @Input() valuesetEcl: string = '';
  @Input() refsetEditionUri: string = '';

  refsetExpansion: any = null;

  constructor(private terminologyService: TerminologyService) { }




}
