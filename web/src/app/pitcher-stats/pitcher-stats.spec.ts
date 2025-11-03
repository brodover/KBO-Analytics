import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PitcherStats } from './pitcher-stats';

describe('PitcherStats', () => {
  let component: PitcherStats;
  let fixture: ComponentFixture<PitcherStats>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PitcherStats]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PitcherStats);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
