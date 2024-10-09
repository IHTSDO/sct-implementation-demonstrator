import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit{
  demos: any[] = [];

  constructor(public router: Router, public route: ActivatedRoute, private menuService: MenuService) { }

  ngOnInit(): void {
    this.demos = this.menuService.getDemos();
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      let queryParams = demo.queryParams;
      let currentParams = this.route.snapshot.queryParams;
      if (queryParams) {
        queryParams = { ...currentParams, ...queryParams };
      } else {
        queryParams = currentParams;
      }
      this.router.navigate([demo.url], { queryParams: queryParams });
    } else {
      this.openInNewTab(demo.url);
    }
  }

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

}
