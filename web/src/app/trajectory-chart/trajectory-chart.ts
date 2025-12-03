import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, Input, SimpleChanges } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import embed from 'vega-embed'; // Import the vega-embed function
import { TrajectoryPoint } from '../interfaces/pitching';
import { TrajectoryService } from '../services/trajectory.service';

@Component({
  selector: 'app-trajectory-chart',
  imports: [],
  templateUrl: './trajectory-chart.html',
  styleUrl: './trajectory-chart.css',
  standalone: true
})
export class TrajectoryChart implements AfterViewInit {
  
  // Reference to the div element where the chart will render
  @ViewChild('chartContainer') chartContainer!: ElementRef; 

  @Input() pitcherId!: number;
  @Input() chartData: TrajectoryPoint[] | null = null;

  chartTitle: string = 'Pitch Trajectories (X vs Z)';

  chartData$: Observable<TrajectoryPoint[]> | undefined;
  
  // Use a property to hold the data once it resolves
  private resolvedChartData: TrajectoryPoint[] = [];

  constructor(private trajectoryService: TrajectoryService) {}

  ngAfterViewInit(): void {
    // Attempt to render after the view is initialized if data is already present
    if (this.chartData && this.chartData.length > 0) {
      // Use setTimeout to ensure the ViewChild element is ready
      setTimeout(() => this.renderChart(), 0);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartData'] && this.chartData && this.chartData.length > 0) {
        // Determine the pitcher's name for the title from the new data
        this.chartTitle = `${this.chartData[0].pitcher_name}'s Pitch Trajectories`;
        
        // Use setTimeout to ensure the ViewChild element is ready, especially if data arrives before AfterViewInit
        setTimeout(() => this.renderChart(), 0);
    }
  }

  // --- VEGA-LITE CHART RENDERING LOGIC ---
  private renderChart(): void {
    const element = this.chartContainer?.nativeElement;
    if (!element || !this.chartData || this.chartData.length === 0) {
      return;
    }

    // 1. Define the Vega-Lite Specification
    const vegaSpec = this.createVegaLiteSpec(this.chartData);

    // 2. Embed the chart into the DOM element
    embed(element, vegaSpec, {
      actions: false,
      mode: 'vega-lite'
    }).catch(console.error);
  }

  private createVegaLiteSpec(data: TrajectoryPoint[]): any {
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "width": 400,
      "height": 500,
      "data": {
        "values": data // Pass the data array directly
      },
      "mark": "line",
      "encoding": {
        "x": {
          "field": "x",
          "type": "quantitative",
          "title": "Lateral Break (X)"
        },
        "y": {
          "field": "z",
          "type": "quantitative",
          "title": "Vertical Position (Z)",
          "scale": { "domain": [1, 7] }
        },
        // Color based on Pitch Type
        "color": {
          "field": "pitch_type",
          "type": "nominal",
          "legend": { "title": "Pitch Type" }
        },
        // Ensure separate lines are drawn for each pitch type
        "detail": {
          "field": "pitch_type",
          "type": "nominal"
        },
        // Ensure points are drawn in order of time (t)
        "order": {
          "field": "t",
          "type": "quantitative"
        },
        // Opacity to distinguish tunnel (false) from divergence (true)
        "opacity": {
          "field": "is_tunnel_end",
          "type": "nominal",
          "legend": null,
          "scale": { "domain": [false, true], "range": [0.3, 1.0] }
        }
      }
    };
  }
}