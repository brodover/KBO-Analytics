import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router'; // Import routing directives

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-nav-menu',
  standalone: true,
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
  navLinks: NavLink[] = [
    { path: '/pitch-chart', label: 'Pitch Chart' },
    { path: '/pitch-tunnel', label: 'Pitch Tunnel' },
    { path: '/pitcher-stats', label: 'Pitcher Swing/Contact %' },
  ];
}