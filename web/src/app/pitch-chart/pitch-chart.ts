import { HttpClient } from '@angular/common/http';
import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { isPlatformBrowser } from '@angular/common';
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

    batterNames: string[] = [];

    // Assume you have a batter selection (dropdown) bound to this
    selectedBatter: string = 'All'; 
    selectedPitcher: string = 'All';
    opponentPitchers: string[] = [];
    
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

                    // --- Process Extracted Data ---
                    if (pitchData && Array.isArray(pitchData)) {
                        const uniqueBatters = new Set<string>();
                        const uniquePitchers = new Set<string>(); // NEW Set

                        // Loop through the data to get both names
                        for (const pitch of pitchData) {
                            if (pitch['batter_name']) {
                                uniqueBatters.add(pitch['batter_name']);
                            }
                            if (pitch['pitcher_name']) {
                                uniquePitchers.add(pitch['pitcher_name']);
                            }
                        }

                        this.batterNames = Array.from(uniqueBatters).sort();
                        this.opponentPitchers = Array.from(uniquePitchers).sort(); // Set opponent list
                    } else {
                        this.batterNames = [];
                        this.opponentPitchers = [];
                        console.warn('[Data Extraction] Could not find pitch data in the loaded chart JSON. Lists empty.');
                    }
                    
                    // --- End of Data Extraction ---

                    // Set 'All' as the default selection for pitchers/batters upon loading a new chart file
                    this.selectedBatter = 'All'; 
                    this.selectedPitcher = 'All'; // <-- Ensure pitcher selection is reset/defaults to 'All'
                    
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
                    console.log('Chart rendered.');

                    this.setSelections(); 
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
        
        // 1. Identify the data names associated with the strike zone layers
        if (spec.layer && Array.isArray(spec.layer)) {
            for (const layer of spec.layer) {
                // Check if it's a rect mark and has a data name
                if (layer.mark && layer.mark.type === 'rect' && layer.data && layer.data.name) {
                    
                    // Base Zone is the gray one, Dynamic Zone is the red one
                    if (layer.mark.stroke === 'gray' && !baseDataName) {
                        baseDataName = layer.data.name;
                    } else if (layer.mark.stroke === 'red' && !dynamicDataName) {
                        dynamicDataName = layer.data.name;
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


        // --- 2. DETERMINE DYNAMIC ZONE (INDIVIDUAL BATTER) ---
        if (this.selectedBatter !== 'All') {
            const dynamicLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'BATTER' && d.entity_name === this.selectedBatter
            );
            
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
     * Updates all Vega-Lite selection parameters based on the current Angular state.
     */
    setSelections(): void {
        // We already check for vegaView inside the dedicated functions, 
        // but we can keep the console warning if needed.
        if (!this.vegaView) {
            console.warn('Vega view not initialized. Skipping filtering.');
            return;
        }
        
        this.setBatterSelection();
        this.setPitcherSelection();
    }

    /**
     * Updates the Vega-Lite selection for the Batter filter.
     */
    setBatterSelection(): void {
        if (!this.vegaView) {
            return;
        }
        
        const batterValue = this.selectedBatter === 'All' 
            ? {}
            : { "batter_name": [this.selectedBatter] };

        const currentState = this.vegaView.getState();
        currentState.signals.BatterSelector = batterValue;

        this.vegaView = this.vegaView.signal("BatterSelector", batterValue);
        this.vegaView.runAsync();
        
        console.log(`[Filter] Batter applied: ${this.selectedBatter}`);
    }

    /**
     * Updates the Vega-Lite selection for the Pitcher filter.
     */
    setPitcherSelection(): void {
        if (!this.vegaView) {
            return;
        }
        
        const pitcherValue = this.selectedPitcher === 'All' 
            ? {}
            : { "pitcher_name": [this.selectedPitcher] };

        const currentState = this.vegaView.getState();
        currentState.signals.PitcherSelector = pitcherValue;

        this.vegaView = this.vegaView.signal("PitcherSelector", pitcherValue);
        this.vegaView.runAsync();
        
        console.log(`[Filter] Pitcher applied: ${this.selectedPitcher}`);
        
    }

    /**
     * batter dropdown filter change handler
     */
    onBatterChange(newBatter: string): void {
        this.selectedBatter = newBatter;
        console.log(`Batter changed to: ${newBatter}`);

        this.updateStrikeZone();
        if (this.loadedChartSpec) {
            this.renderChart(this.loadedChartSpec); 
        }
    }

    /**
     * pitcher dropdown filter change handler
     */
    onPitcherChange(newPitcher: string): void {
        this.selectedPitcher = newPitcher;
        console.log(`Pitcher changed to: ${newPitcher}`);

        if (this.loadedChartSpec) {
            this.renderChart(this.loadedChartSpec);
        }
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