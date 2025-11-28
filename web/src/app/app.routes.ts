import { Routes } from '@angular/router';
import { PitchChart } from './pitch-chart/pitch-chart';
import { PitchTunnel } from './pitch-tunnel/pitch-tunnel';
import { PitcherStats } from './pitcher-stats/pitcher-stats';
import { BatterPovTunnel } from './batter-pov-tunnel/batter-pov-tunnel';

export const routes: Routes = [
  // Default route (homepage)
  { path: '', redirectTo: 'pitch-chart', pathMatch: 'full' },
  
  // Route for the Pitch Chart
  { path: 'pitch-chart', component: PitchChart }, 
  
  // Route for the Pitch Tunnel visualization
  { path: 'pitch-tunnel', component: PitchTunnel },
  
  // Route for the Pitcher Stats table
  { path: 'pitcher-stats', component: PitcherStats },
  
  // Route for the Batter POV Tunnel visualization
  { path: 'pov-tunnel', component: BatterPovTunnel },
  
  // Catch-all route for 404s (optional)
  { path: '**', redirectTo: 'pitch-chart' } 
];