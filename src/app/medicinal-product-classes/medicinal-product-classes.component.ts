import { Component } from '@angular/core';

@Component({
  selector: 'app-medicinal-product-classes',
  templateUrl: './medicinal-product-classes.component.html',
  styleUrl: './medicinal-product-classes.component.css',
  standalone: false
})
export class MedicinalProductClassesComponent {
  readonly specPaths = [
    'assets/specs/medicinal-product-classes/groupers.json',
    'assets/specs/medicinal-product-classes/medicinal-products.json',
    'assets/specs/medicinal-product-classes/clinical-drugs.json',
    'assets/specs/medicinal-product-classes/packaged-clinical-drugs.json'
  ];
}
