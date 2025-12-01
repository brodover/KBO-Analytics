import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, Input } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import embed from 'vega-embed'; // Import the vega-embed function
import { TrajectoryPoint } from '../interfaces/pitching';
import { TrajectoryService } from '../services/trajectory.service';

// Assuming you have inputs for pitcher and the two selected pitch types
@Component({
  selector: 'app-trajectory-chart',
  imports: [],
  templateUrl: './trajectory-chart.html',
  styleUrl: './trajectory-chart.css'
})
export class TrajectoryChart implements OnInit, AfterViewInit {
  
  // Reference to the div element where the chart will render
  @ViewChild('chartContainer') chartContainer!: ElementRef; 

  @Input() pitcherId!: number;
  @Input() pitchType1!: string;
  @Input() pitchType2!: string;

  chartData$: Observable<TrajectoryPoint[]> | undefined;
  
  // Use a property to hold the data once it resolves
  private resolvedChartData: TrajectoryPoint[] = [];

  constructor(private trajectoryService: TrajectoryService) {}

  ngOnInit(): void {
    // --- Combined Data Subscription ---
    this.chartData$ = this.trajectoryService.getTrajectoryData(
        this.pitcherId, 
        this.pitchType1, 
        this.pitchType2
    );

    this.chartData$.subscribe(data => {
        this.resolvedChartData = data;
        // Trigger rendering *after* data is ready
        if (data && data.length > 0) {
            this.renderChart();
        }
    });
  }

  ngAfterViewInit(): void {
    // Also try to render after the view is initialized, in case data arrived earlier
    if (this.resolvedChartData.length > 0) {
        this.renderChart();
    }
  }

  // --- VEGA-LITE CHART RENDERING LOGIC ---
  renderChart(): void {
    const element = this.chartContainer?.nativeElement;
    if (!element || this.resolvedChartData.length === 0) {
        return;
    }
    
    // 1. Define the Vega-Lite Specification (JSON object)
    const vegaSpec = this.createVegaLiteSpec(this.resolvedChartData);

    // 2. Embed the chart into the DOM element
    embed(element, vegaSpec, { 
        actions: false, // Turn off export links, etc.
        mode: 'vega-lite' 
    }).catch(console.error);

    console.log(`Rendering chart with ${this.resolvedChartData.length} total points.`);
  }

  // 3. Define the detailed Vega-Lite Specification
  private createVegaLiteSpec(data: TrajectoryPoint[]): any {
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "width": 400,
      "height": 500,
      "title": `${this.pitchType1} vs ${this.pitchType2} Trajectory (X vs Z)`,
      "data": {
        "values": data // Pass the tidy data array directly
      },
      "mark": "line",
      "encoding": {
        // X-axis: Lateral Movement (side-to-side)
        "x": {
          "field": "x",
          "type": "quantitative",
          "title": "Lateral Break (X)",
          // Reverse the axis to simulate batter's view (typically left-to-right is negative)
          "scale": {"reverse": true} 
        },
        // Y-axis: Vertical Movement (up-down)
        "y": {
          "field": "z",
          "type": "quantitative",
          "title": "Vertical Position (Z)",
          "scale": {"domain": [1, 7]} // Set a fixed domain for consistent look (1ft to 7ft)
        },
        // Color: Combined encoding for Pitch Type AND Tunnel/Divergence
        "color": {
          "field": "pitch_type", // Main line separation by pitch type
          "type": "nominal",
          "legend": {"title": "Pitch Type"}
        },
        // Detail/Grouping: CRITICAL for drawing separate lines
        "detail": {
          "field": "pitch_type", 
          "type": "nominal"
        },
        // Order: Ensures the line is drawn sequentially over time (t)
        "order": {
          "field": "t", 
          "type": "quantitative"
        },
        // Opacity: Used to split the line into two segments (tunnel/divergence)
        "opacity": {
            "field": "is_tunnel_end",
            "type": "nominal",
            "legend": null,
            // Use different opacities to visually separate the tunnel (false) from divergence (true)
            "scale": {"domain": [false, true], "range": [0.3, 1.0]} 
        }
      }
    };
  }
}