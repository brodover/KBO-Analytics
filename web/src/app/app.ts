import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PitchChart } from './pitch-chart/pitch-chart';
import { PitcherStats } from './pitcher-stats/pitcher-stats';
import { NavMenu } from './nav-menu/nav-menu';

@Component({
  selector: 'app-root',
  imports: [PitchChart, PitcherStats, NavMenu, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('web');
}
