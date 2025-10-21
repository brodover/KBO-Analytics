import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PitchChart } from './pitch-chart';

describe('PitchChart', () => {
  let component: PitchChart;
  let fixture: ComponentFixture<PitchChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PitchChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PitchChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
