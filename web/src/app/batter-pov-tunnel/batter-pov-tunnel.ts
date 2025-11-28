// src/app/batter-pov-tunnel/batter-pov-tunnel.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { TrajectoryService } from '../services/trajectory.service';
import { TrajectoryPoint, PitcherTeam } from '../interfaces/pitching';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

@Component({
  selector: 'app-batter-pov-tunnel',
  templateUrl: './batter-pov-tunnel.html',
  styleUrls: ['./batter-pov-tunnel.css'],
  imports: [ FormsModule, CommonModule, AsyncPipe ]
})
export class BatterPovTunnel implements OnInit, OnDestroy {
  groupedPitchers$: Observable<PitcherTeam[]>;
  selectedPitcherId: number | null = null;
  availablePitchTypes: string[] = []; // List of pitches for the selected pitcher
  private pitchTypeSubscription: Subscription | undefined; // For cleanup

  // The two pitch types the user selects to compare
  pitchType1: string | null = null;
  pitchType2: string | null = null;

  // Final data structure for plotting the lines
  plotData: { trajectory1: TrajectoryPoint[], trajectory2: TrajectoryPoint[] } | null = null;
  
  // Example hardcoded pitch types for simplicity
  allPitchTypes = ['직구', '스위퍼', '커브', '슬라이더']; 

  constructor(private trajectoryService: TrajectoryService) {
    this.groupedPitchers$ = this.trajectoryService.groupedPitchers$;
  }

  ngOnInit(): void {}

ngOnDestroy(): void {
    this.pitchTypeSubscription?.unsubscribe();
  }

  // Called when the pitcher selection changes
  onPitcherSelect(pitcherId: number | null): void {
    this.pitchTypeSubscription?.unsubscribe();

    this.selectedPitcherId = pitcherId;

    this.pitchType1 = null;
    this.pitchType2 = null;
    this.plotData = null;
    this.availablePitchTypes = [];
    
    if (pitcherId !== null) {
      const numPitcherId = Number(pitcherId);

      // 2. Subscribe to the service to get the actual pitch types
      this.pitchTypeSubscription = this.trajectoryService
        .getPitchTypesForPitcher(numPitcherId)
        .subscribe(types => {
          this.availablePitchTypes = types; // Populate with actual data
        });
    }
  }

  // Called when a pitch type selection changes
  updateTunnelVisualization(): void {
    if (!this.selectedPitcherId || !this.pitchType1 || !this.pitchType2) {
      this.plotData = null;
      return;
    }

    // const traj1$ = this.trajectoryService.getTrajectory(this.selectedPitcherId, this.pitchType1);
    // const traj2$ = this.trajectoryService.getTrajectory(this.selectedPitcherId, this.pitchType2);

    const traj1$ = this.trajectoryService.getTrajectory(this.selectedPitcherId, this.pitchType1).pipe(
      filter(traj => !!traj) 
    );
    const traj2$ = this.trajectoryService.getTrajectory(this.selectedPitcherId, this.pitchType2).pipe(
      filter(traj => !!traj) 
    );

    // Combine the observables to ensure we have both datasets before plotting
    combineLatest([traj1$, traj2$])
      .pipe(
        map(([traj1, traj2]) => {
          if (traj1 && traj2) {
            // Prepare the data arrays for plotting
            this.plotData = {
              trajectory1: traj1.avg_trajectory,
              trajectory2: traj2.avg_trajectory
            };
          } else {
             this.plotData = null;
          }
        })
      )
      .subscribe();
  }
}