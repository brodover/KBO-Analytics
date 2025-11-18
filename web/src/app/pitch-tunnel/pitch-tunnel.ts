import { ChangeDetectionStrategy, Component, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Pitch } from '../interfaces/pitch';
import { PitchTypeSummary } from '../interfaces/pitch-type-summary';
import { finalize } from 'rxjs';

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
    styleUrl: './pitch-tunnel.css',
    imports: [CommonModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchTunnel implements OnInit {
    @ViewChild('tunnelCanvas') tunnelCanvas!: ElementRef<HTMLCanvasElement>; // Reference to the canvas element

    // Color palette for pitch types (consistent colors help visualization)
    pitchColors: { [key: string]: string } = {
        '직구': '#4682B4',
        '슬라이더': '#f5334d',
        '포크': '#ff7f0e',
        '커브': '#3CB371',
        '체인지업': '#8c564b',
        '투심': '#9370DB',
        '커터': '#f0c819',
        '스위퍼': '#e771b6',
        '너클볼': '#54dbd5ff',
    };

    // --- State Signals ---
    selectedPitcher = signal<string | null>(null);
    deliveryMode = signal<'windup' | 'stretch' | 'both'>('both');
    analysisResults = signal<TunnelAnalysisResult[]>([]);

    // Signals for Team Filtering
    selectedTeam = signal<string | null>(null);
    allTeams = signal<string[]>([]);

    // State Signals for Data Loading
    isLoading = signal<boolean>(true);
    allPitches = signal<Pitch[]>([]);

    constructor(private http: HttpClient) { }

    // --- Lifecycle Hook to Load Data ---
    ngOnInit(): void {
        this.loadPitchData();
    }

    /**
     * Loads the pitch data from the static 'all_pitches.json' file 
     * located in the 'public/assets' directory.
     */
    private loadPitchData(): void {
        this.isLoading.set(true);

        this.http.get<Pitch[]>(`assets/all_pitches.json`).pipe(
            // 'finalize' runs when the observable completes or errors out
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (data) => {
                this.allPitches.set(data);

                const teams = Array.from(new Set(data.map(p => p.pitcher_team_code))).sort();
                this.allTeams.set(teams);

                console.log(`Successfully loaded ${data.length} pitches from assets.`);
            },
            error: (error) => {
                console.error('Error loading pitch data from assets:', error);
                this.allPitches.set([]);
            }
        });
    }

    // --- Computed Signals (Now using allPitches()) ---
    uniquePitchers = computed(() => {
        const selectedTeam = this.selectedTeam();

        if (!selectedTeam) return []; 
        return Array.from(new Set(
            this.allPitches()
                .filter(p => p.pitcher_team_code === selectedTeam)
                .map(p => p.pitcher_name)
        )).sort();
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
    selectTeam(event: Event): void {
        const selectElement = event.target as HTMLSelectElement;
        this.selectedTeam.set(selectElement.value || null);
        this.selectedPitcher.set(null); // Reset pitcher when team changes
        this.analysisResults.set([]); // Clear results
    }

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
            // Clear visualization if analysis cannot run
            if (this.tunnelCanvas) {
                this.tunnelCanvas.nativeElement.getContext('2d')?.clearRect(0, 0, this.tunnelCanvas.nativeElement.width, this.tunnelCanvas.nativeElement.height);
            }
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

        // Step 3: Draw the results
        // We wrap this in a timeout to ensure the canvas element has been rendered by Angular
        setTimeout(() => {
            if (this.tunnelCanvas) {
                this.drawTunnelPlot(summaries);
            }
        }, 0);
    }

    /** Draws the paths of all summarized pitch types onto the canvas. */
    private drawTunnelPlot(summaries: PitchTypeSummary[]): void {
        const canvas = this.tunnelCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use responsive width/height if needed, but for simplicity, we use fixed attributes in the HTML for now
        const width = canvas.width;
        const height = canvas.height;

        // Clear the canvas
        ctx.clearRect(0, 0, width, height);

        // --- Define Plotting Area (in feet) ---
        // X plane: - (pitcher's right) to + (pitcher's left). Plate is at X=0.
        const xMin = -4.0;
        const xMax = 4.0;
        // Z plane: 0.0 ft (ground) to top of plot
        const zMin = 0.0;
        const zMax = 7.0;

        const xRange = xMax - xMin;
        const zRange = zMax - zMin;

        // Helper function to convert real-world coordinates (ft) to canvas pixels
        const toPx = (x: number, z: number): { pxX: number, pxY: number } => {
            // X conversion: maps xMin -> 0, xMax -> width
            const pxX = ((x - xMin) / xRange) * width;
            // Z conversion: maps zMax -> 0 (top of canvas), zMin -> height (bottom of canvas)
            const pxY = height - ((z - zMin) / zRange) * height;
            return { pxX, pxY };
        };

        // --- 1. Draw Strike Zone Reference (Home Plate) ---
        ctx.strokeStyle = '#4b5563'; // Gray
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]); // Dashed line

        const strikeZoneTop = 3.5; // Example Avg Top
        const strikeZoneBtm = 1.5; // Example Avg Bottom
        const plateWidth = 1.41; // Home plate width (17 inches)

        // Calculate strike zone corners in pixels (assuming plate center is at x=0)
        const { pxX: xL } = toPx(-plateWidth / 2, strikeZoneBtm);
        const { pxX: xR } = toPx(plateWidth / 2, strikeZoneBtm);
        const { pxY: yB } = toPx(0, strikeZoneBtm);
        const { pxY: yT } = toPx(0, strikeZoneTop);

        // Draw Strike Zone Rectangle
        ctx.strokeRect(xL, yT, xR - xL, yB - yT);

        // Draw center line (X=0)
        ctx.setLineDash([2, 5]);
        ctx.strokeStyle = '#9ca3af';

        // Loop through every foot mark until you are past the visible area
        const firstVerticalFoot = Math.floor(xMin);
        for (let footX = firstVerticalFoot; footX <= xMax; footX++) {
            // Convert the foot value to a pixel coordinate
            const { pxX } = toPx(footX, 0);

            // Draw the line
            ctx.beginPath();
            ctx.moveTo(pxX, 0);
            ctx.lineTo(pxX, height);
            ctx.stroke();
        }

        // 2. Draw horizontal grid lines (every 1 foot along the Y-axis)
        const firstHorizontalFoot = Math.floor(zMin);
        for (let footY = firstHorizontalFoot; footY <= zMax; footY++) {
            // Convert the foot value to a pixel coordinate
            const { pxY } = toPx(0, footY);

            // Draw the line
            ctx.beginPath();
            ctx.moveTo(0, pxY);
            ctx.lineTo(width, pxY);
            ctx.stroke();
        }

        ctx.setLineDash([]); // Reset line dash for pitch paths

        // --- 2. Draw Pitch Paths ---
        ctx.lineWidth = 3;

        for (const pitch of summaries) {
            const color = this.pitchColors[pitch.pitch_type] || '#000000';
            ctx.strokeStyle = color;
            ctx.fillStyle = color;

            // a. Release Point (x0, z0)
            const release = toPx(pitch.avg_x0, pitch.avg_z0);

            // b. 150ms Tunnel Point
            const tunnel = toPx(pitch.avg_proj_x_150ms, pitch.avg_proj_z_150ms);

            // Draw Path (Line from Release to Tunnel Point)
            ctx.beginPath();
            ctx.moveTo(release.pxX, release.pxY);
            ctx.lineTo(tunnel.pxX, tunnel.pxY);
            ctx.stroke();

            // Draw Release Point (Dot)
            ctx.beginPath();
            ctx.arc(release.pxX, release.pxY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Draw Tunnel Point (Dot)
            ctx.beginPath();
            ctx.arc(tunnel.pxX, tunnel.pxY, 3, 0, Math.PI * 2);
            ctx.fill();

            // Label the Tunnel Point
            ctx.font = '10px sans-serif';
            ctx.fillText(pitch.pitch_type, tunnel.pxX + 6, tunnel.pxY + 3);
        }

        // --- 3. Draw Legend ---
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.fillText('Strike Zone (Avg)', xL, yT - 10);

        let legendY = 20;
        for (const [type, color] of Object.entries(this.pitchColors)) {
            if (summaries.some(s => s.pitch_type === type)) {
                ctx.fillStyle = color;
                ctx.fillRect(width - 80, legendY, 10, 10);
                ctx.fillStyle = '#374151';
                ctx.fillText(type, width - 65, legendY + 9);
                legendY += 15;
            }
        }
    }
}