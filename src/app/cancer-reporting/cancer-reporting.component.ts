import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatTabGroup } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';

declare var LForms: any;
import { LformsService } from '../services/lforms.service';
import { ResponseDialogComponent } from './response-dialog/response-dialog.component';

interface SnomedEntry {
  type: 'question' | 'answer';
  text: string;
  code: string;
  display: string;
}

interface CancerQuestionnaire {
  filename: string;
  title: string;
  description: string;
  iconCategory: string;
  iconName: string;
  color: string;
}

const QUESTIONNAIRES: CancerQuestionnaire[] = [
  { filename: 'Breast-Cancer.R5_20250611.json',       title: 'Breast Cancer',       description: 'Synoptic reporting form example for breast cancer',       iconCategory: 'body',       iconName: 'breasts',               color: '#e91e63' },
  { filename: 'Colorectal-Cancers.R5_20250611.json',  title: 'Colorectal Cancers',  description: 'Synoptic reporting form example for colorectal cancers',  iconCategory: 'conditions', iconName: 'colorectal-cancer',     color: '#8bc34a' },
  { filename: 'Esophagus-cancer.R5_20250611.json',    title: 'Esophagus Cancer',    description: 'Synoptic reporting form example for esophagus cancer',    iconCategory: 'conditions', iconName: 'oesophagus-cancer',     color: '#ff9800' },
  { filename: 'Lung-cancer.R5_20250611.json',         title: 'Lung Cancer',         description: 'Synoptic reporting form example for lung cancer',         iconCategory: 'body',       iconName: 'lungs',                 color: '#03a9f4' },
  { filename: 'Melanoma.R5_20250611.json',            title: 'Melanoma',            description: 'Synoptic reporting form example for melanoma',            iconCategory: 'conditions', iconName: 'skin-cancer',           color: '#795548' },
  { filename: 'Pancreas-Cancer.R5_20250611.json',     title: 'Pancreas Cancer',     description: 'Synoptic reporting form example for pancreas cancer',     iconCategory: 'conditions', iconName: 'pancreatic-cancer',     color: '#9c27b0' },
  { filename: 'Stomach-cancer.R5_20250611.json',      title: 'Stomach Cancer',      description: 'Synoptic reporting form example for stomach cancer',      iconCategory: 'conditions', iconName: 'stomach-cancer',        color: '#f44336' },
  { filename: 'Testis_-Orchiectomy.R5_20250611.json', title: 'Testis: Orchiectomy', description: 'Synoptic reporting form example for testis orchiectomy',  iconCategory: 'body',       iconName: 'testicles',             color: '#2196f3' },
];

@Component({
  selector: 'app-cancer-reporting',
  templateUrl: './cancer-reporting.component.html',
  styleUrls: ['./cancer-reporting.component.css'],
  standalone: false
})
export class CancerReportingComponent implements OnInit {
  questionnaires = QUESTIONNAIRES;
  selected: CancerQuestionnaire | null = null;
  questionnaire: any = null;
  loading = false;
  codingDataSource = new MatTableDataSource<SnomedEntry>([]);
  codingColumns = ['type', 'text', 'code'];

  @ViewChild('codingPaginator') set codingPaginator(p: MatPaginator) {
    if (p) this.codingDataSource.paginator = p;
  }
  @ViewChild('previewTabs') previewTabs!: MatTabGroup;

  constructor(private http: HttpClient, private lformsService: LformsService, private dialog: MatDialog) {}

  ngOnInit() {
    this.lformsService.preloadCore();
  }

  async preview(q: CancerQuestionnaire) {
    this.selected = q;
    this.loading = true;
    this.questionnaire = null;
    this.codingDataSource.data = [];

    const data = await lastValueFrom(this.http.get(`assets/cancer/${q.filename}`));

    this.loading = false;
    this.questionnaire = data;

    setTimeout(() => {
      this.lformsService.renderQuestionnaire(this.questionnaire, 'cancerFormContainer');
    }, 50);
  }

  onTabChange(index: number) {
    if (index === 0) {
      setTimeout(() => {
        this.lformsService.renderQuestionnaire(this.questionnaire, 'cancerFormContainer');
      }, 50);
    } else if (index === 1 && this.codingDataSource.data.length === 0) {
      this.codingDataSource.data = this.extractSnomedEntries(this.questionnaire);
    }
  }

  private extractSnomedEntries(questionnaire: any): SnomedEntry[] {
    const entries: SnomedEntry[] = [];
    const traverse = (items: any[]) => {
      for (const item of items ?? []) {
        const qCode = (item.code ?? []).find((c: any) => c.system?.includes('snomed.info/sct'));
        if (qCode) {
          entries.push({ type: 'question', text: item.text ?? '', code: qCode.code, display: qCode.display });
          for (const opt of item.answerOption ?? []) {
            const c = opt.valueCoding;
            if (c?.system?.includes('snomed.info/sct')) {
              entries.push({ type: 'answer', text: c.display ?? '', code: c.code, display: c.display ?? '' });
            }
          }
        }
        if (item.item?.length) traverse(item.item);
      }
    };
    traverse(questionnaire?.item ?? []);
    return entries;
  }

  showResponse() {
    const version = this.lformsService.detectVersion(this.questionnaire);
    const qr = LForms.Util.getFormFHIRData('QuestionnaireResponse', version, 'cancerFormContainer');
    this.dialog.open(ResponseDialogComponent, {
      width: '80%',
      maxWidth: '1000px',
      height: '84vh',
      data: { title: this.selected!.title, responseJson: JSON.stringify(qr, null, 2) }
    });
  }

  backToGallery() {
    this.selected = null;
    this.questionnaire = null;
    this.codingDataSource.data = [];
  }
}
