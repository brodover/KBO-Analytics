import { HttpClient } from '@angular/common/http';
import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { isPlatformBrowser } from '@angular/common';

const CHART_SPEC_PATH = 'assets/20250322LTLG02025_plate_discipline.json'; 

@Component({
  selector: 'app-pitch-chart',
  templateUrl: './pitch-chart.html',
  styleUrl: './pitch-chart.css',
  imports: [
    CommonModule, 
    FormsModule 
  ],
})
export class PitchChart implements  AfterViewInit {
  // Use @ViewChild to get a reference to the HTML div container
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  // State variables for the selections
  playerType: 'batters' | 'pitchers' = 'batters'; // Default to batters
  opponentTeam: string = 'HH'; // Default to the first team
  
  // List of opponent team abbreviations from your file names
  opponentTeams: string[] = ['HH', 'HT', 'KT', 'LG', 'NC', 'OB', 'SK', 'SS', 'WO']; 

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private http: HttpClient) { }

  ngAfterViewInit(): void {
    this.loadChart();
  }

  /**
   * Constructs the filename and fetches/renders the Altair chart.
   */
  loadChart(): void {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Construct the filename based on current selections
      // e.g., 'LT_batters_vs_HH_discipline.json'
      const filename = `LT_${this.playerType}_vs_${this.opponentTeam}_discipline.json`;
      
      // The full path relative to your assets folder
      const chartUrl = `assets/${filename}`; 

      console.log('Attempting to load chart:', chartUrl);

      // 2. Fetch the Altair/Vega-Lite JSON specification
      this.http.get(chartUrl).subscribe({
        next: (data: any) => {
          // 3. Render the chart (Replace this with your actual rendering logic)
          this.renderChart(data); 
        },
        error: (err) => {
          console.error('Failed to load chart JSON:', err);
          // Optional: Display an error message to the user
        }
      });
    } else {
      console.log('Skipping Vega-Embed execution on the server side.');
    }
  }

  /**
   * Placeholder function for rendering the Vega-Lite/Altair specification.
   * NOTE: You MUST have the vega-embed library installed and imported for this to work.
   */
  renderChart(vegaSpec: any): void {
    const container = this.el.nativeElement.querySelector('#vega-chart-container');
    if (container) {
      // Clear the previous chart
      container.innerHTML = ''; 
      
      // Use vegaEmbed to render the chart spec
      // Assuming 'vegaEmbed' is imported and available (e.g., as 'vegaEmbed.default' or just 'vegaEmbed')
      // You may need to adjust the import and usage based on your Vega-Embed setup.
      vegaEmbed.default(container, vegaSpec, { actions: false }).catch(console.error);
      
      // *** You'll need to uncomment and correct the vegaEmbed line based on your setup. ***
      console.log('Chart data received. Ready to render using vega-embed.');
    }
  }
}