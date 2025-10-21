import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PitchChart } from './pitch-chart/pitch-chart';

@Component({
  selector: 'app-root',
  imports: [PitchChart],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('web');
}
