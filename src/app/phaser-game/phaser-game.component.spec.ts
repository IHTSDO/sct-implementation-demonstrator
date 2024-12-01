import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhaserGameComponent } from './phaser-game.component';

describe('PhaserGameComponent', () => {
  let component: PhaserGameComponent;
  let fixture: ComponentFixture<PhaserGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhaserGameComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PhaserGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
