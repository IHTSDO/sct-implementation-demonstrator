import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuService } from '../services/menu.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit{
  demos: any[] = [];

  constructor(public router: Router, private menuService: MenuService) { }

  ngOnInit(): void {
    this.demos = this.menuService.getDemos();
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      this.router.navigate([demo.url], { queryParams: demo.queryParams });
    } else {
      this.openInNewTab(demo.url);
    }
  }

  openInNewTab(url: string) {
    window.open(url, '_blank');
  }

}
