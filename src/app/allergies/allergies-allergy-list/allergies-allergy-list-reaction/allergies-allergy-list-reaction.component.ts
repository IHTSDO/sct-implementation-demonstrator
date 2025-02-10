import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
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
    ],
    standalone: false
})
export class AllergiesAllergyListReactionComponent implements ControlValueAccessor {

  @Input() reactions: any[] = [];

  // add emitter for new problem
  @Output() newManifestation = new EventEmitter<any>();

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

  constructor() { }

  writeValue(obj: any): void {
    if (obj !== undefined) {
      this.reactions = obj;
    }
  }

  setDisabledState?(isDisabled: boolean): void {
    // TODO: implement this
  }

  addNewReaction() {
    this.reactions.push(this.reaction);
    this.reaction = {};
    this.onChangeCallback(this.reactions);
  }

  removeReaction(index: number) {
    this.reactions.splice(index, 1);
    this.onChangeCallback(this.reactions);
  }

  reactionManifestationSelected(reaction: any, event: any) {
    reaction.manifestation = event;
    this.newManifestation.emit(event);
    this.onChangeCallback(this.reactions);
  }

  reactionSeveritySelected(reaction: any, event: any) {
    reaction.severity = event;
    this.onChangeCallback(this.reactions);
  }

  reactionRouteSelected(reaction: any, event: any) {
    reaction.route = event;
    this.onChangeCallback(this.reactions);
  }

  registerOnChange(fn: any): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedCallback = fn;
  }

}
