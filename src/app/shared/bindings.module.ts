import { NgModule } from '@angular/core';
import { AutocompleteBindingComponent } from '../bindings/autocomplete-binding/autocomplete-binding.component';
import { CheckBoxBindingComponent } from '../bindings/checkbox-binding/checkbox-binding.component';
import { CheckBoxMultipleBindingComponent } from '../bindings/checkbox-multiple-binding/checkbox-multiple-binding.component';
import { DecimalBindingComponent } from '../bindings/decimal-binding/decimal-binding.component';
import { DropdownBindingComponent } from '../bindings/dropdown-binding/dropdown-binding.component';
import { AttributeEditorComponent } from '../bindings/ecl-builder/attribute-editor/attribute-editor.component';
import { AttributeSetEditorComponent } from '../bindings/ecl-builder/attribute-set-editor/attribute-set-editor.component';
import { ConceptPickerComponent } from '../bindings/ecl-builder/concept-picker/concept-picker.component';
import { ConstraintOperatorSelectComponent } from '../bindings/ecl-builder/constraint-operator-select/constraint-operator-select.component';
import { EclBuilderComponent } from '../bindings/ecl-builder/ecl-builder.component';
import { ExpressionConstraintNodeComponent } from '../bindings/ecl-builder/expression-constraint-node/expression-constraint-node.component';
import { EclBuilderDialogComponent } from '../bindings/ecl-builder-dialog/ecl-builder-dialog.component';
import { IntegerBindingComponent } from '../bindings/integer-binding/integer-binding.component';
import { MultiPrefixSelectBindingComponent } from '../bindings/multi-prefix-select-binding/multi-prefix-select-binding.component';
import { RadiosBindingComponent } from '../bindings/radios-binding/radios-binding.component';
import { TextBoxBindingComponent } from '../bindings/textbox-binding/textbox-binding.component';
import { BindingsDataDialogComponent } from '../bindings-sandbox/bindings-data-dialog/bindings-data-dialog.component';
import { BindingsViewerComponent } from '../bindings-sandbox/bindings-viewer/bindings-viewer.component';
import { AppMaterialModule } from './app-material.module';

const DECLARATIONS = [
  AutocompleteBindingComponent,
  CheckBoxBindingComponent,
  CheckBoxMultipleBindingComponent,
  DecimalBindingComponent,
  DropdownBindingComponent,
  AttributeEditorComponent,
  AttributeSetEditorComponent,
  ConceptPickerComponent,
  ConstraintOperatorSelectComponent,
  EclBuilderComponent,
  ExpressionConstraintNodeComponent,
  EclBuilderDialogComponent,
  IntegerBindingComponent,
  MultiPrefixSelectBindingComponent,
  RadiosBindingComponent,
  TextBoxBindingComponent,
  BindingsDataDialogComponent,
  BindingsViewerComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule],
  exports: DECLARATIONS,
})
export class BindingsModule {}
