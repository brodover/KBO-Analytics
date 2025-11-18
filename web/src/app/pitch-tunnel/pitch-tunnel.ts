import { ChangeDetectionStrategy, Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Pitch } from '../interfaces/pitch';
import { PitchTypeSummary } from '../interfaces/pitch-type-summary';

interface TunnelAnalysisResult {
  pitch_type_a: string;
  pitch_type_b: string;
  release_dist_2d: number; // Distance at release (x0, z0)
  tunnel_dist_2d: number; // Distance at 150ms mark (x_150, z_150)
  path_separation_ms: string; // Text description of separation
}

@Component({
  standalone: true,
  selector: 'app-pitch-tunnel',
  templateUrl: './pitch-tunnel.html',
  styles: [],
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchTunnel implements OnInit {
  // --- State Signals ---
  selectedPitcher = signal<string | null>(null);
  deliveryMode = signal<'windup' | 'stretch' | 'both'>('both');
  analysisResults = signal<TunnelAnalysisResult[]>([]);
  
  // New State Signals for Data Loading
  isLoading = signal<boolean>(true);
  loadingCount = signal<number>(0); // To show progress on large file load
  allPitches = signal<Pitch[]>([]); 

  // --- Lifecycle Hook to Load Data ---
  ngOnInit(): void {
    this.loadPitchData();
  }

  /**
   * Loads the pitch data from the static 'all_pitches.json' file 
   * located in the 'public/assets' directory.
   */
  private async loadPitchData(): Promise<void> {
    this.isLoading.set(true);
    // Path matches your renamed file and location
    const assetPath = 'assets/all_pitches.json'; 

    try {
      const response = await fetch(assetPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: Pitch[] = await response.json();
      
      // We don't need a chunked update for assets, as the loading screen covers the wait time.
      this.allPitches.set(data);
      console.log(`Successfully loaded ${data.length} pitches from assets.`);

    } catch (error) {
      console.error('Error loading pitch data from assets:', error);
      // Removed alert() as per instructions, using console error.
      this.allPitches.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }


  // --- Computed Signals (Now using allPitches()) ---
  uniquePitchers = computed(() => {
    return Array.from(new Set(this.allPitches().map(p => p.pitcher_name))).sort();
  });

  filteredPitches = computed(() => {
    const pitcher = this.selectedPitcher();
    const mode = this.deliveryMode();
    
    if (!pitcher) return [];

    let pitches = this.allPitches().filter(p => p.pitcher_name === pitcher);

    if (mode === 'windup') {
        // is_throwing_stretch = False means Windup
        pitches = pitches.filter(p => p.is_throwing_stretch === false);
    } else if (mode === 'stretch') {
        // is_throwing_stretch = True means Stretch
        pitches = pitches.filter(p => p.is_throwing_stretch === true);
    }
    // 'both' mode uses all pitches

    return pitches;
  });
  
  pitcherPitchTypes = computed(() => {
      // Filter out types with too few samples for stable analysis (e.g., fewer than 10)
      const pitches = this.filteredPitches();
      const counts = pitches.reduce((acc, p) => {
        acc.set(p.pitch_type, (acc.get(p.pitch_type) || 0) + 1);
        return acc;
      }, new Map<string, number>());

      return Array.from(counts.entries())
        .filter(([type, count]) => count >= 10)
        .map(([type]) => type);
  });

  // --- Event Handlers ---
  selectPitcher(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedPitcher.set(selectElement.value || null); 
    this.analysisResults.set([]); // Clear results on new selection
  }

  // --- Core Calculation Logic ---

  /**
   * Calculates the pitch location (x, z) at a given time 't'.
   */
  private calculateProjection(pitch: Pitch, t: number): { x: number, z: number } {
    // Equation: position(t) = initial_position + initial_velocity*t + 0.5 * acceleration*t^2
    const x = pitch.x0 + (pitch.vx0 * t) + (0.5 * pitch.ax * t * t);
    const z = pitch.z0 + (pitch.vz0 * t) + (0.5 * pitch.az * t * t);
    return { x, z };
  }

  /**
   * Groups filtered pitches by type and calculates the average flight path. (Normalization)
   */
  private summarizePitchTypes(pitches: Pitch[], t: number): PitchTypeSummary[] {
    const summaryMap: Map<string, { x0: number, z0: number, x_proj: number, z_proj: number, count: number }> = new Map();
    const validPitchTypes = new Set(this.pitcherPitchTypes());

    for (const pitch of pitches) {
      if (!validPitchTypes.has(pitch.pitch_type)) {
        continue; // Skip pitch types that don't meet the minimum count
      }
      
      const proj = this.calculateProjection(pitch, t);
      const key = pitch.pitch_type;
      
      const current = summaryMap.get(key) || { x0: 0, z0: 0, x_proj: 0, z_proj: 0, count: 0 };
      
      current.x0 += pitch.x0;
      current.z0 += pitch.z0;
      current.x_proj += proj.x;
      current.z_proj += proj.z;
      current.count += 1;
      
      summaryMap.set(key, current);
    }
    
    return Array.from(summaryMap.entries()).map(([type, data]) => ({
      pitch_type: type,
      count: data.count,
      avg_x0: data.x0 / data.count,
      avg_z0: data.z0 / data.count,
      avg_proj_x_150ms: data.x_proj / data.count,
      avg_proj_z_150ms: data.z_proj / data.count,
    }));
  }

  /**
   * Main function to run the tunnel analysis by comparing all pitch type pairs.
   */
  runAnalysis(tunnelTimeSeconds: number): void {
    const pitches = this.filteredPitches();

    if (this.pitcherPitchTypes().length < 2) {
        console.warn("Cannot run analysis: need at least two pitch types with 10+ samples.");
        this.analysisResults.set([]);
        return;
    }
    
    // Step 1: Normalize/Average the flight paths for each pitch type
    const summaries = this.summarizePitchTypes(pitches, tunnelTimeSeconds);
    const results: TunnelAnalysisResult[] = [];

    // Step 2: Compare every pitch type's average path against every other
    for (let i = 0; i < summaries.length; i++) {
      for (let j = i + 1; j < summaries.length; j++) {
        const pitchA = summaries[i];
        const pitchB = summaries[j];

        // 1. Calculate Release Distance (2D: X and Z plane)
        const dx0 = pitchA.avg_x0 - pitchB.avg_x0;
        const dz0 = pitchA.avg_z0 - pitchB.avg_z0;
        const releaseDist = Math.sqrt(dx0 * dx0 + dz0 * dz0);

        // 2. Calculate Tunnel Distance (2D: X and Z plane at tunnelTimeSeconds)
        const dx_tunnel = pitchA.avg_proj_x_150ms - pitchB.avg_proj_x_150ms;
        const dz_tunnel = pitchA.avg_proj_z_150ms - pitchB.avg_proj_z_150ms;
        const tunnelDist = Math.sqrt(dx_tunnel * dx_tunnel + dz_tunnel * dz_tunnel);

        // 3. Timing Disruption Metric (simplified check for separation)
        let separationMetric = '';
        if (tunnelDist >= 0.15) {
          separationMetric = 'HIGH Disruption (Poor Tunnel)';
        } else if (tunnelDist >= 0.05) {
          separationMetric = 'Moderate Separation';
        } else {
          separationMetric = 'Good Tunneling';
        }

        results.push({
          pitch_type_a: pitchA.pitch_type,
          pitch_type_b: pitchB.pitch_type,
          release_dist_2d: releaseDist,
          tunnel_dist_2d: tunnelDist,
          path_separation_ms: separationMetric,
        });
      }
    }

    this.analysisResults.set(results);
    console.log("Tunnel Analysis Complete:", results);
  }
}