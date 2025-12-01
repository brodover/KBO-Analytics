// src/app/batter-pov-tunnel/batter-pov-tunnel.component.ts
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { TrajectoryService } from '../services/trajectory.service';
import { TrajectoryPoint, PitcherTeam } from '../interfaces/pitching';
import { Observable, Subscription } from 'rxjs';
import embed from 'vega-embed';

@Component({
  selector: 'app-batter-pov-tunnel',
  templateUrl: './batter-pov-tunnel.html',
  styleUrls: ['./batter-pov-tunnel.css'],
  imports: [FormsModule, CommonModule, AsyncPipe]
})
export class BatterPovTunnel implements OnInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  groupedPitchers$: Observable<PitcherTeam[]>;
  selectedPitcherId: number | null = null;
  availablePitchTypes: string[] = []; // List of pitches for the selected pitcher

  // The two pitch types the user selects to compare
  pitchType1: string | null = null;
  pitchType2: string | null = null;

  chartData: TrajectoryPoint[] | null = null;

  // cleanup
  private pitchTypeSubscription: Subscription | undefined;
  private chartDataSubscription: Subscription | undefined;

  constructor(private trajectoryService: TrajectoryService) {
    this.groupedPitchers$ = this.trajectoryService.groupedPitchers$;
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.pitchTypeSubscription?.unsubscribe();
    this.chartDataSubscription?.unsubscribe();
  }

  // Called when the pitcher selection changes
  onPitcherSelect(pitcherId: number | null): void {
    this.pitchTypeSubscription?.unsubscribe();

    this.selectedPitcherId = pitcherId;

    this.pitchType1 = null;
    this.pitchType2 = null;
    this.availablePitchTypes = [];

    if (pitcherId !== null) {
      const numPitcherId = Number(pitcherId);

      // 2. Subscribe to the service to get the actual pitch types
      this.pitchTypeSubscription = this.trajectoryService
        .getPitchTypesForPitcher(numPitcherId)
        .subscribe(types => {
          this.availablePitchTypes = types; // Populate with actual data
        });
    } else {
      console.log('No pitcher selected.');
    }
  }

  // Called when a pitch type selection changes
  updateTunnelVisualization(): void {
    // 1. Cleanup old subscription
    this.chartDataSubscription?.unsubscribe();
    this.chartData = null; // Reset current data

    if (!this.selectedPitcherId || !this.pitchType1 || !this.pitchType2) {
      console.log('Incomplete selection, cannot update visualization.');
      return;
    }

    const numPitcherId = Number(this.selectedPitcherId);

    // 2. Get the NEW observable
    this.chartDataSubscription = this.trajectoryService
      .getTrajectoryData(numPitcherId, this.pitchType1, this.pitchType2)
      .subscribe(data => {
        this.chartData = data;
        if (data && data.length > 0) {
          setTimeout(() => {
            this.renderChart();
          }, 0);
        }
      });
  }

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
      "title": `${this.pitchType1} vs ${this.pitchType2} Trajectory (X vs Z)`,
      "data": {
        "values": data // Pass the data array directly
      },
      "mark": "line",
      "encoding": {
        "x": {
          "field": "x",
          "type": "quantitative",
          "title": "Lateral Break (X)",
          "scale": { "reverse": true }
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