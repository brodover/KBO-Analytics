// src/app/batter-pov-tunnel/batter-pov-tunnel.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TrajectoryService } from '../services/trajectory.service';
import { TrajectoryPoint, PitcherTeam } from '../interfaces/pitching';
import { BehaviorSubject, combineLatest, map, Observable, Subscription } from 'rxjs';
import { TrajectoryChart } from '../trajectory-chart/trajectory-chart';


@Component({
  selector: 'app-batter-pov-tunnel',
  templateUrl: './batter-pov-tunnel.html',
  styleUrls: ['./batter-pov-tunnel.css'],
  imports: [TrajectoryChart, FormsModule, CommonModule]
})
export class BatterPovTunnel implements OnInit, OnDestroy {
  groupedPitchers$: Observable<PitcherTeam[]>;
  availablePitchers$: Observable<{ id: number; name: string }[]>; // Pitchers for selected team

  selectedTeamCode: string | null = null;
  selectedPitcherId: number | null = null;
  availablePitchTypes: string[] = []; // List of pitches for the selected pitcher

  chartData: TrajectoryPoint[] | null = null;

  // cleanup
  private pitchTypeSubscription: Subscription | undefined;
  private chartDataSubscription: Subscription | undefined;

  constructor(private trajectoryService: TrajectoryService) {
    this.groupedPitchers$ = this.trajectoryService.groupedPitchers$;
    
    // Initialize the availablePitchers$ stream
    this.availablePitchers$ = combineLatest([
        this.groupedPitchers$, 
        // Use an observable that emits the selectedTeamCode
        new BehaviorSubject(this.selectedTeamCode) 
    ]).pipe(
        map(([teams, teamCode]) => {
            if (!teamCode) return [];
            const selectedTeam = teams.find(t => t.teamCode === teamCode);
            return selectedTeam ? selectedTeam.pitchers : [];
        })
    );
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.pitchTypeSubscription?.unsubscribe();
    this.chartDataSubscription?.unsubscribe();
  }

  onTeamSelect(teamCode: string | null): void {
    this.selectedTeamCode = teamCode;
    // Reset pitcher and pitches when team changes
    this.selectedPitcherId = null; 
    this.availablePitchers$ = this.trajectoryService.groupedPitchers$.pipe(
        map(teams => {
            const team = teams.find(t => t.teamCode === teamCode);
            return team ? team.pitchers : [];
        })
    );
    this.onPitcherSelect(null); // Clear pitcher selection
  }

  // Called when the pitcher selection changes
  onPitcherSelect(pitcherId: number | null): void {
      // Clean up all subscriptions
      this.pitchTypeSubscription?.unsubscribe();
      this.chartDataSubscription?.unsubscribe();
      this.chartData = null; 

      this.selectedPitcherId = pitcherId;
      this.availablePitchTypes = [];
      
      if (pitcherId !== null) {
          const numPitcherId = Number(pitcherId);

          // 1. Get available pitch types (for display/info)
          this.pitchTypeSubscription = this.trajectoryService
              .getPitchTypesForPitcher(numPitcherId)
              .subscribe(types => {
                  this.availablePitchTypes = types;
                  
                  // 2. Fetch ALL tidy data points for this pitcher
                  this.chartDataSubscription = this.trajectoryService
                      .getTrajectoryDataForAllPitches(numPitcherId)
                      .subscribe(data => {
                          this.chartData = data;
                      });
              });
      }
  }
}