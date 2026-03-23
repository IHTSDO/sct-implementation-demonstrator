import { NgModule } from '@angular/core';
import { AllergiesComponent } from '../allergies/allergies.component';
import { AllergiesAllergyListComponent } from '../allergies/allergies-allergy-list/allergies-allergy-list.component';
import { AllergiesAllergyListReactionComponent } from '../allergies/allergies-allergy-list/allergies-allergy-list-reaction/allergies-allergy-list-reaction.component';
import { AllergiesProblemListComponent } from '../allergies/allergies-problem-list/allergies-problem-list.component';
import { AppMaterialModule } from './app-material.module';
import { BindingsModule } from './bindings.module';

const DECLARATIONS = [
  AllergiesComponent,
  AllergiesAllergyListComponent,
  AllergiesAllergyListReactionComponent,
  AllergiesProblemListComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule, BindingsModule],
  exports: DECLARATIONS,
})
export class AllergiesModule {}
