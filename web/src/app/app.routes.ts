import { Routes } from '@angular/router';
import { PitchChart } from './pitch-chart/pitch-chart';
import { PitcherStats } from './pitcher-stats/pitcher-stats';

export const routes: Routes = [
  // Default route (homepage)
  { path: '', redirectTo: 'pitch-chart', pathMatch: 'full' },
  
  // Route for the Pitch Chart
  { path: 'pitch-chart', component: PitchChart }, 
  
  // Route for the Pitcher Stats table
  { path: 'pitcher-stats', component: PitcherStats },
  
  // Catch-all route for 404s (optional)
  { path: '**', redirectTo: 'pitch-chart' } 
];