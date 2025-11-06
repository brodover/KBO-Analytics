import { HttpClient } from '@angular/common/http';
import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { isPlatformBrowser } from '@angular/common';
import { StrikeZoneData } from '../interfaces/strike-zone-data';

@Component({
  selector: 'app-pitch-chart',
  templateUrl: './pitch-chart.html',
  styleUrl: './pitch-chart.css',
  imports: [
    CommonModule, 
    FormsModule 
  ],
})
export class PitchChart implements AfterViewInit {
  // Use @ViewChild to get a reference to the HTML div container
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  batterNames: string[] = [];

  // Assume you have a batter selection (dropdown) bound to this
  selectedBatter: string = 'All'; 
  
  // State for Dynamic Strike Zone Data
  strikeZoneData: StrikeZoneData[] = [];
  currentZoneTop: number = 3.4; // Default safe value
  currentZoneBtm: number = 1.6; // Default safe value

  // Constants for pixel conversion (based on your chart generation)
  // Total Y range in feet (from 0.0 to 5.0, matching the chart's Y-scale domain)
  private readonly CHART_Y_RANGE_FT = 5.0; 
  // Total chart height in pixels (matches the HEIGHT=760 in your Python script)
  private readonly CHART_PIXEL_HEIGHT = 760;

  // State variables for the selections
  playerType: 'batters' | 'pitchers' = 'batters'; // Default to batters
  opponentTeam: string = 'HH'; // Default to the first team
  
  // List of opponent team abbreviations from your file names
  opponentTeams: string[] = ['HH', 'HT', 'KT', 'LG', 'NC', 'OB', 'SK', 'SS', 'WO']; 

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private http: HttpClient) { }

  ngAfterViewInit(): void {
    // 1. Fetch the strike zone data asynchronously
  this.fetchStrikeZoneData().then(() => {
    // 2. Load the main pitch chart after the strike zone data is ready
    this.loadChart();
  });
  }

  /**
   * Fetches the strike zone summary data.
   */
  fetchStrikeZoneData(): Promise<void> {
      return new Promise((resolve) => {
          this.http.get<StrikeZoneData[]>(`assets/strikezone_summary.json`).subscribe({
              next: (data) => {
                  this.strikeZoneData = data;
                  resolve();
              },
              error: (err) => {
                  console.error('Error fetching strike zone data', err);
                  resolve(); // Resolve anyway to proceed with chart loading
              }
          });
      });
  }

  /**
   * Constructs the filename and fetches/renders the Altair chart.
   */
  loadChart(): void {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Construct the filename based on current selections
      const filename = `LT_${this.playerType}_vs_${this.opponentTeam}_discipline.json`;
      const chartUrl = `assets/${filename}`; 

      console.log('Attempting to load chart:', chartUrl);

      // 2. Fetch the Altair/Vega-Lite JSON specification
      this.http.get(chartUrl).subscribe({
        next: (data: any) => {
          // Extract unique batter names from the chart data
          // Altair JSON structure: data -> values (array of pitch objects)
          if (data && data.data && data.data.values) {
            const uniqueBatters = new Set<string>();
            const batterNameField = this.playerType === 'batters' ? 'batter_name' : 'batter_name'; // Batter name is 'batter_name' in both cases

            for (const pitch of data.data.values) {
              if (pitch[batterNameField]) {
                uniqueBatters.add(pitch[batterNameField]);
              }
            }
            // Convert Set to Array and sort alphabetically
            this.batterNames = Array.from(uniqueBatters).sort();
          }

          this.renderChart(data); 
          this.updateStrikeZone(); // <<< NEW: Find the correct strike zone

          // NOTE: The Altair chart handles its own pitch data filtering 
          // via the selection parameter already built into the JSON file.

        },
        error: (err) => {
          console.error('Failed to load chart JSON:', err);
        }
      });
    } else {
      console.log('Skipping Vega-Embed execution on the server side.');
    }
  }

  /**
   * Renders the Vega-Lite/Altair specification after injecting dynamic data.
   */
  renderChart(vegaSpec: any): void {
      const container = this.el.nativeElement.querySelector('#vega-chart-container');
      if (container) {
          // 1. ***CRITICAL STEP: INJECT DYNAMIC ZONE COORDINATES***
          const updatedSpec = this.injectStrikeZoneCoordinates(vegaSpec);
          
          // 2. Clear and render the modified spec
          container.innerHTML = ''; 
          vegaEmbed.default(container, updatedSpec, { actions: false }).catch(console.error);
          
          console.log('Chart data received and rendered with dynamic strike zone.');
      }
  }

  /**
   * Looks through the Vega-Lite spec layers and overwrites the strike zone data array.
   * @param spec The full Altair/Vega-Lite JSON specification.
   * @returns The modified specification.
   */
  injectStrikeZoneCoordinates(spec: any): any {
      // 1. Check if the spec is a layer array (standard for Altair overlays)
      if (spec.layer && Array.isArray(spec.layer)) {
          for (const layer of spec.layer) {
              // 2. The strike zone layer is the one using mark: 'rect' and is likely the first or second layer
              if (layer.mark && layer.mark.type === 'rect' && layer.data && Array.isArray(layer.data.values)) {
                  
                  // 3. Overwrite the Y-coordinates in the data array
                  // The data array contains one object: { x: ..., x2: ..., y: ..., y2: ... }
                  if (layer.data.values.length > 0) {
                      layer.data.values[0].y = this.currentZoneBtm;
                      layer.data.values[0].y2 = this.currentZoneTop;
                      
                      console.log(`Injected dynamic zone: ${this.currentZoneBtm} to ${this.currentZoneTop}`);
                      // Return the modified spec (we found the layer)
                      return spec; 
                  }
              }
          }
      }
      
      // Fallback: If the chart is a simple layer (not an array)
      if (spec.data && Array.isArray(spec.data.values) && spec.mark && spec.mark.type === 'rect') {
          if (spec.data.values.length > 0) {
              spec.data.values[0].y = this.currentZoneBtm;
              spec.data.values[0].y2 = this.currentZoneTop;
              return spec;
          }
      }
      
      // If not found, return the original spec
      return spec;
  }

  /**
   * Looks up the correct strike zone (top/bottom) based on current filters.
   * Should be called whenever playerType, opponentTeam, or selectedBatter changes.
   */
  updateStrikeZone(): void {
    if (this.strikeZoneData.length === 0) return;

    let lookupEntry: StrikeZoneData | undefined;
    const allEntry = this.strikeZoneData.find(d => d.entity_type === 'ALL');

    if (this.selectedBatter !== 'All') {
      // Priority 1: Specific Batter Zone
      lookupEntry = this.strikeZoneData.find(
        d => d.entity_type === 'BATTER' && d.entity_name === this.selectedBatter
      );
    } 
    
    if (!lookupEntry) {
        if (this.playerType === 'pitchers') {
            // Priority 2: Lotte Pitchers vs. Opponent Batters (zone is based on the Opponent TEAM)
            lookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === this.opponentTeam
            );
        } else if (this.playerType === 'batters') {
            // Priority 2: Lotte Batters vs. Opponent Pitchers (zone is based on the Lotte TEAM)
            lookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === 'LT'
            );
        }
    }

    // Apply the found values or fallback to 'ALL'
    if (lookupEntry) {
      this.currentZoneTop = lookupEntry.avg_strikezone_top;
      this.currentZoneBtm = lookupEntry.avg_strikezone_btm;
    } else if (allEntry) {
      this.currentZoneTop = allEntry.avg_strikezone_top;
      this.currentZoneBtm = allEntry.avg_strikezone_btm;
    }
  }

  /**
   * You must wire up your batter dropdown filter to call this method.
   */
  onBatterChange(newBatter: string): void {
      this.selectedBatter = newBatter;
      this.updateStrikeZone();
  }
}