import { HttpClient } from '@angular/common/http';
import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { StrikeZoneData } from '../interfaces/strike-zone-data';

@Component({
    selector: 'app-pitch-chart',
    templateUrl: './pitch-chart.html',
    styleUrl: './pitch-chart.css',
    imports: [
        CommonModule,
        FormsModule
    ],
})



export class PitchChart implements AfterViewInit {
    // Use @ViewChild to get a reference to the HTML div container
    @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

    private vegaView: any = null;
    private loadedChartSpec: any = null;

    private baseZoneDataName = "";
    private dynamicZoneDataName = "";

    // Assume you have a batter selection (dropdown) bound to this
    selectedBatter: string = 'ALL';
    selectedPitcher: string = 'ALL';

    // State for Dynamic Strike Zone Data
    strikeZoneData: StrikeZoneData[] = [];

    // Base Zone coordinates (for the team/opponent team average)
    currentBaseZoneTop: number = 3.4;
    currentBaseZoneBtm: number = 1.6;

    // Dynamic Zone coordinates (for the selected individual batter)
    currentDynamicZoneTop: number = 3.4;
    currentDynamicZoneBtm: number = 1.6;

    // Constants for pixel conversion (based on your chart generation)
    // Total Y range in feet (from 0.0 to 5.0, matching the chart's Y-scale domain)
    private readonly CHART_Y_RANGE_FT = 5.0;
    // Total chart height in pixels (matches the HEIGHT=760 in your Python script)
    private readonly CHART_PIXEL_HEIGHT = 760;

    // State variables for the selections
    playerType: 'batters' | 'pitchers' = 'batters'; // Default to batters
    opponentTeam: string = 'HH'; // Default to the first team

    // List of opponent team abbreviations from your file names
    opponentTeams: string[] = ['HH', 'HT', 'KT', 'LG', 'NC', 'OB', 'SK', 'SS', 'WO'];

    constructor(@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private http: HttpClient) { }

    ngAfterViewInit(): void {
        // 1. Fetch the strike zone data asynchronously
        this.fetchStrikeZoneData().then(() => {
            // 2. Load the main pitch chart after the strike zone data is ready
            this.loadChart();
        });
    }

    /**
     * Fetches the strike zone summary data.
     */
    fetchStrikeZoneData(): Promise<void> {
        return new Promise((resolve) => {
            this.http.get<StrikeZoneData[]>(`assets/strikezone_summary.json`).subscribe({
                next: (data) => {
                    this.strikeZoneData = data;
                    resolve();
                },
                error: (err) => {
                    console.error('Error fetching strike zone data', err);
                    resolve(); // Resolve anyway to proceed with chart loading
                }
            });
        });
    }

    /**
     * Constructs the filename and fetches/renders the Altair chart.
     */
    loadChart(): void {
        if (isPlatformBrowser(this.platformId)) {
            // 1. Construct the filename based on current selections
            const filename = `LT_${this.playerType}_vs_${this.opponentTeam}_discipline.json`;
            const chartUrl = `assets/${filename}`;

            console.log('Attempting to load chart:', chartUrl);

            // 2. Fetch the Altair/Vega-Lite JSON specification
            this.http.get(chartUrl).subscribe({
                next: (data: any) => {
                    this.loadedChartSpec = data; // <-- Store the spec

                    let pitchData: any[] = [];

                    // --- Data Extraction Logic ---
                    const firstLayer = data.layer && data.layer[0];

                    if (firstLayer && firstLayer.data && firstLayer.data.name && data.datasets) {
                        // Case 1: Data is referenced by name (common in layered Altair charts)
                        const dataName = firstLayer.data.name;
                        pitchData = data.datasets[dataName];
                    } else if (data.data && data.data.values) {
                        // Case 2: Data is inline (standard single chart)
                        pitchData = data.data.values;
                    }

                    this.updateStrikeZone();
                    this.renderChart(this.loadedChartSpec);
                },
                error: (err) => {
                    console.error('Failed to load chart JSON:', err);
                }
            });
        } else {
            console.log('Skipping Vega-Embed execution on the server side.');
        }
    }

    /**
     * Renders the Vega-Lite/Altair specification after injecting dynamic data.
     */
    renderChart(vegaSpec: any): void {
        const container = this.el.nativeElement.querySelector('#vega-chart-container');
        if (container) {
            console.log('renderChart');
            const updatedSpec = this.injectStrikeZoneCoordinates(vegaSpec);

            container.innerHTML = '';
            vegaEmbed.default(container, updatedSpec, { actions: false })
                .then(result => {
                    this.vegaView = result.view;

                    this.setupVegaListeners();

                    console.log('Chart rendered.');
                })
                .catch(console.error);
        }
    }

    /**
     * Overwrites the strike zone data arrays for both the base and dynamic layers by
     * modifying the coordinates inside the top-level 'datasets' object.
     */
    injectStrikeZoneCoordinates(spec: any): any {
        let baseDataName: string | undefined;
        let dynamicDataName: string | undefined;

        // Reset names on each load
        this.baseZoneDataName = '';
        this.dynamicZoneDataName = '';

        // 1. Identify the data names associated with the strike zone layers
        if (spec.layer && Array.isArray(spec.layer)) {
            for (const layer of spec.layer) {
                // Check if it's a rect mark and has a data name
                if (layer.mark && layer.mark.type === 'rect' && layer.data && layer.data.name) {

                    // Base Zone is the gray one, Dynamic Zone is the red one
                    if (layer.mark.stroke === 'gray' && !baseDataName) {
                        baseDataName = layer.data.name;
                        this.baseZoneDataName = baseDataName!;
                    } else if (layer.mark.stroke === 'red' && !dynamicDataName) {
                        dynamicDataName = layer.data.name;
                        this.dynamicZoneDataName = dynamicDataName!;
                    }
                }
            }
        }

        // 2. Modify the data inside the top-level 'datasets' object
        // Note: spec.datasets is where Altair places the named data arrays.

        let baseZoneModified = false;
        let dynamicZoneModified = false;

        if (spec.datasets) {

            // Modify Base Zone Data
            if (baseDataName && Array.isArray(spec.datasets[baseDataName])) {
                const baseLayerData = spec.datasets[baseDataName];
                if (baseLayerData.length > 0) {
                    // The strike zone data should only have one row
                    baseLayerData[0].y = this.currentBaseZoneBtm;
                    baseLayerData[0].y2 = this.currentBaseZoneTop;
                    baseZoneModified = true;
                }
            }

            // Modify Dynamic Zone Data
            if (dynamicDataName && Array.isArray(spec.datasets[dynamicDataName])) {
                const dynamicLayerData = spec.datasets[dynamicDataName];
                if (dynamicLayerData.length > 0) {
                    // The strike zone data should only have one row
                    dynamicLayerData[0].y = this.currentDynamicZoneBtm;
                    dynamicLayerData[0].y2 = this.currentDynamicZoneTop;
                    dynamicZoneModified = true;
                }
            }
        }

        // 3. Final status check
        if (!baseZoneModified || !dynamicZoneModified) {
            console.warn('⚠️ WARNING: Could not modify data for both strike zone layers. Check JSON for "datasets" property.');
        }

        return spec;
    }

    /**
     * Looks up the correct strike zone (top/bottom) based on current filters.
     */
    updateStrikeZone(): void {
        if (this.strikeZoneData.length === 0) return;

        // --- 1. DETERMINE BASE ZONE (TEAM/OPPONENT TEAM AVERAGE) ---
        let baseLookupEntry: StrikeZoneData | undefined;
        const allEntry = this.strikeZoneData.find(d => d.entity_type === 'ALL');

        if (this.playerType === 'pitchers') {
            // Base Zone: Opponent Team Average
            baseLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === this.opponentTeam
            );
        } else if (this.playerType === 'batters') {
            // Base Zone: Lotte Team Average
            baseLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === 'LT'
            );
        }

        // Apply Base Zone values, falling back to 'ALL'
        const finalBaseEntry = baseLookupEntry || allEntry;
        if (finalBaseEntry) {
            this.currentBaseZoneTop = finalBaseEntry.avg_strikezone_top;
            this.currentBaseZoneBtm = finalBaseEntry.avg_strikezone_btm;
        } else {
            // Failsafe 1: Set base to a default (should not happen)
            this.currentBaseZoneTop = 3.4; this.currentBaseZoneBtm = 1.6;
        }

        console.log(`Base Zone set to [${this.selectedBatter}, ${this.currentBaseZoneBtm}, ${this.currentBaseZoneTop}]`);
        // --- 2. DETERMINE DYNAMIC ZONE (INDIVIDUAL BATTER) ---
        if (this.selectedBatter !== 'ALL') {
            const dynamicLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'BATTER' && d.entity_name === this.selectedBatter
            );

            console.log(`Dynamic Lookup Entry for `, dynamicLookupEntry, finalBaseEntry);
            // Use batter's zone if available, otherwise fall back to the Base Zone
            const finalDynamicEntry = dynamicLookupEntry || finalBaseEntry;

            // This block MUST execute to update the coordinates away from 0.0
            if (finalDynamicEntry) {
                this.currentDynamicZoneTop = finalDynamicEntry.avg_strikezone_top;
                this.currentDynamicZoneBtm = finalDynamicEntry.avg_strikezone_btm;
            } else {
                // Failsafe 2: If somehow both lookups fail, reset to defaults instead of 0.0
                this.currentDynamicZoneTop = 3.4;
                this.currentDynamicZoneBtm = 1.6;
            }
        } else {
            // HIDE the dynamic zone when 'All Batters' is selected
            this.currentDynamicZoneTop = 0.0;
            this.currentDynamicZoneBtm = 0.0;
        }
    }

    /**
     * Attaches signal listeners to the active Vega view.
     */
    setupVegaListeners(): void {
        if (!this.vegaView) return;

        // Listen for the BATTER dropdown
        this.vegaView.addSignalListener('BatterSelector_batter_name', (name: string, value: string) => {
            // 'value' is the selected name
            console.log(`Vega batter selection changed to: ${value}`);

            // This is the main "react" function
            this.reactToBatterChange(value);
        });

        // Listen for the PITCHER dropdown
        this.vegaView.addSignalListener('PitcherSelector_pitcher_name', (name: string, value: string) => {
            // 'value' is the selected name
            console.log(`Vega pitcher selection changed to: ${value}`);

            // Just update the Angular property. No strike zone change is needed.
            this.selectedPitcher = value;
        });
    }

    /**
     * Reacts to a batter selection change from the Vega dropdown.
     * 1. Updates Angular state.
     * 2. Recalculates strike zone.
     * 3. Pushes new coordinates back into Vega.
     */
    reactToBatterChange(batterName: string): void {
        // 1. Update Angular's state
        this.selectedBatter = batterName;

        // 2. Recalculate strike zone coordinates
        // This will update this.currentBaseZoneTop/Btm and this.currentDynamicZoneTop/Btm
        this.updateStrikeZone();
        if (this.loadedChartSpec) {
            this.renderChart(this.loadedChartSpec);
        }

        console.log(`Pushed strike zone update for ${batterName}: [${this.currentDynamicZoneBtm}, ${this.currentDynamicZoneTop}]`);
    }

    /**
     * Manually prints the current internal state of the Vega view,
     * including active filter parameters, for debugging.
     */
    printCurrentVegaState(): void {
        if (!this.vegaView) {
            console.warn('Vega view not yet available to print state.');
            return;
        }

        try {
            const currentState = this.vegaView.getState();

            // This log is the one we need to analyze!
            console.log('[FINAL DEBUG] Vega Internal State (Manual Check):', currentState);

            console.log('--- Selector Values ---');
            console.log(`BatterSelector Value:`, currentState.signals?.BatterSelector || currentState.data?.BatterSelector);
            console.log(`PitcherSelector Value:`, currentState.signals?.PitcherSelector || currentState.data?.PitcherSelector);
            console.log('-----------------------');
        } catch (e) {
            console.error('Error reading Vega state:', e);
        }
    }
}