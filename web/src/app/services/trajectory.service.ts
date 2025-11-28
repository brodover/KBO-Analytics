// src/app/services/trajectory.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { PitchTrajectory, PitcherTeam } from '../interfaces/pitching';

@Injectable({
  providedIn: 'root'
})
export class TrajectoryService {
  private trajectoryDataUrl = 'assets/batter_pov_trajectories.json';

  private rawTrajectories$: Observable<PitchTrajectory[]>;
  private indexedTrajectories$!: Observable<Map<string, PitchTrajectory>>;

  // Observable for the grouped dropdown list
  public groupedPitchers$: Observable<PitcherTeam[]>;

  constructor(private http: HttpClient) {

    this.rawTrajectories$ = this.http.get<PitchTrajectory[]>(this.trajectoryDataUrl).pipe(
      shareReplay(1)
    );

    this.indexedTrajectories$ = this.rawTrajectories$.pipe(
      map(trajectories => {
        const dataMap = new Map<string, PitchTrajectory>();
        trajectories.forEach(t => {
          const key = `${t.pitcher_id}_${t.pitch_type}`;
          dataMap.set(key, t)
        });
        return dataMap;
      }),
      shareReplay(1)
    );

    this.groupedPitchers$ = this.rawTrajectories$.pipe(
      map(trajectories => {
        const pitcherMap = new Map<string, { id: number; name: string; team: string }>();
        const teamMap = new Map<string, { id: number; name: string }[]>();

        // 1. Collect unique pitchers (id, name, team)
        trajectories.forEach(t => {
          // Use pitcher_id as the unique key to avoid duplicate entries for one pitcher
          if (!pitcherMap.has(t.pitcher_id.toString())) {
            pitcherMap.set(t.pitcher_id.toString(), {
              id: t.pitcher_id,
              name: t.pitcher_name,
              team: t.pitcher_team_code
            });
          }
        });

        // 2. Group pitchers by team
        pitcherMap.forEach(pitcher => {
          if (!teamMap.has(pitcher.team)) {
            teamMap.set(pitcher.team, []);
          }
          teamMap.get(pitcher.team)?.push({ id: pitcher.id, name: pitcher.name });
        });

        // 3. Convert map to desired array structure and sort
        const groupedArray: PitcherTeam[] = [];
        teamMap.forEach((pitchers, teamCode) => {
          // Sort pitchers alphabetically within each team
          pitchers.sort((a, b) => a.name.localeCompare(b.name));
          groupedArray.push({ teamCode, pitchers });
        });

        // Sort teams alphabetically
        groupedArray.sort((a, b) => a.teamCode.localeCompare(b.teamCode));

        return groupedArray;
      }),
      shareReplay(1) // Cache the final result
    );
  }

  getTrajectory(pitcherId: number, pitchType: string): Observable<PitchTrajectory | undefined> {
    const key = `${pitcherId}_${pitchType}`;

    // The Map.get(key) returns PitcherPitchTrajectory | undefined.
    // The map operator correctly passes this through.
    return this.indexedTrajectories$.pipe(
      map(dataMap => dataMap.get(key))
    );
  }

  getPitchTypesForPitcher(pitcherId: number): Observable<string[]> {
    return this.rawTrajectories$.pipe(
      map(trajectories => {
        // 1. Filter the entire array for the specific pitcher
        const pitcherTrajectories = trajectories.filter(
          t => t.pitcher_id === pitcherId
        );

        // 2. Extract and get unique pitch types
        const pitchTypes = Array.from(new Set(
          pitcherTrajectories.map(t => t.pitch_type)
        ));

        // 3. Sort them alphabetically for presentation
        return pitchTypes.sort();
      }),
      // distinctUntilChanged ensures we only emit a new value if the array contents change
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)) 
    );
  }
}