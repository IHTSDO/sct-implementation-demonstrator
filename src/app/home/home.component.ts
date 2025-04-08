import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    standalone: false
})
export class HomeComponent implements OnInit{
  demos: any[] = [];
  demoTypes: Record<string, number> = {};
  embeddedMode: boolean = false;

  constructor(public router: Router, public route: ActivatedRoute, private menuService: MenuService) { }

  ngOnInit(): void {
    this.demos = this.menuService.getDemos();
    this.route.queryParams.subscribe(params => {
      if (params['embedded'] === 'true') {
        this.embeddedMode = true;
      } else {
        this.embeddedMode = false;
      }
    });
    // generate a list of all demo.type in demos with counts
    this.demoTypes = this.demos.reduce((acc: any, demo: any) => {
      if (!acc[demo.type]) {
        acc[demo.type] = 0;
      }
      acc[demo.type]++;
      return acc;
    }, {});
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      if (!this.embeddedMode) {
        let queryParams = demo.queryParams;
        let currentParams = this.route.snapshot.queryParams;
        if (queryParams) {
          queryParams = { ...currentParams, ...queryParams };
        } else {
          queryParams = currentParams;
        }
        this.router.navigate([demo.url], { queryParams: queryParams });
      } else {
        this.openInNewTab('https://ihtsdo.github.io/sct-implementation-demonstrator/#' + demo.url);
      }
    } else {
      this.openInNewTab(demo.url);
    }
  }

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

}
