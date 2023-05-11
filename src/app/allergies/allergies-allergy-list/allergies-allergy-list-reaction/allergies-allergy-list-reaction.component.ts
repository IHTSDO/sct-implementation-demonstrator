import { Component, EventEmitter, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-allergies-allergy-list-reaction',
  templateUrl: './allergies-allergy-list-reaction.component.html',
  styleUrls: ['./allergies-allergy-list-reaction.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AllergiesAllergyListReactionComponent),
      multi: true
    }
  ]
})
export class AllergiesAllergyListReactionComponent implements ControlValueAccessor {

  @Output() ngModelChange = new EventEmitter();

  severityOptions = [
    { code: 'mild', display: 'Mild', sctCode: '255604002', sctDisplay: 'Mild (qualifier value)' },
    { code: 'moderate', display: 'Moderate', sctCode: '6736007', sctDisplay: 'Moderate (qualifier value)' },
    { code: 'severe', display: 'Severe', sctCode: '24484000', sctDisplay: 'Severe (qualifier value)' }
  ];
  selectedSeverity: any = {};
  reactionManifestationBinding = { ecl: '<<404684003 |Clinical finding|', title: 'Reaction Manifestation' };
  routeBinding = { ecl: '<<284009009 |Route of administration value|', title: 'Exposure Route' };

  reaction: any = {};
  private onChangeCallback: (_: any) => void = () => {};
  private onTouchedCallback: () => void = () => {};

  writeValue(value: any) {
    this.reaction = value;
  }

  registerOnChange(fn: any) {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any) {
    this.onTouchedCallback = fn;
  }

  onChange() {
    this.onChangeCallback(this.reaction);
  }

  onTouched() {
    this.onTouchedCallback();
  }

  onModelChange(newValue: any) {
    this.reaction = newValue;
    this.onChangeCallback(newValue);
    this.ngModelChange.emit(newValue);
  }

  updateAllergyStr() {
    this.reaction.severity = this.selectedSeverity.code;
  }

  reactionManifestationSelected(reactionManifestation: any) {
    reactionManifestation = Object.assign({ system: 'http://snomed.info/sct' }, reactionManifestation);
    this.reaction.manifestation[0].concept.coding = [reactionManifestation];
  }

  routeSelected(route: any) {
    route = Object.assign({ system: 'http://snomed.info/sct' }, route);
    this.reaction.exposureRoute.coding = [route];
  }

}
