import { Component, OnInit } from '@angular/core';
import { PercentPipe, DecimalPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PitcherEffectiveness } from '../interfaces/pitcher-effectiveness';
import { PitcherStatsBars } from '../pitcher-stats-bars/pitcher-stats-bars';

@Component({
  selector: 'app-pitcher-stats',
  templateUrl: './pitcher-stats.html',
  styleUrls: ['./pitcher-stats.css'],
  imports: [PitcherStatsBars, PercentPipe, DecimalPipe, CommonModule, FormsModule]
})
export class PitcherStats implements OnInit {

  // Raw data loaded from JSON
  fullStats: PitcherEffectiveness[] = [];
  // Data displayed in the table (filtered)
  filteredStats: PitcherEffectiveness[] = [];

  // Dropdown states
  uniquePitcherTeams: string[] = [];
  uniqueBatterTeams: string[] = [];

  selectedPitcherTeam: string = 'All'; // Default to show all
  selectedBatterTeam: string = 'All'; // Default to show all

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Assuming your JSON file is in the 'assets' folder
    this.http.get<PitcherEffectiveness[]>('assets/pitcher_effectiveness_season_summary.json')
      .subscribe(data => {
        this.fullStats = data;

        // Populate dropdown options
        this.uniquePitcherTeams = ['All', ...new Set(data.map(d => d.pitcher_team_code))].sort();
        this.uniqueBatterTeams = ['All', ...new Set(data.map(d => d.batter_team_code))].sort();

        // Initial filter
        this.applyFilters();
      });
  }

  applyFilters(): void {
    let tempStats = this.fullStats;

    // Filter by Pitcher Team (Dropdown 1)
    if (this.selectedPitcherTeam !== 'All') {
      tempStats = tempStats.filter(
        stat => stat.pitcher_team_code === this.selectedPitcherTeam
      );
    }

    // Filter by Batter Team (Dropdown 2)
    if (this.selectedBatterTeam !== 'All') {
      tempStats = tempStats.filter(
        stat => stat.batter_team_code === this.selectedBatterTeam
      );
    }

    this.filteredStats = tempStats;
  }

  /**
   * Checks if the pitcher in the current row (i) is different 
   * from the pitcher in the previous row (i-1).
   * @param index The current index in the filteredStats array.
   * @returns True if the pitcher name has changed from the previous row.
   */
  isNewPitcher(index: number): boolean {
    if (index === 0) {
      // The very first row should not have a divider (it starts the group)
      return false;
    }

    const currentPitcher = this.filteredStats[index].pitcher_name;
    const previousPitcher = this.filteredStats[index - 1].pitcher_name;

    return currentPitcher !== previousPitcher;
  }
}