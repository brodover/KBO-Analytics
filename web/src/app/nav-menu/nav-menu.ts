import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router'; // Import routing directives

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-nav-menu',
  standalone: true, // Make it a standalone component
  imports: [CommonModule, RouterLink, RouterLinkActive], // Include routing directives
  template: `
    <nav class="main-nav">
      <ul>
        <li *ngFor="let link of navLinks">
          <a [routerLink]="link.path" routerLinkActive="active-link">{{ link.label }}</a>
        </li>
      </ul>
    </nav>
  `,
  styleUrls: ['./nav-menu.css']
})
export class NavMenu {
  // Define your links here, making it easy to add more pages later
  navLinks: NavLink[] = [
    { path: '/pitch-chart', label: 'Pitch Chart Overview' },
    { path: '/pitcher-stats', label: 'Pitcher Predictability (Stats)' },
    // Add more links here later (e.g., Batter Analysis, Zone Analysis)
  ];
}