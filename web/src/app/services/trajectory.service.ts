// src/app/services/trajectory.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { TrajectoryPoint, PitcherTeam } from '../interfaces/pitching';

@Injectable({
  providedIn: 'root'
})
export class TrajectoryService {
  private trajectoryDataUrl = 'assets/batter_pov_trajectories.json';

  private rawTrajectories$: Observable<TrajectoryPoint[]>;

  // Observable for the grouped dropdown list
  public groupedPitchers$: Observable<PitcherTeam[]>;

  constructor(private http: HttpClient) {

    this.rawTrajectories$ = this.http.get<TrajectoryPoint[]>(this.trajectoryDataUrl).pipe(
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

  getTrajectoryDataForAllPitches(pitcherId: number): Observable<TrajectoryPoint[]> {
    return this.rawTrajectories$.pipe(
        map(allPoints => {
            // Filter the single array to include only the points for the selected pitcher
            const filteredPoints = allPoints.filter(p => 
                p.pitcher_id === pitcherId
            );
            return filteredPoints;
        })
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